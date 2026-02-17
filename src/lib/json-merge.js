import lodashGet from 'lodash.get';
import lodashSet from 'lodash.set';
import deepmerge from 'deepmerge';

/**
 * Apply a set of dot-path mutations to a settings object.
 * Returns a new object — does not modify the original.
 *
 * @param {object} original - The user's current settings
 * @param {Array<{path: string, value: any}>} mutations - Dot-path/value pairs
 * @returns {object} The modified settings
 */
export function applyMutations(original, mutations) {
  const result = JSON.parse(JSON.stringify(original));

  for (const { path, value } of mutations) {
    lodashSet(result, path, value);
  }

  return result;
}

/**
 * Sync specific sections from a template into a target settings object.
 * Only the selected keys are overwritten; everything else is preserved.
 *
 * @param {object} target - The user's current settings
 * @param {object} template - The golden template settings
 * @param {string[]} keys - Top-level or dot-path keys to sync
 * @returns {object} The modified settings
 */
export function syncSections(target, template, keys) {
  const result = JSON.parse(JSON.stringify(target));

  for (const key of keys) {
    const templateValue = lodashGet(template, key);
    if (templateValue !== undefined) {
      lodashSet(result, key, JSON.parse(JSON.stringify(templateValue)));
    }
  }

  return result;
}

/**
 * Deep merge a partial patch into settings.
 * Arrays are overwritten (not concatenated) by default.
 *
 * @param {object} target - User's settings
 * @param {object} patch - Partial object to merge in
 * @returns {object} Merged result
 */
export function deepMergePatch(target, patch) {
  return deepmerge(target, patch, {
    arrayMerge: (_target, source) => source,
  });
}

/**
 * Auto-detect the type of a string value from user input.
 * @param {string} input
 * @returns {any} Parsed value
 */
export function parseValue(input) {
  const trimmed = input.trim();

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Null
  if (trimmed === 'null') return null;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  // JSON object or array
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to string
    }
  }

  // String
  return trimmed;
}
