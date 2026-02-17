import chalk from 'chalk';

const VERSION = '1.0.0';

/**
 * Print the application banner.
 */
export function printBanner() {
  const banner = `
${chalk.cyan('╔══════════════════════════════════════════╗')}
${chalk.cyan('║')}    ${chalk.bold.white('TIMELESS ADMIN UTILITY')} ${chalk.dim(`v${VERSION}`)}        ${chalk.cyan('║')}
${chalk.cyan('║')}    ${chalk.dim('SillyTavern Instance Manager')}         ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════╝')}`;
  console.log(banner);
}

/**
 * Print a section header.
 * @param {string} title
 */
export function printHeader(title) {
  console.log(`\n${chalk.bold.cyan('─── ' + title + ' ───')}\n`);
}

/**
 * Print a success message.
 * @param {string} msg
 */
export function success(msg) {
  console.log(chalk.green(`  [OK] ${msg}`));
}

/**
 * Print a warning message.
 * @param {string} msg
 */
export function warn(msg) {
  console.log(chalk.yellow(`  [WARN] ${msg}`));
}

/**
 * Print an error message.
 * @param {string} msg
 */
export function error(msg) {
  console.log(chalk.red(`  [ERR] ${msg}`));
}

/**
 * Print an info message.
 * @param {string} msg
 */
export function info(msg) {
  console.log(chalk.dim(`  ${msg}`));
}

/**
 * Print a batch results summary table.
 * @param {{ success: string[], skipped: Array<{handle: string, reason: string}>, failed: Array<{handle: string, error: string}> }} results
 * @param {string} label - Description of the operation
 */
export function printBatchReport(results, label) {
  console.log('');
  printHeader(`${label} — Results`);
  console.log(`  ${chalk.green('Success:')} ${results.success.length} users`);

  if (results.skipped.length > 0) {
    console.log(`  ${chalk.yellow('Skipped:')} ${results.skipped.length} users`);
    for (const { handle, reason } of results.skipped) {
      console.log(chalk.dim(`    - ${handle}: ${reason}`));
    }
  }

  if (results.failed.length > 0) {
    console.log(`  ${chalk.red('Failed:')}  ${results.failed.length} users`);
    for (const { handle, error: err } of results.failed) {
      console.log(chalk.red(`    - ${handle}: ${err}`));
    }
  }
  console.log('');
}

/**
 * Format a file size in bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
