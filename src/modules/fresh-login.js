import { confirm, log, spinner } from '@clack/prompts';
import { existsSync, unlinkSync } from 'node:fs';
import { cookieSecretPath } from '../lib/st-paths.js';
import { restartServer, checkServerHealth, getServerStatus } from '../lib/process-manager.js';
import { info } from '../ui.js';

/**
 * Main entry point: delete cookie-secret.txt and restart the server.
 * @param {object} config
 */
export async function run(config) {
  const secretPath = cookieSecretPath(config.dataRoot);

  // Show current server status
  const status = getServerStatus(config.pm2Name);
  if (status) {
    log.info(`Server status: ${status.status} | uptime: ${status.uptime} | restarts: ${status.restarts}`);
  }

  // Check if cookie-secret.txt exists
  if (!existsSync(secretPath)) {
    log.info('cookie-secret.txt does not exist. Sessions are already cleared.');
    const restartAnyway = await confirm({
      message: 'Restart the server anyway?',
    });
    if (typeof restartAnyway === 'symbol' || !restartAnyway) return;
  } else {
    const proceed = await confirm({
      message: 'This will delete cookie-secret.txt and restart SillyTavern.\n  ALL active user sessions will be invalidated (users must log in again).\n  Continue?',
    });
    if (typeof proceed === 'symbol' || !proceed) return;

    if (config.dryRun) {
      info(`[DRY RUN] Would delete ${secretPath}`);
      info(`[DRY RUN] Would run: pm2 restart ${config.pm2Name}`);
      return;
    }

    // Delete cookie-secret.txt
    try {
      unlinkSync(secretPath);
      log.success('Deleted cookie-secret.txt');
    } catch (err) {
      log.error(`Failed to delete cookie-secret.txt: ${err.message}`);
      return;
    }
  }

  if (config.dryRun) {
    info(`[DRY RUN] Would restart server via pm2`);
    return;
  }

  // Restart server
  const s = spinner();
  s.start('Restarting SillyTavern via pm2...');

  const result = restartServer(config.pm2Name);

  if (!result.success) {
    s.stop(`Restart failed: ${result.message}`);
    return;
  }

  s.message('Waiting for server to come back up...');

  // Wait up to 15 seconds for the server to respond
  let healthy = false;
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 3000));
    healthy = await checkServerHealth(config.serverPort);
    if (healthy) break;
  }

  if (healthy) {
    s.stop('Server restarted successfully and is responding.');
  } else {
    s.stop('Server restarted but is not yet responding. It may still be starting up.');
    log.info(`Check manually: pm2 logs ${config.pm2Name}`);
  }
}
