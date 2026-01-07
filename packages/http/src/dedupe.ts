/**
 * Request deduplication policy
 * Deduplicates identical in-flight requests to reduce network load
 */

import type { Policy, RequestContext, Response } from '@unireq/core';

/**
 * Key generator function type
 */
export type DedupeKeyGenerator = (ctx: RequestContext) => string;

/**
 * Deduplication configuration
 */
export interface DedupeOptions {
  /**
   * Function to generate cache key from request context
   * @default (ctx) => `${ctx.method}:${ctx.url}`
   */
  readonly key?: DedupeKeyGenerator;

  /**
   * Time-to-live for deduplication window in milliseconds
   * Requests within this window are considered duplicates
   * @default 100
   */
  readonly ttl?: number;

  /**
   * HTTP methods to deduplicate
   * @default ['GET', 'HEAD']
   */
  readonly methods?: ReadonlyArray<string>;

  /**
   * Maximum number of pending requests to track
   * Oldest entries are evicted when limit is reached
   * @default 1000
   */
  readonly maxSize?: number;
}

/**
 * Pending request entry
 */
interface PendingEntry {
  readonly promise: Promise<Response>;
  readonly timestamp: number;
}

/**
 * Default key generator
 */
const defaultKeyGenerator: DedupeKeyGenerator = (ctx) => `${ctx.method}:${ctx.url}`;

/**
 * Create a request deduplication policy
 *
 * Deduplicates identical in-flight requests, so that multiple concurrent
 * requests for the same resource resolve to a single network call.
 *
 * @param options - Deduplication configuration
 * @returns Policy that deduplicates requests
 *
 * @example
 * ```ts
 * import { client } from '@unireq/core';
 * import { http, dedupe } from '@unireq/http';
 *
 * const api = client(
 *   http('https://api.example.com'),
 *   dedupe({
 *     key: (ctx) => `${ctx.method}:${ctx.url}`,
 *     ttl: 100,
 *     methods: ['GET', 'HEAD'],
 *   })
 * );
 *
 * // Multiple identical requests resolve to a single network call
 * const [r1, r2, r3] = await Promise.all([
 *   api.get('/users'),
 *   api.get('/users'),
 *   api.get('/users'),
 * ]); // Only 1 actual HTTP request
 * ```
 */
export function dedupe(options: DedupeOptions = {}): Policy {
  const { key: keyGenerator = defaultKeyGenerator, ttl = 100, methods = ['GET', 'HEAD'], maxSize = 1000 } = options;

  const methodSet = new Set(methods.map((m) => m.toUpperCase()));
  const pending = new Map<string, PendingEntry>();

  /**
   * Cleanup expired entries
   */
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of pending) {
      if (now - entry.timestamp > ttl) {
        pending.delete(key);
      }
    }
  };

  /**
   * Evict oldest entries if over capacity
   */
  const evictIfNeeded = () => {
    while (pending.size >= maxSize) {
      const firstKey = pending.keys().next().value;
      if (firstKey) {
        pending.delete(firstKey);
      } else {
        /* v8 ignore next -- @preserve defensive: firstKey is always truthy when size >= maxSize */
        break;
      }
    }
  };

  return async (ctx: RequestContext, next) => {
    // Only dedupe configured methods
    if (!methodSet.has(ctx.method.toUpperCase())) {
      return next(ctx);
    }

    // Generate cache key
    const cacheKey = keyGenerator(ctx);

    // Cleanup expired entries periodically
    cleanup();

    // Check for existing pending request
    const existingEntry = pending.get(cacheKey);
    if (existingEntry && Date.now() - existingEntry.timestamp <= ttl) {
      // Return existing promise (deduplication hit)
      return existingEntry.promise;
    }

    // Evict if over capacity
    evictIfNeeded();

    // Create new request
    const promise = next(ctx).finally(() => {
      // Remove from pending after completion
      // Use setTimeout to allow for TTL-based deduplication
      setTimeout(() => {
        const entry = pending.get(cacheKey);
        if (entry && entry.promise === promise) {
          pending.delete(cacheKey);
        }
      }, ttl);
    });

    // Store in pending map
    pending.set(cacheKey, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  };
}

/**
 * Dedupe namespace
 */
export const dedupePolicy = {
  dedupe,
};
