/**
 * OpenAPI Spec Cache Module
 * @module openapi/cache
 */

// File cache
export { cacheFileSpec, getCachedFileSpec, getFileMetadata, validateFileCache } from './file-cache.js';
// Storage
export { deleteCache, generateCacheKey, getCacheDir, getCachePath, readCache, writeCache } from './storage.js';
// Types
export type { CacheEntry, CacheOptions, CacheValidation } from './types.js';
export { CACHE_VERSION } from './types.js';

// URL cache
export { cacheUrlSpec, extractValidationHeaders, getCachedUrlSpec, validateUrlCache } from './url-cache.js';
