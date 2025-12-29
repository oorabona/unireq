/**
 * Generic transport-agnostic retry flow control primitive
 */

import type { InspectableMeta } from './introspection.js';
import { getInspectableMeta, policy } from './introspection.js';
import type { Policy, RequestContext, Response } from './types.js';

/**
 * Retry predicate function that determines if a retry should occur
 * Returns true to retry, false to stop retrying
 */
export type RetryPredicate<T = Response> = (
  result: T | null,
  error: Error | null,
  attempt: number,
  context: RequestContext,
) => boolean | Promise<boolean>;

/**
 * Retry delay strategy that calculates the delay before next retry
 * Returns delay in milliseconds, or undefined to skip delay calculation
 */
export type RetryDelayStrategy<T = Response> = {
  readonly getDelay: (
    result: T | null,
    error: Error | null,
    attempt: number,
  ) => number | undefined | Promise<number | undefined>;
};

/**
 * Generic retry options
 */
export interface RetryOptions<T = Response> {
  /** Number of retry attempts (default: 3) */
  readonly tries?: number;
  /** Callback before retry */
  readonly onRetry?: (attempt: number, error: Error | null, result: T | null) => void | Promise<void>;
}

/**
 * Calculate delay using strategies in order (first match wins)
 * @internal
 */
async function calculateDelay<T>(
  strategies: ReadonlyArray<RetryDelayStrategy<T>>,
  result: T | null,
  error: Error | null,
  attempt: number,
): Promise<number> {
  for (const strategy of strategies) {
    const strategyDelay = await strategy.getDelay(result, error, attempt);
    if (strategyDelay !== undefined) {
      return strategyDelay;
    }
  }
  return 0;
}

/**
 * Creates a generic transport-agnostic retry policy
 *
 * This is a pure flow control primitive that works with any protocol (HTTP, FTP, IMAP, etc.).
 * It executes a predicate to determine if retry should occur, applies delay strategies,
 * and invokes callbacks.
 *
 * @param predicate - Function to determine if retry should occur
 * @param strategies - Delay strategies to calculate wait time before retry
 * @param options - Retry options
 * @returns Policy that retries based on predicate
 *
 * @example
 * ```ts
 * // HTTP-specific retry with status codes
 * const httpRetry = retry(
 *   (result, error) => error !== null || (result?.status >= 500 && result?.status < 600),
 *   [backoff({ initial: 100, max: 5000 })],
 *   { tries: 3 }
 * );
 * ```
 *
 * @example
 * ```ts
 * // Generic retry for any operation
 * const genericRetry = retry(
 *   (result, error) => error !== null,
 *   [exponentialBackoff()],
 *   { tries: 5 }
 * );
 * ```
 */
export function retry<T = Response>(
  predicate: RetryPredicate<T>,
  strategies: ReadonlyArray<RetryDelayStrategy<T>>,
  options?: RetryOptions<T>,
): Policy {
  const { tries = 3, onRetry } = options ?? {};

  return policy(
    async (ctx, next) => {
      let lastResponse: Response | undefined;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < tries; attempt++) {
        try {
          const response = await next(ctx);
          lastResponse = response;

          // Check if we should retry using predicate
          const shouldRetry = await Promise.resolve(predicate(response as T, null, attempt, ctx));

          // If predicate says no retry, or last attempt, return response
          if (!shouldRetry || attempt === tries - 1) {
            return response;
          }

          // Call onRetry callback
          if (onRetry) {
            await Promise.resolve(onRetry(attempt + 1, null, response as T));
          }

          // Calculate and apply delay
          const delay = await calculateDelay(strategies, response as T, null, attempt);
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Last attempt - throw error
          if (attempt === tries - 1) {
            throw lastError;
          }

          // Check if we should retry on error using predicate
          const shouldRetry = await Promise.resolve(predicate(null, lastError, attempt, ctx));

          if (!shouldRetry) {
            throw lastError;
          }

          // Call onRetry callback
          if (onRetry) {
            await Promise.resolve(onRetry(attempt + 1, lastError, null));
          }

          // Calculate and apply delay
          const delay = await calculateDelay(strategies, null, lastError, attempt);
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      return lastResponse as Response;
    },
    {
      name: 'retry',
      kind: 'retry',
      options: {
        tries,
      },
      children: [
        // Add predicate metadata
        ...(() => {
          const meta = getInspectableMeta(predicate);
          return meta ? [meta] : [];
        })(),
        // Add strategies metadata
        ...strategies.map((s) => getInspectableMeta(s)).filter((m): m is InspectableMeta => m !== undefined),
      ],
    },
  );
}
