import { select, text, multiselect, confirm, log } from '@clack/prompts';
import {
  existsSync, lstatSync, readlinkSync, symlinkSync,
  unlinkSync, readdirSync, mkdirSync
} from 'node:fs';
import { join, resolve, basename } from 'node:path';
import chalk from 'chalk';
import { selectUsers } from '../users.js';
import { batchOperation } from '../batch.js';
import { backupUserFile } from '../backup.js';
import { userWorldsDir } from '../lib/st-paths.js';
import { readIndex } from '../lib/content-index.js';
import { scaffoldIndexPath } from '../lib/st-paths.js';
import { printHeader, info, warn } from '../ui.js';

/**
 * List lorebook JSON files available in the scaffold worlds directory.
 * @param {string} scaffoldDir
 * @returns {string[]} Filenames
 */
function listScaffoldLorebooks(scaffoldDir) {
  const worldsDir = join(scaffoldDir, 'worlds');
  try {
    return readdirSync(worldsDir).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
}

/**
 * Check if a lorebook filename is also in the scaffold index.json (which would
 * cause the seeder to overwrite symlinks on restart).
 * @param {string} scaffoldDir
 * @param {string} filename
 * @returns {boolean}
 */
function isInScaffoldIndex(scaffoldDir, filename) {
  const indexPath = scaffoldIndexPath(scaffoldDir);
  const index = readIndex(indexPath);
  return index.some(e => e.filename === filename && e.type === 'world');
}

/**
 * Create a symlink for a single user, handling existing files.
 * @param {string} sourceAbsolute - Absolute path to the source lorebook
 * @param {string} targetPath - Absolute path where the symlink should be created
 * @param {string} handle - User handle (for logging)
 * @param {'ask'|'all'|'skip'} overridePolicy - How to handle existing files
 * @param {boolean} dryRun
 * @returns {'created'|'already-linked'|'replaced'|'skipped'}
 */
function createSymlinkForUser(sourceAbsolute, targetPath, handle, overridePolicy, dryRun) {
  if (existsSync(targetPath) || lstatExists(targetPath)) {
    const stat = lstatSync(targetPath);

    if (stat.isSymbolicLink()) {
      const currentTarget = readlinkSync(targetPath);
      if (resolve(currentTarget) === resolve(sourceAbsolute)) {
        return 'already-linked';
      }
      // Symlink to a different target
      if (overridePolicy === 'skip') return 'skipped';

      if (dryRun) {
        info(`[DRY RUN] Would replace symlink for ${handle}: ${currentTarget} -> ${sourceAbsolute}`);
        return 'replaced';
      }

      unlinkSync(targetPath);
    } else {
      // Regular file exists
      if (overridePolicy === 'skip') return 'skipped';

      if (dryRun) {
        info(`[DRY RUN] Would backup and replace file for ${handle}`);
        return 'replaced';
      }

      // The caller should have already backed up the file
      unlinkSync(targetPath);
    }
  }

  if (dryRun) {
    info(`[DRY RUN] Would create symlink: ${targetPath} -> ${sourceAbsolute}`);
    return 'created';
  }

  // Ensure the worlds directory exists
  mkdirSync(join(targetPath, '..'), { recursive: true });
  symlinkSync(sourceAbsolute, targetPath);
  return 'created';
}

/**
 * Check if an lstat would succeed (exists including broken symlinks).
 * @param {string} path
 * @returns {boolean}
 */
function lstatExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Main entry point.
 * @param {object} config
 */
export async function run(config) {
  const scaffoldWorldsDir = join(config.scaffoldDir, 'worlds');
  const available = listScaffoldLorebooks(config.scaffoldDir);

  let sourceFiles;

  if (available.length > 0) {
    const choice = await select({
      message: 'Select source lorebook(s):',
      options: [
        { value: 'pick',   label: 'Pick from scaffold/worlds/' },
        { value: 'custom', label: 'Enter a custom path' },
      ],
    });
    if (typeof choice === 'symbol') return;

    if (choice === 'pick') {
      const selected = await multiselect({
        message: 'Select lorebook(s) to symlink:',
        options: available.map(f => ({ value: f, label: f })),
        required: true,
      });
      if (typeof selected === 'symbol') return;

      sourceFiles = selected.map(f => ({
        filename: f,
        absolutePath: resolve(join(scaffoldWorldsDir, f)),
      }));
    } else {
      const customPath = await text({
        message: 'Absolute path to the lorebook JSON file:',
        validate: (v) => {
          if (!v.trim()) return 'Path is required';
          if (!existsSync(v.trim())) return 'File not found';
          return undefined;
        },
      });
      if (typeof customPath === 'symbol') return;

      sourceFiles = [{
        filename: basename(customPath),
        absolutePath: resolve(customPath),
      }];
    }
  } else {
    log.info(`No lorebooks found in ${scaffoldWorldsDir}. Enter a path manually.`);

    const customPath = await text({
      message: 'Absolute path to the lorebook JSON file:',
      validate: (v) => {
        if (!v.trim()) return 'Path is required';
        if (!existsSync(v.trim())) return 'File not found';
        return undefined;
      },
    });
    if (typeof customPath === 'symbol') return;

    sourceFiles = [{
      filename: basename(customPath),
      absolutePath: resolve(customPath),
    }];
  }

  // Warn if any selected lorebooks are in the scaffold index (seeder conflict)
  for (const { filename } of sourceFiles) {
    if (isInScaffoldIndex(config.scaffoldDir, filename)) {
      warn(
        `"${filename}" is also listed in scaffold/index.json as type "world".\n` +
        '    The SillyTavern seeder may overwrite symlinks with copies on restart.\n' +
        '    Consider removing it from the scaffold index to avoid conflicts.'
      );
    }
  }

  const users = await selectUsers(config);
  if (users.length === 0) return;

  // Ask about override policy
  const policy = await select({
    message: 'If a file already exists in a user\'s worlds/ directory:',
    options: [
      { value: 'all',  label: 'Replace all (backup originals first)' },
      { value: 'skip', label: 'Skip — keep existing files' },
    ],
  });
  if (typeof policy === 'symbol') return;

  const proceed = await confirm({
    message: `Create symlinks for ${sourceFiles.length} lorebook(s) across ${users.length} user(s)?`,
  });
  if (typeof proceed === 'symbol' || !proceed) return;

  for (const { filename, absolutePath } of sourceFiles) {
    printHeader(`Symlinking: ${filename}`);

    await batchOperation(users, async (handle) => {
      const worldsDir = userWorldsDir(config.dataRoot, handle);
      const targetPath = join(worldsDir, filename);

      // Backup existing regular file before replacement
      if (policy === 'all' && existsSync(targetPath)) {
        const stat = lstatSync(targetPath);
        if (!stat.isSymbolicLink()) {
          backupUserFile(config.dataRoot, handle, `worlds/${filename}`, config.dryRun);
        }
      }

      const result = createSymlinkForUser(
        absolutePath, targetPath, handle, policy, config.dryRun
      );

      if (result === 'already-linked') {
        return { skipped: 'already symlinked to same source' };
      }
      if (result === 'skipped') {
        return { skipped: 'existing file preserved' };
      }

      return 'success';
    }, `Symlink ${filename}`);
  }
}
