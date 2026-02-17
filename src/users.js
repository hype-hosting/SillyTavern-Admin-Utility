import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { select, multiselect } from '@clack/prompts';

/**
 * Discover user handles by scanning the data directory.
 * Excludes configured non-user directories, dotfiles, and underscore-prefixed dirs.
 * @param {string} dataRoot - Path to the SillyTavern data directory
 * @param {string[]} excludeDirs - Directory names to exclude
 * @returns {string[]} Sorted list of user handles
 */
export function discoverUsers(dataRoot, excludeDirs) {
  let entries;
  try {
    entries = readdirSync(dataRoot, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read data directory "${dataRoot}": ${err.message}`);
  }

  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(name => !excludeDirs.includes(name))
    .filter(name => !name.startsWith('_'))
    .filter(name => !name.startsWith('.'))
    .sort();
}

/**
 * Interactive user selection prompt. Lets the admin choose "all users" or
 * pick specific users from a multi-select list.
 * @param {object} config - The app config
 * @returns {Promise<string[]>} Selected user handles
 */
export async function selectUsers(config) {
  const allUsers = discoverUsers(config.dataRoot, config.excludeDirs);

  if (allUsers.length === 0) {
    throw new Error('No users found in the data directory.');
  }

  const scope = await select({
    message: `Found ${allUsers.length} users. Select scope:`,
    options: [
      { value: 'all', label: `All users (${allUsers.length})` },
      { value: 'pick', label: 'Pick specific users' },
    ],
  });

  if (typeof scope === 'symbol') return []; // User cancelled

  if (scope === 'all') return allUsers;

  const selected = await multiselect({
    message: 'Select users (space to toggle, enter to confirm):',
    options: allUsers.map(h => ({ value: h, label: h })),
    required: true,
  });

  if (typeof selected === 'symbol') return []; // User cancelled

  return selected;
}

/**
 * Get basic stats for a user directory.
 * @param {string} dataRoot
 * @param {string} handle
 * @returns {{ characterCount: number, chatDirCount: number, worldCount: number, hasSettings: boolean }}
 */
export function getUserStats(dataRoot, handle) {
  const userDir = join(dataRoot, handle);
  const stats = {
    characterCount: 0,
    chatDirCount: 0,
    worldCount: 0,
    hasSettings: false,
  };

  try {
    const charsDir = join(userDir, 'characters');
    stats.characterCount = readdirSync(charsDir).filter(f => f.endsWith('.png')).length;
  } catch { /* directory may not exist */ }

  try {
    const chatsDir = join(userDir, 'chats');
    stats.chatDirCount = readdirSync(chatsDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).length;
  } catch { /* directory may not exist */ }

  try {
    const worldsDir = join(userDir, 'worlds');
    stats.worldCount = readdirSync(worldsDir).filter(f => f.endsWith('.json')).length;
  } catch { /* directory may not exist */ }

  try {
    statSync(join(userDir, 'settings.json'));
    stats.hasSettings = true;
  } catch { /* file may not exist */ }

  return stats;
}
