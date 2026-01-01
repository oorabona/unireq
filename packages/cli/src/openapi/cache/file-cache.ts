/**
 * File-based Cache Operations
 * @module openapi/cache/file-cache
 */

import { stat } from 'node:fs/promises';
import { consola } from 'consola';
import type { LoadedSpec } from '../types.js';
import { deleteCache, getCachePath, readCache, writeCache } from './storage.js';
import type { CacheEntry } from './types.js';
import { CACHE_VERSION } from './types.js';

/**
 * File metadata for cache validation
 */
export interface FileMetadata {
  mtime: number;
  size: number;
}

/**
 * Get file metadata for cache validation
 * @param source - File path
 * @returns File metadata or null if file not accessible
 */
export async function getFileMetadata(source: string): Promise<FileMetadata | null> {
  try {
    const stats = await stat(source);
    return {
      mtime: stats.mtimeMs,
      size: stats.size,
    };
  } catch {
    return null;
  }
}

/**
 * Validate a cache entry against current file state
 * @param source - File path
 * @param entry - Cached entry
 * @returns true if cache is still valid
 */
export async function validateFileCache(source: string, entry: CacheEntry): Promise<boolean> {
  // Check that cache has file validation data
  if (entry.validation.mtime === undefined || entry.validation.size === undefined) {
    return false;
  }

  // Get current file metadata
  const metadata = await getFileMetadata(source);
  if (!metadata) {
    // File no longer exists
    return false;
  }

  // Compare mtime and size
  return metadata.mtime === entry.validation.mtime && metadata.size === entry.validation.size;
}

/**
 * Get cached spec for a file source
 * @param source - File path
 * @param workspace - Optional workspace directory
 * @returns Cached LoadedSpec or null if not cached/invalid
 */
export async function getCachedFileSpec(source: string, workspace?: string): Promise<LoadedSpec | null> {
  const cachePath = getCachePath(source, workspace);
  if (!cachePath) {
    return null;
  }

  // Read cache entry
  const entry = await readCache(cachePath);
  if (!entry) {
    return null;
  }

  // Validate that cache matches source
  if (entry.source !== source) {
    consola.debug(`Cache source mismatch: ${entry.source} !== ${source}`);
    return null;
  }

  // Validate cache is still fresh
  const isValid = await validateFileCache(source, entry);
  if (!isValid) {
    consola.debug(`Cache invalid for ${source}, will re-parse`);
    await deleteCache(cachePath);
    return null;
  }

  consola.debug(`Cache hit for ${source}`);

  // Return LoadedSpec from cache
  return {
    version: entry.version,
    versionFull: entry.versionFull,
    source: entry.source,
    document: entry.document,
  };
}

/**
 * Cache a loaded spec from a file source
 * @param source - File path
 * @param spec - Loaded spec to cache
 * @param workspace - Optional workspace directory
 * @returns true if cached successfully
 */
export async function cacheFileSpec(source: string, spec: LoadedSpec, workspace?: string): Promise<boolean> {
  const cachePath = getCachePath(source, workspace);
  if (!cachePath) {
    return false;
  }

  // Get current file metadata
  const metadata = await getFileMetadata(source);
  if (!metadata) {
    consola.debug(`Cannot get file metadata for ${source}, skipping cache`);
    return false;
  }

  // Build cache entry
  const entry: CacheEntry = {
    cacheVersion: CACHE_VERSION,
    source,
    version: spec.version,
    versionFull: spec.versionFull,
    validation: {
      mtime: metadata.mtime,
      size: metadata.size,
      cachedAt: Date.now(),
    },
    document: spec.document,
  };

  // Write to cache
  const success = await writeCache(cachePath, entry);
  if (success) {
    consola.debug(`Cached spec for ${source}`);
  }

  return success;
}
