import { select, log } from '@clack/prompts';
import chalk from 'chalk';
import { discoverUsers, getUserStats } from '../users.js';
import { printHeader, formatBytes } from '../ui.js';
import { userDir } from '../lib/st-paths.js';
import { readdirSync, statSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Get disk usage for a directory using du.
 * @param {string} dirPath
 * @returns {string} Human-readable size
 */
function getDiskUsage(dirPath) {
  try {
    const output = execSync(`du -sh "${dirPath}" 2>/dev/null`, { encoding: 'utf-8' });
    return output.split('\t')[0].trim();
  } catch {
    return 'N/A';
  }
}

/**
 * Display a summary table of all users.
 * @param {object} config
 */
function listAllUsers(config) {
  const users = discoverUsers(config.dataRoot, config.excludeDirs);

  if (users.length === 0) {
    log.warn('No users found.');
    return;
  }

  printHeader(`All Users (${users.length})`);

  // Table header
  console.log(
    chalk.bold('  ') +
    chalk.bold('User Handle'.padEnd(25)) +
    chalk.bold('Chars'.padStart(7)) +
    chalk.bold('Chats'.padStart(7)) +
    chalk.bold('Worlds'.padStart(8)) +
    chalk.bold('Settings'.padStart(10))
  );
  console.log(chalk.dim('  ' + '─'.repeat(57)));

  for (const handle of users) {
    const stats = getUserStats(config.dataRoot, handle);
    console.log(
      '  ' +
      handle.padEnd(25) +
      String(stats.characterCount).padStart(7) +
      String(stats.chatDirCount).padStart(7) +
      String(stats.worldCount).padStart(8) +
      (stats.hasSettings ? chalk.green('  Yes') : chalk.red('   No')).padStart(10)
    );
  }

  console.log('');
}

/**
 * Display detailed info for a single user.
 * @param {object} config
 * @param {string} handle
 */
function viewUserDetails(config, handle) {
  const dir = userDir(config.dataRoot, handle);
  const stats = getUserStats(config.dataRoot, handle);
  const diskUsage = getDiskUsage(dir);

  printHeader(`User: ${handle}`);

  console.log(`  ${chalk.bold('Directory:')}  ${dir}`);
  console.log(`  ${chalk.bold('Disk Usage:')} ${diskUsage}`);
  console.log(`  ${chalk.bold('Characters:')} ${stats.characterCount}`);
  console.log(`  ${chalk.bold('Chat Dirs:')}  ${stats.chatDirCount}`);
  console.log(`  ${chalk.bold('Worlds:')}     ${stats.worldCount}`);
  console.log(`  ${chalk.bold('Settings:')}   ${stats.hasSettings ? chalk.green('Yes') : chalk.red('No')}`);

  // List character files
  try {
    const charsDir = join(dir, 'characters');
    const chars = readdirSync(charsDir).filter(f => f.endsWith('.png'));
    if (chars.length > 0) {
      console.log(`\n  ${chalk.bold('Characters:')}`);
      for (const c of chars.slice(0, 20)) {
        console.log(chalk.dim(`    - ${c}`));
      }
      if (chars.length > 20) {
        console.log(chalk.dim(`    ... and ${chars.length - 20} more`));
      }
    }
  } catch { /* no characters dir */ }

  // List world files and show symlink status
  try {
    const worldsDir = join(dir, 'worlds');
    const worlds = readdirSync(worldsDir).filter(f => f.endsWith('.json'));
    if (worlds.length > 0) {
      console.log(`\n  ${chalk.bold('Worlds (Lorebooks):')}`);
      for (const w of worlds) {
        const wPath = join(worldsDir, w);
        const lstat = lstatSync(wPath);
        const symTag = lstat.isSymbolicLink() ? chalk.cyan(' [symlink]') : '';
        console.log(chalk.dim(`    - ${w}`) + symTag);
      }
    }
  } catch { /* no worlds dir */ }

  console.log('');
}

/**
 * Main entry point for the user-info module.
 * @param {object} config
 */
export async function run(config) {
  const action = await select({
    message: 'User information:',
    options: [
      { value: 'list', label: 'List all users with stats' },
      { value: 'detail', label: 'View details for a specific user' },
    ],
  });

  if (typeof action === 'symbol') return;

  if (action === 'list') {
    listAllUsers(config);
    return;
  }

  // Select a specific user
  const users = discoverUsers(config.dataRoot, config.excludeDirs);
  const handle = await select({
    message: 'Select a user:',
    options: users.map(h => ({ value: h, label: h })),
  });

  if (typeof handle === 'symbol') return;

  viewUserDetails(config, handle);
}
