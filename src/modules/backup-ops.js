import { select, confirm, log } from '@clack/prompts';
import { existsSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { discoverUsers } from '../users.js';
import { batchOperation } from '../batch.js';
import { userSettingsPath } from '../lib/st-paths.js';
import { printHeader, info } from '../ui.js';

/**
 * Generate a timestamped directory name.
 * @param {string} label
 * @returns {string}
 */
function timestampedDir(label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').slice(0, 19);
  return `${label}-${ts}`;
}

/**
 * Backup all users' settings.json files.
 * @param {object} config
 */
async function backupAllSettings(config) {
  const users = discoverUsers(config.dataRoot, config.excludeDirs);

  const proceed = await confirm({
    message: `Backup settings.json for all ${users.length} users?`,
  });
  if (typeof proceed === 'symbol' || !proceed) return;

  const backupDir = join(config.backupRoot, timestampedDir('settings-backup'));

  await batchOperation(users, async (handle) => {
    const settingsPath = userSettingsPath(config.dataRoot, handle);

    if (!existsSync(settingsPath)) {
      return { skipped: 'no settings.json' };
    }

    if (config.dryRun) {
      info(`[DRY RUN] Would backup ${settingsPath}`);
      return 'success';
    }

    const targetDir = join(backupDir, handle);
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(settingsPath, join(targetDir, 'settings.json'));
    return 'success';
  }, 'Backup Settings');

  if (!config.dryRun) {
    log.success(`Backups saved to: ${backupDir}`);
  }
}

/**
 * Backup a specific file type from all users.
 * @param {object} config
 */
async function backupSpecificFile(config) {
  const fileChoices = [
    { value: 'settings.json',  label: 'settings.json' },
    { value: 'secrets.json',   label: 'secrets.json' },
    { value: 'content.log',    label: 'content.log' },
  ];

  const fileToBackup = await select({
    message: 'Which file to backup?',
    options: fileChoices,
  });
  if (typeof fileToBackup === 'symbol') return;

  const users = discoverUsers(config.dataRoot, config.excludeDirs);

  const proceed = await confirm({
    message: `Backup ${fileToBackup} for all ${users.length} users?`,
  });
  if (typeof proceed === 'symbol' || !proceed) return;

  const label = fileToBackup.replace('.', '-');
  const backupDir = join(config.backupRoot, timestampedDir(`${label}-backup`));

  await batchOperation(users, async (handle) => {
    const filePath = join(config.dataRoot, handle, fileToBackup);

    if (!existsSync(filePath)) {
      return { skipped: `no ${fileToBackup}` };
    }

    if (config.dryRun) {
      info(`[DRY RUN] Would backup ${filePath}`);
      return 'success';
    }

    const targetDir = join(backupDir, handle);
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(filePath, join(targetDir, fileToBackup));
    return 'success';
  }, `Backup ${fileToBackup}`);

  if (!config.dryRun) {
    log.success(`Backups saved to: ${backupDir}`);
  }
}

/**
 * List existing admin backups.
 * @param {object} config
 */
function listBackups(config) {
  printHeader('Admin Backups');

  if (!existsSync(config.backupRoot)) {
    console.log('  No backups directory found.');
    return;
  }

  const dirs = readdirSync(config.backupRoot, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
    .reverse();

  if (dirs.length === 0) {
    console.log('  No backups found.');
    return;
  }

  for (const dir of dirs) {
    console.log(`  ${dir}`);
  }
  console.log(`\n  Location: ${config.backupRoot}\n`);
}

/**
 * Main entry point.
 * @param {object} config
 */
export async function run(config) {
  const action = await select({
    message: 'Backup operations:',
    options: [
      { value: 'settings', label: 'Backup all settings.json',    hint: 'quick backup of all user settings' },
      { value: 'specific', label: 'Backup a specific file type',  hint: 'choose which file to backup' },
      { value: 'list',     label: 'List existing backups' },
    ],
  });
  if (typeof action === 'symbol') return;

  if (action === 'settings') await backupAllSettings(config);
  else if (action === 'specific') await backupSpecificFile(config);
  else if (action === 'list') listBackups(config);
}
