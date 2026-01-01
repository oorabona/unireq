/**
 * URL-based Cache Operations
 * @module openapi/cache/url-cache
 */

import { consola } from 'consola';
import type { LoadedSpec } from '../types.js';
import { deleteCache, getCachePath, readCache, writeCache } from './storage.js';
import type { CacheEntry } from './types.js';
import { CACHE_VERSION } from './types.js';

/**
 * URL validation metadata
 */
export interface UrlValidationInfo {
  etag?: string;
  lastModified?: string;
}

/**
 * Extract validation headers from fetch response
 * @param headers - Response headers
 * @returns Validation info
 */
export function extractValidationHeaders(headers: Headers): UrlValidationInfo {
  return {
    etag: headers.get('etag') || undefined,
    lastModified: headers.get('last-modified') || undefined,
  };
}

/**
 * Check if remote resource is unchanged via HEAD request
 * @param source - URL to check
 * @param entry - Cached entry with validation data
 * @param timeout - Request timeout in ms
 * @returns true if resource unchanged (304), false if changed or error
 */
export async function validateUrlCache(source: string, entry: CacheEntry, timeout = 5000): Promise<boolean> {
  // Must have at least one validation header
  if (!entry.validation.etag && !entry.validation.lastModified) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {};
    if (entry.validation.etag) {
      headers['If-None-Match'] = entry.validation.etag;
    }
    if (entry.validation.lastModified) {
      headers['If-Modified-Since'] = entry.validation.lastModified;
    }

    const response = await fetch(source, {
      method: 'HEAD',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 304 Not Modified means cache is valid
    if (response.status === 304) {
      return true;
    }

    // Any other response means cache should be invalidated
    return false;
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'AbortError') {
      consola.debug(`URL cache validation timeout for ${source}`);
    } else {
      consola.debug(`URL cache validation error: ${(error as Error).message}`);
    }
    // On error, assume cache is stale (conservative)
    return false;
  }
}

/**
 * Get cached spec for a URL source
 * @param source - URL
 * @param workspace - Optional workspace directory
 * @returns Cached LoadedSpec or null if not cached/invalid
 */
export async function getCachedUrlSpec(source: string, workspace?: string): Promise<LoadedSpec | null> {
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

  // Validate cache is still fresh via HEAD request
  const isValid = await validateUrlCache(source, entry);
  if (!isValid) {
    consola.debug(`URL cache invalid for ${source}, will re-fetch`);
    await deleteCache(cachePath);
    return null;
  }

  consola.debug(`URL cache hit for ${source}`);

  // Return LoadedSpec from cache
  return {
    version: entry.version,
    versionFull: entry.versionFull,
    source: entry.source,
    document: entry.document,
  };
}

/**
 * Cache a loaded spec from a URL source
 * @param source - URL
 * @param spec - Loaded spec to cache
 * @param headers - Response headers for validation
 * @param workspace - Optional workspace directory
 * @returns true if cached successfully
 */
export async function cacheUrlSpec(
  source: string,
  spec: LoadedSpec,
  headers: Headers,
  workspace?: string,
): Promise<boolean> {
  const cachePath = getCachePath(source, workspace);
  if (!cachePath) {
    return false;
  }

  // Extract validation headers
  const validation = extractValidationHeaders(headers);

  // Build cache entry
  const entry: CacheEntry = {
    cacheVersion: CACHE_VERSION,
    source,
    version: spec.version,
    versionFull: spec.versionFull,
    validation: {
      etag: validation.etag,
      lastModified: validation.lastModified,
      cachedAt: Date.now(),
    },
    document: spec.document,
  };

  // Write to cache
  const success = await writeCache(cachePath, entry);
  if (success) {
    consola.debug(`Cached URL spec for ${source}`);
  }

  return success;
}
