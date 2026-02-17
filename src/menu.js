import { select, log } from '@clack/prompts';
import chalk from 'chalk';
import { printBanner } from './ui.js';

/**
 * Module registry: maps action keys to their module paths and labels.
 */
const MODULES = {
  'push-chars':       { path: './modules/push-characters.js',   label: 'Push Character Cards' },
  'bulk-settings':    { path: './modules/bulk-settings.js',      label: 'Bulk Edit settings.json' },
  'lorebook-symlinks':{ path: './modules/lorebook-symlinks.js',  label: 'Create Lorebook Symlinks' },
  'scaffold-editor':  { path: './modules/scaffold-editor.js',    label: 'Edit Scaffold index.json' },
  'fresh-login':      { path: './modules/fresh-login.js',        label: 'Fresh Login Reset' },
  'user-info':        { path: './modules/user-info.js',          label: 'List Users / View Details' },
  'backup-ops':       { path: './modules/backup-ops.js',         label: 'Backup Operations' },
  'bulk-delete':      { path: './modules/bulk-delete.js',        label: 'Bulk Delete Content' },
  'reset-content-log':{ path: './modules/reset-content-log.js',  label: 'Reset Content Log' },
};

/**
 * Run the selected module.
 * @param {string} action - Module key
 * @param {object} config
 */
async function routeAction(action, config) {
  const mod = MODULES[action];
  if (!mod) {
    log.error(`Unknown action: ${action}`);
    return;
  }

  try {
    const module = await import(mod.path);
    await module.run(config);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      log.warn(`Module "${mod.label}" is not yet implemented.`);
    } else {
      log.error(`Error in "${mod.label}": ${err.message}`);
      if (process.env.DEBUG) console.error(err);
    }
  }
}

/**
 * Main menu loop. Displays the menu and routes to modules until the user exits.
 * @param {object} config
 */
export async function mainMenu(config) {
  printBanner();

  if (config.dryRun) {
    console.log(chalk.yellow.bold('\n  DRY RUN MODE — no changes will be made\n'));
  }

  while (true) {
    const action = await select({
      message: 'What would you like to do?',
      options: [
        { value: 'push-chars',        label: 'Push Character Cards',       hint: 'copy cards to users' },
        { value: 'bulk-settings',     label: 'Bulk Edit settings.json',    hint: 'edit user settings' },
        { value: 'lorebook-symlinks', label: 'Create Lorebook Symlinks',   hint: 'scaffold → users' },
        { value: 'scaffold-editor',   label: 'Edit Scaffold index.json',   hint: 'manage scaffold entries' },
        { value: 'fresh-login',       label: 'Fresh Login Reset',          hint: 'clear sessions + restart' },
        { value: 'separator-1',       label: chalk.dim('───────────────────────────'), hint: '' },
        { value: 'user-info',         label: 'List Users / View Details',  hint: 'user stats' },
        { value: 'backup-ops',        label: 'Backup Operations',          hint: 'bulk backups' },
        { value: 'bulk-delete',       label: 'Bulk Delete Content',        hint: 'remove files from users' },
        { value: 'reset-content-log', label: 'Reset Content Log',          hint: 're-trigger seeding' },
        { value: 'separator-2',       label: chalk.dim('───────────────────────────'), hint: '' },
        { value: 'exit',              label: 'Exit' },
      ],
    });

    // User pressed Ctrl+C or selected exit
    if (typeof action === 'symbol' || action === 'exit') {
      console.log(chalk.dim('\n  Goodbye!\n'));
      break;
    }

    // Skip separator items
    if (action.startsWith('separator')) continue;

    await routeAction(action, config);
  }
}
