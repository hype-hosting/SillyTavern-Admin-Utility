import { select, confirm, log } from '@clack/prompts';
import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { selectUsers } from '../users.js';
import { batchOperation } from '../batch.js';
import { backupUserFile } from '../backup.js';
import { userContentLogPath } from '../lib/st-paths.js';
import { info } from '../ui.js';

/**
 * Delete content.log entirely for selected users (full re-seed on next restart).
 * @param {object} config
 */
async function fullReset(config) {
  const users = await selectUsers(config);
  if (users.length === 0) return;

  const proceed = await confirm({
    message: `Delete content.log for ${users.length} user(s)?\nThis will cause ALL scaffold content to be re-seeded on next ST restart.`,
  });
  if (typeof proceed === 'symbol' || !proceed) return;

  await batchOperation(users, async (handle) => {
    const logPath = userContentLogPath(config.dataRoot, handle);

    if (!existsSync(logPath)) {
      return { skipped: 'no content.log' };
    }

    if (config.dryRun) {
      info(`[DRY RUN] Would delete ${logPath}`);
      return 'success';
    }

    backupUserFile(config.dataRoot, handle, 'content.log');
    unlinkSync(logPath);
    return 'success';
  }, 'Reset Content Log');

  log.info('Restart SillyTavern (menu item 5) to trigger re-seeding.');
}

/**
 * View content.log for a user (informational).
 * @param {object} config
 */
async function viewContentLog(config) {
  const users = await selectUsers(config);
  if (users.length === 0) return;

  for (const handle of users) {
    const logPath = userContentLogPath(config.dataRoot, handle);

    if (!existsSync(logPath)) {
      console.log(`  ${handle}: (no content.log)`);
      continue;
    }

    const content = readFileSync(logPath, 'utf-8').trim();
    const lines = content.split('\n').filter(l => l.trim());
    console.log(`  ${handle}: ${lines.length} entries`);
    for (const line of lines) {
      console.log(`    - ${line}`);
    }
  }
  console.log('');
}

/**
 * Main entry point.
 * @param {object} config
 */
export async function run(config) {
  const action = await select({
    message: 'Content log operations:',
    options: [
      { value: 'reset', label: 'Full reset (delete content.log)', hint: 're-seeds all content on restart' },
      { value: 'view',  label: 'View content.log entries',        hint: 'see what has been seeded' },
    ],
  });
  if (typeof action === 'symbol') return;

  if (action === 'reset') await fullReset(config);
  else if (action === 'view') await viewContentLog(config);
}
