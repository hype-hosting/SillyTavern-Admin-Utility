import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { info } from './ui.js';

/**
 * Generate a timestamp string suitable for filenames.
 * @returns {string} e.g. "2025-01-15-143022"
 */
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').slice(0, 19);
}

/**
 * Create a timestamped backup of a file.
 * @param {string} filePath - Absolute path to the file to back up
 * @param {string} backupDir - Directory to store the backup in
 * @returns {string} Path to the backup file
 */
export function backupFile(filePath, backupDir) {
  if (!existsSync(filePath)) {
    return null;
  }

  const backupName = `${basename(filePath)}.${timestamp()}.bak`;
  const backupPath = join(backupDir, backupName);

  mkdirSync(backupDir, { recursive: true });
  copyFileSync(filePath, backupPath);

  return backupPath;
}

/**
 * Backup a user's file into their own backups/admin-snapshots/ directory.
 * @param {string} dataRoot - Data root directory
 * @param {string} handle - User handle
 * @param {string} relativeFilePath - Path relative to user directory (e.g. "settings.json")
 * @param {boolean} [dryRun=false] - If true, log instead of acting
 * @returns {string|null} Path to backup file, or null if skipped/dry-run
 */
export function backupUserFile(dataRoot, handle, relativeFilePath, dryRun = false) {
  const source = join(dataRoot, handle, relativeFilePath);
  const backupDir = join(dataRoot, handle, 'backups', 'admin-snapshots');

  if (!existsSync(source)) {
    return null;
  }

  if (dryRun) {
    info(`[DRY RUN] Would backup ${source} -> ${backupDir}/`);
    return null;
  }

  return backupFile(source, backupDir);
}

/**
 * Backup a file into the centralized admin backup directory.
 * @param {string} backupRoot - Admin backup root (e.g. _admin-backups)
 * @param {string} filePath - File to back up
 * @param {string} label - Subfolder label (e.g. "bulk-settings")
 * @param {boolean} [dryRun=false]
 * @returns {string|null}
 */
export function backupToAdmin(backupRoot, filePath, label, dryRun = false) {
  const dir = join(backupRoot, `${label}-${timestamp()}`);

  if (dryRun) {
    info(`[DRY RUN] Would backup ${filePath} -> ${dir}/`);
    return null;
  }

  return backupFile(filePath, dir);
}
