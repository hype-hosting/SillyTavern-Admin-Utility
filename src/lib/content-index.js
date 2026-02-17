import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Read and parse an index.json file. Returns an empty array if the file doesn't exist.
 * @param {string} indexPath - Absolute path to the index.json
 * @returns {Array<object>} Parsed index entries
 */
export function readIndex(indexPath) {
  if (!existsSync(indexPath)) {
    return [];
  }

  try {
    const raw = readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Write an index array back to an index.json file.
 * @param {string} indexPath
 * @param {Array<object>} entries
 */
export function writeIndex(indexPath, entries) {
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, JSON.stringify(entries, null, 2) + '\n');
}

/**
 * Add an entry to an index array if it doesn't already exist (by filename).
 * @param {Array<object>} index - Current index entries
 * @param {{ filename: string, type: string }} entry - New entry to add
 * @returns {Array<object>} Updated index
 */
export function addEntry(index, entry) {
  const exists = index.some(e => e.filename === entry.filename);
  if (exists) return index;
  return [...index, entry];
}

/**
 * Remove entries from an index by filename.
 * @param {Array<object>} index
 * @param {string[]} filenames - Filenames to remove
 * @returns {Array<object>} Updated index
 */
export function removeEntries(index, filenames) {
  return index.filter(e => !filenames.includes(e.filename));
}

/**
 * Update an entry's fields by filename.
 * @param {Array<object>} index
 * @param {string} filename
 * @param {object} updates - Fields to merge into the entry
 * @returns {Array<object>} Updated index
 */
export function updateEntry(index, filename, updates) {
  return index.map(e => {
    if (e.filename === filename) {
      return { ...e, ...updates };
    }
    return e;
  });
}
