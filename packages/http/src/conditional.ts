/**
 * Conditional Requests - ETag and Last-Modified support
 * @see RFC 9110 - HTTP Semantics (Conditional Requests)
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests
 */

import type { Policy } from '@unireq/core';
import { getHeader } from '@unireq/core';

/**
 * ETag cache entry
 */
interface ETagCacheEntry {
  /** ETag value from previous response */
  readonly etag: string;
  /** Cached response data */
  readonly data: unknown;
  /** Cache expiration timestamp */
  readonly expires: number;
}

/**
 * Last-Modified cache entry
 */
interface LastModifiedCacheEntry {
  /** Last-Modified timestamp from previous response */
  readonly lastModified: string;
  /** Cached response data */
  readonly data: unknown;
  /** Cache expiration timestamp */
  readonly expires: number;
}

/**
 * Options for ETag policy
 */
export interface ETagPolicyOptions {
  /** Cache storage (default: in-memory Map) */
  readonly cache?: Map<string, ETagCacheEntry>;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  readonly ttl?: number;
  /** Generate cache key from context (default: uses URL) */
  readonly getCacheKey?: (ctx: { url: string; method: string }) => string;
  /** Callback when cache is used */
  readonly onCacheHit?: (cacheKey: string, etag: string) => void;
  /** Callback when cache is revalidated (304 response) */
  readonly onRevalidated?: (cacheKey: string, etag: string) => void;
}

/**
 * Options for Last-Modified policy
 */
export interface LastModifiedPolicyOptions {
  /** Cache storage (default: in-memory Map) */
  readonly cache?: Map<string, LastModifiedCacheEntry>;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  readonly ttl?: number;
  /** Generate cache key from context (default: uses URL) */
  readonly getCacheKey?: (ctx: { url: string; method: string }) => string;
  /** Callback when cache is used */
  readonly onCacheHit?: (cacheKey: string, lastModified: string) => void;
  /** Callback when cache is revalidated (304 response) */
  readonly onRevalidated?: (cacheKey: string, lastModified: string) => void;
}

/**
 * Default cache key generator - uses URL
 */
function defaultGetCacheKey(ctx: { url: string; method: string }): string {
  return `${ctx.method}:${ctx.url}`;
}

/**
 * Internal factory for conditional request policies.
 * Captures the shared algorithm for ETag and Last-Modified validation.
 */
function createConditionalPolicy<TEntry extends { readonly data: unknown; readonly expires: number }>(config: {
  readonly cache: Map<string, TEntry>;
  readonly ttl: number;
  readonly getCacheKey: (ctx: { url: string; method: string }) => string;
  readonly onCacheHit?: (key: string, token: string) => void;
  readonly onRevalidated?: (key: string, token: string) => void;
  readonly conditionalHeader: string;
  readonly responseHeader: string;
  readonly getToken: (entry: TEntry) => string;
  readonly createEntry: (data: unknown, token: string, expires: number) => TEntry;
}): Policy {
  const {
    cache,
    ttl,
    getCacheKey,
    onCacheHit,
    onRevalidated,
    conditionalHeader,
    responseHeader,
    getToken,
    createEntry,
  } = config;

  return async (ctx, next) => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      return next(ctx);
    }

    const cacheKey = getCacheKey(ctx);
    const cached = cache.get(cacheKey);

    // Cache hit — return cached data without making request
    if (cached && Date.now() < cached.expires) {
      onCacheHit?.(cacheKey, getToken(cached));
      return {
        status: 200,
        statusText: 'OK',
        headers: { [responseHeader]: getToken(cached), 'x-cache': 'HIT' },
        data: cached.data,
        ok: true,
      };
    }

    // Stale entry — send conditional request
    if (cached) {
      // biome-ignore lint/style/noParameterAssign: intentional ctx mutation for conditional headers
      ctx = { ...ctx, headers: { ...ctx.headers, [conditionalHeader]: getToken(cached) } };
    }

    const response = await next(ctx);

    // 304 Not Modified — revalidated, extend TTL
    if (response.status === 304 && cached) {
      cache.set(cacheKey, { ...cached, expires: Date.now() + ttl });
      onRevalidated?.(cacheKey, getToken(cached));
      return {
        status: 200,
        statusText: 'OK',
        headers: { [responseHeader]: getToken(cached), 'x-cache': 'REVALIDATED' },
        data: cached.data,
        ok: true,
      };
    }

    // Cache new response if it has the expected header
    const token = getHeader(response.headers, responseHeader);
    if (response.ok && token) {
      cache.set(cacheKey, createEntry(response.data, token, Date.now() + ttl));
    }

    return response;
  };
}

/**
 * Creates a policy that handles ETag-based conditional requests
 *
 * This policy:
 * 1. Caches responses with ETag headers
 * 2. Sends If-None-Match on subsequent requests
 * 3. Returns cached data on 304 Not Modified
 * 4. Updates cache on successful responses
 *
 * @param options - ETag policy configuration
 * @returns Policy that handles ETag conditional requests
 *
 * @example
 * ```typescript
 * const cache = new Map();
 * const api = client(
 *   http('https://api.example.com'),
 *   etag({ cache, ttl: 60000 })
 * );
 *
 * // First request - caches ETag
 * const response1 = await api.get('/data', parse.json());
 *
 * // Second request - sends If-None-Match
 * const response2 = await api.get('/data', parse.json()); // 304 if unchanged
 * ```
 *
 * @see RFC 9110 Section 13.1.1 - ETag
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
 */
export function etag(options: ETagPolicyOptions = {}): Policy {
  const {
    cache = new Map<string, ETagCacheEntry>(),
    ttl = 300000, // 5 minutes
    getCacheKey = defaultGetCacheKey,
    onCacheHit,
    onRevalidated,
  } = options;

  return createConditionalPolicy({
    cache,
    ttl,
    getCacheKey,
    onCacheHit,
    onRevalidated,
    conditionalHeader: 'if-none-match',
    responseHeader: 'etag',
    getToken: (entry) => entry.etag,
    createEntry: (data, token, expires) => ({ etag: token, data, expires }),
  });
}

/**
 * Creates a policy that handles Last-Modified-based conditional requests
 *
 * This policy:
 * 1. Caches responses with Last-Modified headers
 * 2. Sends If-Modified-Since on subsequent requests
 * 3. Returns cached data on 304 Not Modified
 * 4. Updates cache on successful responses
 *
 * @param options - Last-Modified policy configuration
 * @returns Policy that handles Last-Modified conditional requests
 *
 * @example
 * ```typescript
 * const cache = new Map();
 * const api = client(
 *   http('https://api.example.com'),
 *   lastModified({ cache, ttl: 60000 })
 * );
 *
 * // First request - caches Last-Modified
 * const response1 = await api.get('/data', parse.json());
 *
 * // Second request - sends If-Modified-Since
 * const response2 = await api.get('/data', parse.json()); // 304 if unchanged
 * ```
 *
 * @see RFC 9110 Section 13.1.2 - Last-Modified
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified
 */
export function lastModified(options: LastModifiedPolicyOptions = {}): Policy {
  const {
    cache = new Map<string, LastModifiedCacheEntry>(),
    ttl = 300000, // 5 minutes
    getCacheKey = defaultGetCacheKey,
    onCacheHit,
    onRevalidated,
  } = options;

  return createConditionalPolicy({
    cache,
    ttl,
    getCacheKey,
    onCacheHit,
    onRevalidated,
    conditionalHeader: 'if-modified-since',
    responseHeader: 'last-modified',
    getToken: (entry) => entry.lastModified,
    createEntry: (data, token, expires) => ({ lastModified: token, data, expires }),
  });
}

/**
 * Creates a combined policy that uses both ETag and Last-Modified
 * Prefers ETag over Last-Modified when both are available
 *
 * @param options - Combined policy configuration
 * @returns Policy that handles both ETag and Last-Modified
 *
 * @example
 * ```typescript
 * const api = client(
 *   http('https://api.example.com'),
 *   conditional({ ttl: 60000 })
 * );
 *
 * // Automatically uses ETag or Last-Modified based on server response
 * const response = await api.get('/data', parse.json());
 * ```
 */
export function conditional(options: ETagPolicyOptions & LastModifiedPolicyOptions = {}): Policy {
  const etagCache = options.cache || new Map<string, ETagCacheEntry>();
  const lastModifiedCache = new Map<string, LastModifiedCacheEntry>();

  const etagPolicy = etag({ ...options, cache: etagCache });
  const lastModifiedPolicy = lastModified({ ...options, cache: lastModifiedCache });

  return async (ctx, next) => {
    // Only apply to GET/HEAD requests
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      return next(ctx);
    }

    const cacheKey = (options.getCacheKey || defaultGetCacheKey)(ctx);

    // Check if we have ETag cache
    if (etagCache.has(cacheKey)) {
      return etagPolicy(ctx, next);
    }

    // Check if we have Last-Modified cache
    if (lastModifiedCache.has(cacheKey)) {
      return lastModifiedPolicy(ctx, next);
    }

    // No cache - make request and cache based on response headers
    const response = await next(ctx);

    // Cache with ETag if available
    const etagHeader = getHeader(response.headers, 'etag');
    if (response.ok && etagHeader) {
      etagCache.set(cacheKey, {
        etag: etagHeader,
        data: response.data,
        expires: Date.now() + (options.ttl || 300000),
      });
      return response;
    }

    // Fall back to Last-Modified
    const lastModifiedHeader = getHeader(response.headers, 'last-modified');
    if (response.ok && lastModifiedHeader) {
      lastModifiedCache.set(cacheKey, {
        lastModified: lastModifiedHeader,
        data: response.data,
        expires: Date.now() + (options.ttl || 300000),
      });
    }

    return response;
  };
}
