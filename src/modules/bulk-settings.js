import { select, text, confirm, multiselect, log } from '@clack/prompts';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import lodashGet from 'lodash.get';
import { selectUsers } from '../users.js';
import { batchOperation } from '../batch.js';
import { backupUserFile } from '../backup.js';
import { userSettingsPath } from '../lib/st-paths.js';
import { applyMutations, syncSections, parseValue } from '../lib/json-merge.js';
import { printHeader, info } from '../ui.js';

/**
 * Read and parse a user's settings.json.
 * @param {string} path
 * @returns {object|null}
 */
function readSettings(path) {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Write settings back to disk.
 * @param {string} path
 * @param {object} settings
 */
function writeSettings(path, settings) {
  writeFileSync(path, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Interactive loop to collect dot-path / value mutations from the admin.
 * @returns {Promise<Array<{path: string, value: any}>>}
 */
async function collectMutations() {
  const mutations = [];

  while (true) {
    const path = await text({
      message: mutations.length === 0
        ? 'Enter a settings key (dot-path, e.g. "world_info_depth"):'
        : 'Enter another key (or leave empty to finish):',
      validate: (v) => {
        if (mutations.length === 0 && !v.trim()) return 'At least one key is required';
        return undefined;
      },
    });
    if (typeof path === 'symbol') return mutations;
    if (!path.trim()) break;

    const rawValue = await text({
      message: `Value for "${path}" (auto-detects type):`,
      validate: (v) => v.trim() ? undefined : 'Value is required',
    });
    if (typeof rawValue === 'symbol') return mutations;

    const value = parseValue(rawValue);
    mutations.push({ path: path.trim(), value });

    log.info(`  ${path} = ${chalk.cyan(JSON.stringify(value))} (${typeof value})`);
  }

  return mutations;
}

/**
 * Mode 1: Set specific key/value pairs across users.
 * @param {object} config
 */
async function setKeyValues(config) {
  const mutations = await collectMutations();
  if (mutations.length === 0) return;

  printHeader('Mutations to apply');
  for (const { path, value } of mutations) {
    console.log(`  ${chalk.bold(path)} = ${chalk.cyan(JSON.stringify(value))}`);
  }
  console.log('');

  const users = await selectUsers(config);
  if (users.length === 0) return;

  const proceed = await confirm({
    message: `Apply ${mutations.length} mutation(s) to ${users.length} user(s)?`,
  });
  if (typeof proceed === 'symbol' || !proceed) return;

  await batchOperation(users, async (handle) => {
    const settingsPath = userSettingsPath(config.dataRoot, handle);

    if (!existsSync(settingsPath)) {
      return { skipped: 'no settings.json' };
    }

    const settings = readSettings(settingsPath);
    if (settings === null) {
      return { skipped: 'no settings.json' };
    }

    if (!config.dryRun) {
      backupUserFile(config.dataRoot, handle, 'settings.json');
    }

    const updated = applyMutations(settings, mutations);

    if (config.dryRun) {
      info(`[DRY RUN] Would update ${settingsPath}`);
    } else {
      writeSettings(settingsPath, updated);
    }

    return 'success';
  }, 'Bulk Set Key/Values');
}

/**
 * Mode 2: Sync sections from a golden template.
 * @param {object} config
 */
async function syncFromTemplate(config) {
  const templatePath = await text({
    message: 'Path to the golden template settings.json:',
    validate: (v) => {
      if (!v.trim()) return 'Path is required';
      if (!existsSync(v.trim())) return 'File not found';
      return undefined;
    },
  });
  if (typeof templatePath === 'symbol') return;

  let template;
  try {
    template = JSON.parse(readFileSync(templatePath, 'utf-8'));
  } catch (err) {
    log.error(`Failed to parse template: ${err.message}`);
    return;
  }

  // Show top-level keys and let admin pick which to sync
  const topKeys = Object.keys(template);
  if (topKeys.length === 0) {
    log.warn('Template has no keys.');
    return;
  }

  const selectedKeys = await multiselect({
    message: 'Select sections to sync from the template:',
    options: topKeys.map(k => {
      const val = template[k];
      const hint = typeof val === 'object' && val !== null
        ? `(${Array.isArray(val) ? 'array' : 'object'})`
        : `(${typeof val}: ${JSON.stringify(val).slice(0, 30)})`;
      return { value: k, label: k, hint };
    }),
    required: true,
  });
  if (typeof selectedKeys === 'symbol') return;

  const users = await selectUsers(config);
  if (users.length === 0) return;

  const proceed = await confirm({
    message: `Sync ${selectedKeys.length} section(s) from template to ${users.length} user(s)?`,
  });
  if (typeof proceed === 'symbol' || !proceed) return;

  await batchOperation(users, async (handle) => {
    const settingsPath = userSettingsPath(config.dataRoot, handle);

    if (!existsSync(settingsPath)) {
      return { skipped: 'no settings.json' };
    }

    const settings = readSettings(settingsPath);
    if (settings === null) {
      return { skipped: 'no settings.json' };
    }

    if (!config.dryRun) {
      backupUserFile(config.dataRoot, handle, 'settings.json');
    }

    const updated = syncSections(settings, template, selectedKeys);

    if (config.dryRun) {
      info(`[DRY RUN] Would sync sections to ${settingsPath}`);
    } else {
      writeSettings(settingsPath, updated);
    }

    return 'success';
  }, 'Sync from Template');
}

/**
 * Mode 3: Link a character lorebook (add to world_info.globalSelect or similar).
 * @param {object} config
 */
async function linkLorebook(config) {
  const lorebookName = await text({
    message: 'Lorebook filename to link (e.g. "MyLorebook.json"):',
    validate: (v) => v.trim() ? undefined : 'Filename is required',
  });
  if (typeof lorebookName === 'symbol') return;

  const settingsKey = await text({
    message: 'Settings key path for the lorebook list:',
    initialValue: 'world_info.globalSelect',
    validate: (v) => v.trim() ? undefined : 'Key is required',
  });
  if (typeof settingsKey === 'symbol') return;

  const users = await selectUsers(config);
  if (users.length === 0) return;

  const proceed = await confirm({
    message: `Add "${lorebookName}" to "${settingsKey}" for ${users.length} user(s)?`,
  });
  if (typeof proceed === 'symbol' || !proceed) return;

  await batchOperation(users, async (handle) => {
    const settingsPath = userSettingsPath(config.dataRoot, handle);

    if (!existsSync(settingsPath)) {
      return { skipped: 'no settings.json' };
    }

    const settings = readSettings(settingsPath);
    if (settings === null) {
      return { skipped: 'no settings.json' };
    }

    if (!config.dryRun) {
      backupUserFile(config.dataRoot, handle, 'settings.json');
    }

    // Get the current array at the key path, or create one
    const currentList = lodashGet(settings, settingsKey, []);
    const list = Array.isArray(currentList) ? currentList : [];

    // Add the lorebook name if not already present
    if (!list.includes(lorebookName.trim())) {
      list.push(lorebookName.trim());
    }

    const updated = applyMutations(settings, [{ path: settingsKey, value: list }]);

    if (config.dryRun) {
      info(`[DRY RUN] Would add "${lorebookName}" to ${settingsKey} in ${settingsPath}`);
    } else {
      writeSettings(settingsPath, updated);
    }

    return 'success';
  }, 'Link Lorebook');
}

/**
 * Main entry point.
 * @param {object} config
 */
export async function run(config) {
  const mode = await select({
    message: 'How would you like to edit settings?',
    options: [
      { value: 'keys',     label: 'Set specific key/value pairs',   hint: 'enter dot-paths and values' },
      { value: 'template', label: 'Sync from golden template',      hint: 'pick sections from a template file' },
      { value: 'lorebook', label: 'Link character lorebook',        hint: 'add lorebook to settings array' },
    ],
  });
  if (typeof mode === 'symbol') return;

  if (mode === 'keys') await setKeyValues(config);
  else if (mode === 'template') await syncFromTemplate(config);
  else if (mode === 'lorebook') await linkLorebook(config);
}
