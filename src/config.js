import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { text, confirm, intro, log } from '@clack/prompts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(join(__dirname, '..', 'config.json'));

const REQUIRED_KEYS = ['stRoot', 'dataRoot', 'scaffoldDir', 'contentDir', 'backupRoot'];

const DEFAULTS = {
  stRoot: '/root/SillyTavern',
  dataRoot: '/root/SillyTavern/data',
  scaffoldDir: '/root/SillyTavern/data/default/scaffold',
  contentDir: '/root/SillyTavern/data/default/content',
  backupRoot: '/root/SillyTavern/data/_admin-backups',
  excludeDirs: ['default', '_storage'],
  serverPort: 8000,
  pm2Name: 'sillytavern',
  dryRun: false,
};

/**
 * Interactively create a config.json when one doesn't exist.
 * @returns {object} The new config
 */
async function createConfigInteractively() {
  log.warn('No config.json found. Let\'s set one up.');

  const stRoot = await text({
    message: 'SillyTavern root directory:',
    initialValue: DEFAULTS.stRoot,
    validate: (v) => v.trim() ? undefined : 'Path is required',
  });
  if (typeof stRoot === 'symbol') process.exit(0);

  const dataRoot = await text({
    message: 'SillyTavern data directory:',
    initialValue: `${stRoot}/data`,
    validate: (v) => v.trim() ? undefined : 'Path is required',
  });
  if (typeof dataRoot === 'symbol') process.exit(0);

  const pm2Name = await text({
    message: 'pm2 process name for SillyTavern:',
    initialValue: DEFAULTS.pm2Name,
  });
  if (typeof pm2Name === 'symbol') process.exit(0);

  const serverPort = await text({
    message: 'SillyTavern server port:',
    initialValue: String(DEFAULTS.serverPort),
    validate: (v) => /^\d+$/.test(v.trim()) ? undefined : 'Must be a number',
  });
  if (typeof serverPort === 'symbol') process.exit(0);

  const config = {
    stRoot,
    dataRoot,
    scaffoldDir: `${dataRoot}/default/scaffold`,
    contentDir: `${dataRoot}/default/content`,
    backupRoot: `${dataRoot}/_admin-backups`,
    excludeDirs: DEFAULTS.excludeDirs,
    serverPort: parseInt(serverPort, 10),
    pm2Name,
    dryRun: false,
  };

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
  log.success(`Config written to ${CONFIG_PATH}`);
  return config;
}

/**
 * Validate that required config paths exist on the filesystem.
 * Warns for missing paths but doesn't hard-fail (may be running locally in dev).
 * @param {object} config
 */
function validatePaths(config) {
  const missing = [];
  for (const key of ['stRoot', 'dataRoot']) {
    if (!existsSync(config[key])) {
      missing.push(`  ${key}: ${config[key]}`);
    }
  }
  if (missing.length > 0) {
    log.warn(
      `Some configured paths don't exist on this machine:\n${missing.join('\n')}\n` +
      'This is expected if you\'re running locally for development.'
    );
  }
}

/**
 * Load and validate the config. Creates interactively if missing.
 * @returns {Promise<object>} Frozen config object
 */
export async function loadConfig() {
  let config;

  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      config = JSON.parse(raw);
    } catch (err) {
      log.error(`Failed to parse config.json: ${err.message}`);
      process.exit(1);
    }
  } else {
    config = await createConfigInteractively();
  }

  // Fill in any missing keys with defaults
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (config[key] === undefined) {
      config[key] = value;
    }
  }

  // Validate required keys are present
  for (const key of REQUIRED_KEYS) {
    if (!config[key]) {
      log.error(`Missing required config key: ${key}`);
      process.exit(1);
    }
  }

  validatePaths(config);

  return Object.freeze(config);
}
