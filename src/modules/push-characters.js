import { select, text, confirm, log } from '@clack/prompts';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { selectUsers } from '../users.js';
import { batchOperation } from '../batch.js';
import { userCharactersDir } from '../lib/st-paths.js';
import { readIndex, addEntry, writeIndex } from '../lib/content-index.js';
import { info } from '../ui.js';

/**
 * Immediate push: copy a character card PNG to selected users.
 * @param {object} config
 */
async function immediatePush(config) {
  const sourcePath = await text({
    message: 'Path to the character card PNG:',
    validate: (v) => {
      if (!v.trim()) return 'Path is required';
      if (!existsSync(v.trim())) return 'File not found';
      if (!v.trim().endsWith('.png')) return 'File must be a .png';
      return undefined;
    },
  });
  if (typeof sourcePath === 'symbol') return;

  const filename = basename(sourcePath);
  log.info(`Character card: ${filename}`);

  const users = await selectUsers(config);
  if (users.length === 0) return;

  const proceed = await confirm({
    message: `Push "${filename}" to ${users.length} user(s)?`,
  });
  if (typeof proceed === 'symbol' || !proceed) return;

  await batchOperation(users, async (handle) => {
    const targetDir = userCharactersDir(config.dataRoot, handle);
    const targetPath = join(targetDir, filename);

    if (config.dryRun) {
      info(`[DRY RUN] Would copy ${sourcePath} -> ${targetPath}`);
      return 'success';
    }

    mkdirSync(targetDir, { recursive: true });
    copyFileSync(sourcePath, targetPath);
    return 'success';
  }, 'Push Character Card');
}

/**
 * Scaffold-based push: add to scaffold/content index and optionally push immediately.
 * @param {object} config
 */
async function scaffoldPush(config) {
  const sourcePath = await text({
    message: 'Path to the character card PNG:',
    validate: (v) => {
      if (!v.trim()) return 'Path is required';
      if (!existsSync(v.trim())) return 'File not found';
      if (!v.trim().endsWith('.png')) return 'File must be a .png';
      return undefined;
    },
  });
  if (typeof sourcePath === 'symbol') return;

  const filename = basename(sourcePath);

  const target = await select({
    message: 'Add to which index?',
    options: [
      { value: 'scaffold', label: 'Scaffold (default/scaffold/index.json)', hint: 'for structural defaults' },
      { value: 'content',  label: 'Content (default/content/index.json)',   hint: 'for distributed content' },
    ],
  });
  if (typeof target === 'symbol') return;

  const targetDir = target === 'scaffold' ? config.scaffoldDir : config.contentDir;
  const indexPath = join(targetDir, 'index.json');

  // Copy the PNG into the target directory
  if (config.dryRun) {
    info(`[DRY RUN] Would copy ${sourcePath} -> ${join(targetDir, filename)}`);
    info(`[DRY RUN] Would add entry to ${indexPath}`);
  } else {
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(sourcePath, join(targetDir, filename));

    // Add entry to index.json
    const index = readIndex(indexPath);
    const newEntry = { filename, type: 'character' };
    const updated = addEntry(index, newEntry);
    writeIndex(indexPath, updated);
    log.success(`Added "${filename}" to ${indexPath}`);
  }

  // Optionally push to existing users now
  const pushNow = await confirm({
    message: 'Also push to existing users right now?',
  });

  if (typeof pushNow === 'symbol' || !pushNow) {
    log.info('Done. The card will be seeded to new users on next ST restart.');
    return;
  }

  const users = await selectUsers(config);
  if (users.length === 0) return;

  await batchOperation(users, async (handle) => {
    const userCharsDir = userCharactersDir(config.dataRoot, handle);
    const targetPath = join(userCharsDir, filename);

    if (config.dryRun) {
      info(`[DRY RUN] Would copy ${sourcePath} -> ${targetPath}`);
      return 'success';
    }

    mkdirSync(userCharsDir, { recursive: true });
    copyFileSync(sourcePath, targetPath);
    return 'success';
  }, 'Push Character Card to Existing Users');
}

/**
 * Main entry point.
 * @param {object} config
 */
export async function run(config) {
  const mode = await select({
    message: 'How would you like to push character cards?',
    options: [
      { value: 'immediate', label: 'Immediate push',    hint: 'copy directly to user directories' },
      { value: 'scaffold',  label: 'Scaffold-based',    hint: 'add to index + optionally push now' },
    ],
  });

  if (typeof mode === 'symbol') return;

  if (mode === 'immediate') {
    await immediatePush(config);
  } else {
    await scaffoldPush(config);
  }
}
