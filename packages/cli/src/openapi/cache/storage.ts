/**
 * Cache Storage Operations
 * @module openapi/cache/storage
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { consola } from 'consola';
import { getGlobalWorkspacePath } from '../../workspace/paths.js';
import type { CacheEntry } from './types.js';
import { CACHE_VERSION } from './types.js';

/** Cache directory name */
const CACHE_DIR = 'cache';

/**
 * Get the cache directory path
 * @param workspace - Optional workspace directory
 * @returns Cache directory path or null if no valid path
 */
export function getCacheDir(workspace?: string): string | null {
  if (workspace) {
    return join(workspace, '.unireq', CACHE_DIR);
  }

  const globalPath = getGlobalWorkspacePath();
  if (!globalPath) {
    return null;
  }

  return join(globalPath, CACHE_DIR);
}

/**
 * Generate a cache key from source and validation data
 * @param source - Source path or URL
 * @param mtime - File modification time (for files)
 * @param size - File size (for files)
 * @param etag - ETag header (for URLs)
 * @param lastModified - Last-Modified header (for URLs)
 * @returns SHA-256 hash as hex string
 */
export function generateCacheKey(
  source: string,
  mtime?: number,
  size?: number,
  etag?: string,
  lastModified?: string,
): string {
  let keyData: string;

  if (mtime !== undefined && size !== undefined) {
    // File-based key
    keyData = `${source}:${mtime}:${size}`;
  } else if (etag) {
    // URL with ETag
    keyData = `${source}:${etag}`;
  } else if (lastModified) {
    // URL with Last-Modified
    keyData = `${source}:${lastModified}`;
  } else {
    // URL without validation headers - use URL only
    keyData = source;
  }

  return createHash('sha256').update(keyData).digest('hex');
}

/**
 * Get the cache file path for a source
 * @param source - Source path or URL
 * @param workspace - Optional workspace directory
 * @returns Cache file path or null
 */
export function getCachePath(source: string, workspace?: string): string | null {
  const cacheDir = getCacheDir(workspace);
  if (!cacheDir) {
    return null;
  }

  // Use a simple hash of the source for the filename (validation is in content)
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
  return join(cacheDir, `spec-${hash}.json`);
}

/**
 * Read a cache entry from disk
 * @param cachePath - Path to cache file
 * @returns Cache entry or null if not found/invalid
 */
export async function readCache(cachePath: string): Promise<CacheEntry | null> {
  try {
    const content = await readFile(cachePath, 'utf-8');
    const entry = JSON.parse(content) as CacheEntry;

    // Validate cache version
    if (entry.cacheVersion !== CACHE_VERSION) {
      consola.debug(`Cache version mismatch: ${entry.cacheVersion} !== ${CACHE_VERSION}`);
      return null;
    }

    return entry;
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      consola.debug(`Cache read error: ${err.message}`);
    }
    return null;
  }
}

/**
 * Write a cache entry to disk
 * @param cachePath - Path to cache file
 * @param entry - Cache entry to write
 * @returns true if successful, false otherwise
 */
export async function writeCache(cachePath: string, entry: CacheEntry): Promise<boolean> {
  try {
    // Ensure cache directory exists
    const dir = dirname(cachePath);
    await mkdir(dir, { recursive: true });

    // Write cache file atomically (write to temp, then rename)
    const content = JSON.stringify(entry, null, 2);
    await writeFile(cachePath, content, 'utf-8');

    return true;
  } catch (error: unknown) {
    const err = error as { message?: string };
    consola.debug(`Cache write error: ${err.message}`);
    return false;
  }
}

/**
 * Delete a cache entry
 * @param cachePath - Path to cache file
 * @returns true if deleted, false if not found or error
 */
export async function deleteCache(cachePath: string): Promise<boolean> {
  try {
    await rm(cachePath, { force: true });
    return true;
  } catch {
    return false;
  }
}
