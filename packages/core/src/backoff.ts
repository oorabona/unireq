/**
 * Exponential backoff strategy for retry delays
 * Provides exponential backoff with optional jitter
 * Transport-agnostic - works with any protocol
 */

import { inspectable } from './introspection.js';
import type { RetryDelayStrategy } from './retry.js';

/**
 * Backoff options
 */
export interface BackoffOptions {
  /** Initial backoff in milliseconds (default: 1000) */
  readonly initial?: number;
  /** Maximum backoff in milliseconds (default: 30000) */
  readonly max?: number;
  /** Multiplier for exponential backoff (default: 2) */
  readonly multiplier?: number;
  /** Add jitter to backoff (default: true) */
  readonly jitter?: boolean;
}

/**
 * Calculates backoff delay with exponential backoff and optional jitter
 * @param attempt - Current attempt number (0-indexed)
 * @param baseMs - Base backoff in milliseconds
 * @param maxMs - Maximum backoff in milliseconds
 * @param multiplier - Exponential multiplier
 * @param jitter - Whether to add jitter
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number, baseMs: number, maxMs: number, multiplier: number, jitter: boolean): number {
  const exponential = baseMs * multiplier ** attempt;
  const capped = Math.min(exponential, maxMs);

  if (!jitter) {
    return capped;
  }

  // Add jitter: random value between 0 and capped
  return Math.floor(Math.random() * capped);
}

/**
 * Creates an exponential backoff delay strategy
 *
 * @param options - Backoff configuration
 * @returns Delay strategy that calculates exponential backoff
 *
 * @example
 * ```ts
 * import { retry } from '@unireq/core';
 * import { backoff } from '@unireq/core';
 *
 * const policy = retry(
 *   myPredicate,
 *   [backoff({ initial: 100, max: 5000, jitter: true })],
 *   { tries: 3 }
 * );
 * ```
 */
export function backoff<T = unknown>(options: BackoffOptions = {}): RetryDelayStrategy<T> {
  const { initial = 1000, max = 30000, multiplier = 2, jitter = true } = options;

  const strategy: RetryDelayStrategy<T> = {
    getDelay: (_result: T | null, _error: Error | null, attempt: number) => {
      return calculateBackoff(attempt, initial, max, multiplier, jitter);
    },
  };

  return inspectable(strategy, {
    name: 'backoff',
    kind: 'strategy',
    options: { initial, max, multiplier, jitter },
  });
}
