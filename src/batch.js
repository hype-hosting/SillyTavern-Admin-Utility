import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { printBatchReport } from './ui.js';

/**
 * @typedef {Object} BatchResults
 * @property {string[]} success - User handles that succeeded
 * @property {Array<{handle: string, reason: string}>} skipped - Skipped users
 * @property {Array<{handle: string, error: string}>} failed - Failed users
 */

/**
 * Run an operation for each user in the list, with progress tracking
 * and per-user error isolation.
 *
 * @param {string[]} users - User handles to operate on
 * @param {(handle: string) => Promise<'success'|{skipped: string}>} operationFn
 *   Async function called per user. Return 'success' or { skipped: 'reason' }.
 *   Throwing an error marks the user as failed.
 * @param {string} label - Human-readable label for the operation
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false] - If true, the operationFn should handle dry-run internally
 * @returns {Promise<BatchResults>}
 */
export async function batchOperation(users, operationFn, label, options = {}) {
  /** @type {BatchResults} */
  const results = { success: [], skipped: [], failed: [] };

  if (users.length === 0) {
    console.log(chalk.yellow('\n  No users selected. Skipping.\n'));
    return results;
  }

  const bar = new cliProgress.SingleBar({
    format: `  ${chalk.cyan('{bar}')} {percentage}% | {value}/{total} users | {status}`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: false,
  });

  console.log('');
  bar.start(users.length, 0, { status: 'Starting...' });

  for (const handle of users) {
    bar.update({ status: handle });
    try {
      const result = await operationFn(handle);
      if (result && typeof result === 'object' && result.skipped) {
        results.skipped.push({ handle, reason: result.skipped });
      } else {
        results.success.push(handle);
      }
    } catch (err) {
      results.failed.push({ handle, error: err.message });
    }
    bar.increment();
  }

  bar.update({ status: 'Done' });
  bar.stop();

  printBatchReport(results, label);
  return results;
}
