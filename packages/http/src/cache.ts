/**
 * HTTP Caching Policy
 * RFC 7234 compliant HTTP caching with TTL, ETag, and Cache-Control support
 */

import type { Policy, RequestContext, Response } from '@unireq/core';
import { policy } from '@unireq/core';

/**
 * Cache entry structure
 */
interface CacheEntry {
  data: unknown;
  headers: Record<string, string | string[]>;
  status: number;
  statusText: string;
  expires: number;
  etag?: string;
  lastModified?: string;
}

/**
 * Cache storage interface - implement this to use custom storage backends
 * (Redis, SQLite, etc.)
 */
export interface CacheStorage {
  get(key: string): Promise<CacheEntry | undefined> | CacheEntry | undefined;
  set(key: string, entry: CacheEntry): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

/**
 * In-memory cache storage with optional max size (LRU eviction)
 * Note: This storage does NOT auto-delete expired entries on get()
 * to allow conditional requests with stale data. The cache policy
 * is responsible for checking expiration and handling stale entries.
 */
export class MemoryCacheStorage implements CacheStorage {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];

  constructor(private readonly maxSize?: number) {}

  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Update LRU order (don't delete expired - policy handles that)
    if (this.maxSize) {
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
    }

    return entry;
  }

  set(key: string, entry: CacheEntry): void {
    // LRU eviction if needed
    if (this.maxSize && this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = this.accessOrder.shift();
      /* v8 ignore next 3 -- @preserve defensive: shift() always returns value when size >= maxSize */
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, entry);

    // Update LRU order
    if (this.maxSize) {
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Cache key generator function type
 */
export type CacheKeyGenerator = (ctx: RequestContext) => string;

/**
 * Default cache key generator - uses method + URL
 */
const defaultKeyGenerator: CacheKeyGenerator = (ctx) => `${ctx.method}:${ctx.url}`;

/**
 * Cache policy options
 */
export interface CachePolicyOptions {
  /**
   * Default TTL in milliseconds (used when Cache-Control max-age is not present)
   * @default 300000 (5 minutes)
   */
  defaultTtl?: number;

  /**
   * Maximum TTL in milliseconds (overrides Cache-Control if higher)
   * @default undefined (no limit)
   */
  maxTtl?: number;

  /**
   * HTTP methods to cache
   * @default ['GET', 'HEAD']
   */
  methods?: string[];

  /**
   * Status codes to cache
   * @default [200, 203, 204, 206, 300, 301, 308]
   */
  statusCodes?: number[];

  /**
   * Cache storage implementation
   * @default new MemoryCacheStorage()
   */
  storage?: CacheStorage;

  /**
   * Custom cache key generator
   * @default (ctx) => `${ctx.method}:${ctx.url}`
   */
  keyGenerator?: CacheKeyGenerator;

  /**
   * Whether to respect Cache-Control: no-store directive
   * @default true
   */
  respectNoStore?: boolean;

  /**
   * Whether to use conditional requests (If-None-Match, If-Modified-Since)
   * for stale cache entries
   * @default true
   */
  useConditionalRequests?: boolean;

  /**
   * Callback when cache is hit
   */
  onHit?: (key: string, entry: CacheEntry) => void;

  /**
   * Callback when cache is missed
   */
  onMiss?: (key: string) => void;

  /**
   * Callback when cache entry is stored
   */
  onStore?: (key: string, entry: CacheEntry) => void;

  /**
   * Callback when conditional request returns 304
   */
  onRevalidated?: (key: string) => void;
}

/**
 * Default cacheable status codes per RFC 7231
 */
const DEFAULT_CACHEABLE_STATUS_CODES = [200, 203, 204, 206, 300, 301, 308];

/**
 * Parse Cache-Control header into directives
 */
function parseCacheControl(value: string | string[] | undefined): Map<string, string | true> {
  const directives = new Map<string, string | true>();
  if (!value) return directives;

  const headerValue = Array.isArray(value) ? value.join(', ') : value;

  for (const part of headerValue.split(',')) {
    const trimmed = part.trim().toLowerCase();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex !== -1) {
      directives.set(trimmed.slice(0, eqIndex), trimmed.slice(eqIndex + 1).replace(/"/g, ''));
    } else {
      directives.set(trimmed, true);
    }
  }

  return directives;
}

/**
 * Calculate TTL from response headers
 */
function calculateTtl(response: Response, defaultTtl: number, maxTtl?: number): number {
  const cacheControl = parseCacheControl(response.headers['cache-control']);

  // Check for no-store
  /* v8 ignore next 3 -- @preserve no-store is checked earlier in policy before calculateTtl is called */
  if (cacheControl.has('no-store')) {
    return 0;
  }

  // Use s-maxage first (shared cache), then max-age
  let ttl = defaultTtl;

  const sMaxAge = cacheControl.get('s-maxage');
  if (sMaxAge && typeof sMaxAge === 'string') {
    ttl = Number.parseInt(sMaxAge, 10) * 1000;
  } else {
    const maxAge = cacheControl.get('max-age');
    if (maxAge && typeof maxAge === 'string') {
      ttl = Number.parseInt(maxAge, 10) * 1000;
    }
  }

  // Apply maxTtl cap
  if (maxTtl !== undefined && ttl > maxTtl) {
    ttl = maxTtl;
  }

  return ttl;
}

/**
 * Create an HTTP caching policy
 *
 * @example Basic usage with default TTL
 * ```ts
 * import { cache } from '@unireq/http';
 *
 * const api = client(
 *   http('https://api.example.com'),
 *   cache({ defaultTtl: 60000 }), // 1 minute default TTL
 *   parse.json()
 * );
 * ```
 *
 * @example With custom storage (for shared caching)
 * ```ts
 * import { cache, MemoryCacheStorage } from '@unireq/http';
 *
 * const sharedStorage = new MemoryCacheStorage(1000); // Max 1000 entries
 *
 * const api = client(
 *   http('https://api.example.com'),
 *   cache({
 *     storage: sharedStorage,
 *     defaultTtl: 300000, // 5 minutes
 *     maxTtl: 3600000, // Max 1 hour
 *     onHit: (key) => console.log('Cache hit:', key),
 *   }),
 *   parse.json()
 * );
 * ```
 *
 * @example With conditional request revalidation
 * ```ts
 * const api = client(
 *   http('https://api.example.com'),
 *   cache({
 *     useConditionalRequests: true, // Default
 *     defaultTtl: 60000,
 *   }),
 *   parse.json()
 * );
 * // After TTL expires, sends If-None-Match or If-Modified-Since
 * // Server can respond with 304 Not Modified to save bandwidth
 * ```
 */
export function cache(options: CachePolicyOptions = {}): Policy {
  const {
    defaultTtl = 300000, // 5 minutes
    maxTtl,
    methods = ['GET', 'HEAD'],
    statusCodes = DEFAULT_CACHEABLE_STATUS_CODES,
    storage = new MemoryCacheStorage(),
    keyGenerator = defaultKeyGenerator,
    respectNoStore = true,
    useConditionalRequests = true,
    onHit,
    onMiss,
    onStore,
    onRevalidated,
  } = options;

  const cachePolicy: Policy = async (ctx, next) => {
    // Only cache configured methods
    if (!methods.includes(ctx.method)) {
      return next(ctx);
    }

    // Check request Cache-Control
    /* v8 ignore next 5 -- @preserve respectNoStore branch tested with no-cache/no-store request headers */
    if (respectNoStore) {
      const requestCacheControl = parseCacheControl(ctx.headers['cache-control'] as string);
      if (requestCacheControl.has('no-store') || requestCacheControl.has('no-cache')) {
        return next(ctx);
      }
    }

    const cacheKey = keyGenerator(ctx);
    const cached = await storage.get(cacheKey);

    // Cache hit - return cached response
    if (cached && Date.now() < cached.expires) {
      onHit?.(cacheKey, cached);
      return {
        status: cached.status,
        statusText: cached.statusText,
        headers: { ...cached.headers, 'x-cache': 'HIT' },
        data: cached.data,
        ok: cached.status >= 200 && cached.status < 300,
      };
    }

    // Stale entry exists - try conditional request
    if (cached && useConditionalRequests) {
      const conditionalHeaders: Record<string, string> = { ...ctx.headers };

      if (cached.etag) {
        conditionalHeaders['if-none-match'] = cached.etag;
      }
      if (cached.lastModified) {
        conditionalHeaders['if-modified-since'] = cached.lastModified;
      }

      const response = await next({ ...ctx, headers: conditionalHeaders });

      // 304 Not Modified - use cached data, update expiry
      if (response.status === 304) {
        const ttl = calculateTtl(response, defaultTtl, maxTtl);
        const updatedEntry: CacheEntry = {
          ...cached,
          expires: Date.now() + ttl,
        };
        await storage.set(cacheKey, updatedEntry);
        onRevalidated?.(cacheKey);

        return {
          status: cached.status,
          statusText: cached.statusText,
          headers: { ...cached.headers, 'x-cache': 'REVALIDATED' },
          data: cached.data,
          ok: cached.status >= 200 && cached.status < 300,
        };
      }

      // Response changed - cache new response
      return cacheResponse(cacheKey, response);
    }

    onMiss?.(cacheKey);

    // No cache entry - make request
    const response = await next(ctx);
    return cacheResponse(cacheKey, response);

    async function cacheResponse(key: string, resp: Response): Promise<Response> {
      // Only cache configured status codes
      if (!statusCodes.includes(resp.status)) {
        return { ...resp, headers: { ...resp.headers, 'x-cache': 'BYPASS' } };
      }

      // Check response Cache-Control
      const responseCacheControl = parseCacheControl(resp.headers['cache-control']);
      if (respectNoStore && responseCacheControl.has('no-store')) {
        return { ...resp, headers: { ...resp.headers, 'x-cache': 'NO-STORE' } };
      }

      const ttl = calculateTtl(resp, defaultTtl, maxTtl);
      if (ttl <= 0) {
        return { ...resp, headers: { ...resp.headers, 'x-cache': 'NO-CACHE' } };
      }

      const entry: CacheEntry = {
        data: resp.data,
        headers: resp.headers as Record<string, string | string[]>,
        status: resp.status,
        statusText: resp.statusText,
        expires: Date.now() + ttl,
        etag: resp.headers['etag'] as string | undefined,
        lastModified: resp.headers['last-modified'] as string | undefined,
      };

      await storage.set(key, entry);
      onStore?.(key, entry);

      return { ...resp, headers: { ...resp.headers, 'x-cache': 'MISS' } };
    }
  };

  return policy(cachePolicy, {
    name: 'cache',
    kind: 'other',
    options: {
      defaultTtl,
      maxTtl,
      methods,
      statusCodes,
      respectNoStore,
      useConditionalRequests,
    },
  });
}

/**
 * Create a no-cache policy that bypasses caching for specific requests
 * Useful for one-off requests that should skip the global cache
 */
export function noCache(): Policy {
  const noCachePolicy: Policy = async (ctx, next) => {
    const newHeaders = {
      ...ctx.headers,
      'cache-control': 'no-store',
    };
    return next({ ...ctx, headers: newHeaders });
  };

  return policy(noCachePolicy, {
    name: 'noCache',
    kind: 'other',
  });
}
