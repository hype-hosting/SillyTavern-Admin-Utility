import { join } from 'node:path';

/**
 * Get the absolute path to a user's directory.
 * @param {string} dataRoot
 * @param {string} handle
 * @returns {string}
 */
export function userDir(dataRoot, handle) {
  return join(dataRoot, handle);
}

/**
 * Get the path to a user's characters directory.
 * @param {string} dataRoot
 * @param {string} handle
 * @returns {string}
 */
export function userCharactersDir(dataRoot, handle) {
  return join(dataRoot, handle, 'characters');
}

/**
 * Get the path to a user's worlds (lorebooks) directory.
 * @param {string} dataRoot
 * @param {string} handle
 * @returns {string}
 */
export function userWorldsDir(dataRoot, handle) {
  return join(dataRoot, handle, 'worlds');
}

/**
 * Get the path to a user's chats directory.
 * @param {string} dataRoot
 * @param {string} handle
 * @returns {string}
 */
export function userChatsDir(dataRoot, handle) {
  return join(dataRoot, handle, 'chats');
}

/**
 * Get the path to a user's settings.json.
 * @param {string} dataRoot
 * @param {string} handle
 * @returns {string}
 */
export function userSettingsPath(dataRoot, handle) {
  return join(dataRoot, handle, 'settings.json');
}

/**
 * Get the path to a user's content.log.
 * @param {string} dataRoot
 * @param {string} handle
 * @returns {string}
 */
export function userContentLogPath(dataRoot, handle) {
  return join(dataRoot, handle, 'content.log');
}

/**
 * Get the path to the cookie-secret.txt file.
 * @param {string} dataRoot
 * @returns {string}
 */
export function cookieSecretPath(dataRoot) {
  return join(dataRoot, 'cookie-secret.txt');
}

/**
 * Get the path to a scaffold index.json.
 * @param {string} scaffoldDir
 * @returns {string}
 */
export function scaffoldIndexPath(scaffoldDir) {
  return join(scaffoldDir, 'index.json');
}

/**
 * Get the path to the content index.json.
 * @param {string} contentDir
 * @returns {string}
 */
export function contentIndexPath(contentDir) {
  return join(contentDir, 'index.json');
}
