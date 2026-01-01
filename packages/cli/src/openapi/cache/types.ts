/**
 * OpenAPI Spec Cache Types
 * @module openapi/cache/types
 */

import type { OpenAPIDocument, SpecVersion } from '../types.js';

/** Current cache format version */
export const CACHE_VERSION = 1;

/**
 * Validation metadata for cache entries
 */
export interface CacheValidation {
  /** For files: mtime in ms */
  mtime?: number;
  /** For files: size in bytes */
  size?: number;
  /** For URLs: ETag header */
  etag?: string;
  /** For URLs: Last-Modified header */
  lastModified?: string;
  /** Timestamp when cached (ms since epoch) */
  cachedAt: number;
}

/**
 * Cache entry structure
 */
export interface CacheEntry {
  /** Version for cache format migrations */
  cacheVersion: typeof CACHE_VERSION;
  /** Original source (file path or URL) */
  source: string;
  /** Spec version (2.0, 3.0, 3.1) */
  version: SpecVersion;
  /** Full version string */
  versionFull: string;
  /** Validation metadata */
  validation: CacheValidation;
  /** The dereferenced OpenAPI document */
  document: OpenAPIDocument;
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /** Workspace directory (uses global if not provided) */
  workspace?: string;
  /** Skip cache entirely */
  noCache?: boolean;
}
