/**
 * Circuit Breaker policy
 * Prevents cascading failures by stopping requests to a failing service
 */

import { UnireqError } from './errors.js';
import { policy } from './introspection.js';
import type { Policy } from './types.js';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  readonly failureThreshold?: number;
  /** Time in ms to wait before trying again (default: 30000) */
  readonly resetTimeout?: number;
  /** Optional predicate to determine if an error should trigger failure */
  readonly shouldFail?: (error: unknown) => boolean;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/** Error thrown when circuit is open */
export class CircuitBreakerOpenError extends UnireqError {
  constructor(public readonly resetTime: number) {
    super('Circuit breaker is OPEN', 'CIRCUIT_BREAKER_OPEN');
    this.name = 'CircuitBreakerOpenError';
  }
}

export function circuitBreaker(options: CircuitBreakerOptions = {}): Policy {
  const { failureThreshold = 5, resetTimeout = 30000, shouldFail = () => true } = options;

  let state = CircuitState.CLOSED;
  let failureCount = 0;
  let nextAttempt = 0;

  return policy(
    async (ctx, next) => {
      const now = Date.now();

      if (state === CircuitState.OPEN) {
        if (now >= nextAttempt) {
          state = CircuitState.HALF_OPEN;
        } else {
          throw new CircuitBreakerOpenError(nextAttempt);
        }
      }

      try {
        const response = await next(ctx);

        if (state === CircuitState.HALF_OPEN) {
          /* v8 ignore next 2 */
          state = CircuitState.CLOSED;
          failureCount = 0;
        } else {
          // Must be CLOSED
          failureCount = 0; // Reset on success
        }

        return response;
      } catch (error) {
        if (shouldFail(error)) {
          if (state === CircuitState.HALF_OPEN) {
            /* v8 ignore next 2 */
            state = CircuitState.OPEN;
            nextAttempt = Date.now() + resetTimeout;
          } else {
            // Must be CLOSED
            failureCount++;
            if (failureCount >= failureThreshold) {
              state = CircuitState.OPEN;
              nextAttempt = Date.now() + resetTimeout;
            }
          }
        }
        throw error;
      }
    },
    {
      name: 'circuitBreaker',
      kind: 'other',
      options: { failureThreshold, resetTimeout, state },
    },
  );
}
