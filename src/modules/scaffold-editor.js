import { select, text, multiselect, confirm, log } from '@clack/prompts';
import { readdirSync } from 'node:fs';
import chalk from 'chalk';
import { readIndex, writeIndex, addEntry, removeEntries, updateEntry } from '../lib/content-index.js';
import { scaffoldIndexPath } from '../lib/st-paths.js';
import { backupToAdmin } from '../backup.js';
import { printHeader, info } from '../ui.js';

/** Known SillyTavern content types. */
const CONTENT_TYPES = [
  { value: 'character', label: 'Character' },
  { value: 'world',     label: 'World (Lorebook)' },
  { value: 'theme',     label: 'Theme' },
  { value: 'preset',    label: 'Preset' },
  { value: 'template',  label: 'Template' },
];

/**
 * Display the current index entries as a table.
 * @param {Array<object>} index
 */
function displayIndex(index) {
  if (index.length === 0) {
    console.log(chalk.dim('  (no entries)'));
    return;
  }

  console.log(
    chalk.bold('  #  ') +
    chalk.bold('Filename'.padEnd(40)) +
    chalk.bold('Type')
  );
  console.log(chalk.dim('  ' + '─'.repeat(55)));

  index.forEach((entry, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}  ` +
      (entry.filename || 'unnamed').padEnd(40) +
      (entry.type || 'unknown')
    );
  });
  console.log('');
}

/**
 * Add a new entry to the scaffold index.
 * @param {object} config
 * @param {string} indexPath
 * @param {Array<object>} index
 * @returns {Array<object>} Updated index
 */
async function addNewEntry(config, indexPath, index) {
  // List files in the scaffold directory to help the admin pick
  let scaffoldFiles = [];
  try {
    scaffoldFiles = readdirSync(config.scaffoldDir)
      .filter(f => f !== 'index.json');
  } catch { /* directory may not exist */ }

  let filename;
  if (scaffoldFiles.length > 0) {
    const choice = await select({
      message: 'Select a file or enter a custom filename:',
      options: [
        ...scaffoldFiles.map(f => ({ value: f, label: f })),
        { value: '__custom__', label: 'Enter custom filename...' },
      ],
    });
    if (typeof choice === 'symbol') return index;

    if (choice === '__custom__') {
      filename = await text({
        message: 'Filename:',
        validate: (v) => v.trim() ? undefined : 'Required',
      });
      if (typeof filename === 'symbol') return index;
    } else {
      filename = choice;
    }
  } else {
    filename = await text({
      message: 'Filename:',
      validate: (v) => v.trim() ? undefined : 'Required',
    });
    if (typeof filename === 'symbol') return index;
  }

  const type = await select({
    message: 'Content type:',
    options: CONTENT_TYPES,
  });
  if (typeof type === 'symbol') return index;

  const newEntry = { filename: filename.trim(), type };
  const updated = addEntry(index, newEntry);

  if (config.dryRun) {
    info(`[DRY RUN] Would add entry: ${JSON.stringify(newEntry)}`);
  } else {
    writeIndex(indexPath, updated);
    log.success(`Added "${filename}" (${type}) to scaffold index.`);
  }

  return updated;
}

/**
 * Remove entries from the scaffold index.
 * @param {object} config
 * @param {string} indexPath
 * @param {Array<object>} index
 * @returns {Array<object>} Updated index
 */
async function removeExistingEntries(config, indexPath, index) {
  if (index.length === 0) {
    log.warn('No entries to remove.');
    return index;
  }

  const toRemove = await multiselect({
    message: 'Select entries to remove:',
    options: index.map(e => ({
      value: e.filename,
      label: `${e.filename} (${e.type})`,
    })),
    required: true,
  });
  if (typeof toRemove === 'symbol') return index;

  const ok = await confirm({
    message: `Remove ${toRemove.length} entry/entries from the scaffold index?`,
  });
  if (typeof ok === 'symbol' || !ok) return index;

  const updated = removeEntries(index, toRemove);

  if (config.dryRun) {
    info(`[DRY RUN] Would remove ${toRemove.length} entries`);
  } else {
    writeIndex(indexPath, updated);
    log.success(`Removed ${toRemove.length} entry/entries.`);
  }

  return updated;
}

/**
 * Edit an existing entry.
 * @param {object} config
 * @param {string} indexPath
 * @param {Array<object>} index
 * @returns {Array<object>} Updated index
 */
async function editExistingEntry(config, indexPath, index) {
  if (index.length === 0) {
    log.warn('No entries to edit.');
    return index;
  }

  const targetFilename = await select({
    message: 'Select an entry to edit:',
    options: index.map(e => ({
      value: e.filename,
      label: `${e.filename} (${e.type})`,
    })),
  });
  if (typeof targetFilename === 'symbol') return index;

  const entry = index.find(e => e.filename === targetFilename);

  const newFilename = await text({
    message: 'New filename (or press enter to keep):',
    initialValue: entry.filename,
  });
  if (typeof newFilename === 'symbol') return index;

  const newType = await select({
    message: 'New type:',
    options: CONTENT_TYPES.map(ct => ({
      ...ct,
      hint: ct.value === entry.type ? '(current)' : undefined,
    })),
  });
  if (typeof newType === 'symbol') return index;

  const updates = {};
  if (newFilename.trim() !== entry.filename) updates.filename = newFilename.trim();
  if (newType !== entry.type) updates.type = newType;

  if (Object.keys(updates).length === 0) {
    log.info('No changes made.');
    return index;
  }

  const updated = updateEntry(index, targetFilename, updates);

  if (config.dryRun) {
    info(`[DRY RUN] Would update entry: ${JSON.stringify(updates)}`);
  } else {
    writeIndex(indexPath, updated);
    log.success(`Updated entry for "${targetFilename}".`);
  }

  return updated;
}

/**
 * Main entry point.
 * @param {object} config
 */
export async function run(config) {
  const indexPath = scaffoldIndexPath(config.scaffoldDir);
  let index = readIndex(indexPath);

  while (true) {
    printHeader('Scaffold index.json');
    displayIndex(index);

    const action = await select({
      message: 'What would you like to do?',
      options: [
        { value: 'add',    label: 'Add entry' },
        { value: 'remove', label: 'Remove entries' },
        { value: 'edit',   label: 'Edit entry' },
        { value: 'back',   label: 'Back to main menu' },
      ],
    });

    if (typeof action === 'symbol' || action === 'back') break;

    // Backup before first modification
    if (!config.dryRun && (action === 'add' || action === 'remove' || action === 'edit')) {
      backupToAdmin(config.backupRoot, indexPath, 'scaffold-index', config.dryRun);
    }

    if (action === 'add') index = await addNewEntry(config, indexPath, index);
    else if (action === 'remove') index = await removeExistingEntries(config, indexPath, index);
    else if (action === 'edit') index = await editExistingEntry(config, indexPath, index);
  }
}
