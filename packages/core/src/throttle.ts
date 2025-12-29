/**
 * Throttle policy (Client-side Rate Limiter)
 * Controls the rate of outgoing requests using Token Bucket algorithm
 */

import { policy } from './introspection.js';
import type { Policy } from './types.js';

export interface ThrottleOptions {
  /** Number of requests allowed per interval */
  readonly limit: number;
  /** Interval in milliseconds (default: 1000) */
  readonly interval?: number;
}

export function throttle(options: ThrottleOptions): Policy {
  const { limit, interval = 1000 } = options;

  let tokens = limit;
  let lastRefill = Date.now();
  const refillRate = limit / interval; // tokens per ms

  const refill = () => {
    const now = Date.now();
    const elapsed = now - lastRefill;
    const newTokens = elapsed * refillRate;

    if (newTokens > 0) {
      tokens = Math.min(limit, tokens + newTokens);
      lastRefill = now;
    }
  };

  return policy(
    async (ctx, next) => {
      refill();

      if (tokens < 1) {
        // Calculate wait time
        const missingTokens = 1 - tokens;
        const waitTime = Math.ceil(missingTokens / refillRate);

        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Refill after wait
        refill();
      }

      tokens -= 1;
      return next(ctx);
    },
    {
      name: 'throttle',
      kind: 'other',
      options: { limit, interval },
    },
  );
}
