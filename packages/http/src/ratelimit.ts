/**
 * Rate limit delay strategy
 * Reads Retry-After header for 429/503 responses
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503
 */

import { HTTP_CONFIG } from '@unireq/config';
import { inspectable, type Response, type RetryDelayStrategy } from '@unireq/core';

/**
 * Parses Retry-After header value
 * @param value - Retry-After header value (seconds or HTTP date)
 * @returns Delay in milliseconds
 * @public
 */
export function parseRetryAfter(value: string): number {
  // Try parsing as number (seconds)
  const seconds = Number.parseInt(value, 10);
  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return 0;
}

/**
 * Rate limit delay strategy options
 */
export interface RateLimitDelayOptions {
  /** Maximum wait time in milliseconds (default: 60000 = 1 minute) */
  readonly maxWait?: number;
  /** Callback when rate limited */
  readonly onRateLimit?: (waitMs: number) => void | Promise<void>;
}

/**
 * Creates a rate limit aware delay strategy
 * Reads Retry-After header on 429/503 responses and returns appropriate delay
 *
 * Use with retry() for automatic retry with rate limit awareness:
 *
 * @param options - Rate limit delay options
 * @returns Delay strategy that respects Retry-After headers
 *
 * @example
 * ```ts
 * import { retry, backoff } from '@unireq/core';
 * import { rateLimitDelay, httpRetryPredicate } from '@unireq/http';
 *
 * // Simple: Retry with Retry-After awareness only
 * const policy1 = retry(
 *   httpRetryPredicate({ statusCodes: [429, 503] }),
 *   [rateLimitDelay({ maxWait: 30000 })],
 *   { tries: 3 }
 * );
 *
 * // Smart: Retry-After with exponential backoff fallback
 * const policy2 = retry(
 *   httpRetryPredicate({ statusCodes: [408, 429, 500, 502, 503, 504] }),
 *   [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 1000, max: 30000 })],
 *   { tries: 4 }
 * );
 * ```
 */
export function rateLimitDelay(options: RateLimitDelayOptions = {}): RetryDelayStrategy<Response> {
  const { maxWait = HTTP_CONFIG.RATE_LIMIT.MAX_WAIT, onRateLimit } = options;

  const strategy: RetryDelayStrategy<Response> = {
    getDelay: async (result: Response | null, _error: Error | null, _attempt: number) => {
      // Errors don't have headers
      if (result === null) {
        return undefined;
      }

      // Only handle rate limit status codes
      if (result.status !== 429 && result.status !== 503) {
        return undefined;
      }

      // Read Retry-After header
      const retryAfterHeader = result.headers['retry-after'] || result.headers['Retry-After'];

      if (!retryAfterHeader) {
        return undefined;
      }

      const waitMs = Math.min(parseRetryAfter(retryAfterHeader), maxWait);

      // Call callback if provided
      if (onRateLimit) {
        await Promise.resolve(onRateLimit(waitMs));
      }

      return waitMs;
    },
  };

  return inspectable(strategy, {
    name: 'rateLimitDelay',
    kind: 'strategy',
    options: { maxWait },
  });
}
