import { select, text, confirm, log } from '@clack/prompts';
import { existsSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { selectUsers } from '../users.js';
import { batchOperation } from '../batch.js';
import { backupUserFile } from '../backup.js';
import { info } from '../ui.js';

/** Content type to subdirectory mapping. */
const CONTENT_DIRS = {
  character: 'characters',
  world:     'worlds',
  chat:      'chats',
};

/**
 * Main entry point: delete a specific file from selected users.
 * @param {object} config
 */
export async function run(config) {
  const contentType = await select({
    message: 'What type of content to delete?',
    options: [
      { value: 'character', label: 'Character card (.png)',     hint: 'from characters/' },
      { value: 'world',     label: 'World/Lorebook (.json)',    hint: 'from worlds/' },
    ],
  });
  if (typeof contentType === 'symbol') return;

  const subDir = CONTENT_DIRS[contentType];

  const filename = await text({
    message: `Filename to delete (e.g. "OldChar.png" or "OldLore.json"):`,
    validate: (v) => v.trim() ? undefined : 'Filename is required',
  });
  if (typeof filename === 'symbol') return;

  const users = await selectUsers(config);
  if (users.length === 0) return;

  // Preview: check how many users actually have this file
  let count = 0;
  for (const handle of users) {
    if (existsSync(join(config.dataRoot, handle, subDir, filename.trim()))) {
      count++;
    }
  }

  log.info(`Found "${filename}" in ${count} of ${users.length} user directories.`);

  if (count === 0) {
    log.info('Nothing to delete.');
    return;
  }

  const backupFirst = await confirm({
    message: 'Create backups before deleting?',
    initialValue: true,
  });
  if (typeof backupFirst === 'symbol') return;

  const proceed = await confirm({
    message: chalk.red(`DELETE "${filename}" from ${count} user(s)? This cannot be undone without backups.`),
  });
  if (typeof proceed === 'symbol' || !proceed) return;

  await batchOperation(users, async (handle) => {
    const filePath = join(config.dataRoot, handle, subDir, filename.trim());

    if (!existsSync(filePath)) {
      return { skipped: 'file not found' };
    }

    if (config.dryRun) {
      info(`[DRY RUN] Would delete ${filePath}`);
      return 'success';
    }

    if (backupFirst) {
      backupUserFile(config.dataRoot, handle, `${subDir}/${filename.trim()}`);
    }

    unlinkSync(filePath);
    return 'success';
  }, `Delete ${filename}`);
}
