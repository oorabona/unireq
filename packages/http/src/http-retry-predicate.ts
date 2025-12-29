/**
 * HTTP-specific retry predicates
 */

import { HTTP_CONFIG } from '@unireq/config';
import { inspectable, type RequestContext, type Response, type RetryPredicate } from '@unireq/core';

/**
 * HTTP-specific retry predicate options
 */
export interface HttpRetryPredicateOptions {
  /** HTTP methods to retry (default: ['GET', 'PUT', 'DELETE']) */
  readonly methods?: ReadonlyArray<string>;
  /** Status codes to retry (default: [408, 429, 500, 502, 503, 504]) */
  readonly statusCodes?: ReadonlyArray<number>;
  /** Maximum body size in bytes to allow retry (default: undefined - no limit) */
  readonly maxBodySize?: number;
}

/**
 * Default retryable status codes from config
 */
const DEFAULT_RETRY_STATUS_CODES = [...HTTP_CONFIG.RETRY.RETRY_STATUS_CODES];

/**
 * Default safe methods to retry from config
 * GET, PUT, DELETE are idempotent
 */
const DEFAULT_RETRY_METHODS = [...HTTP_CONFIG.RETRY.RETRY_METHODS];

/**
 * Creates an HTTP-specific retry predicate
 *
 * @param options - HTTP retry predicate options
 * @returns Retry predicate function
 *
 * @example
 * ```ts
 * import { retry } from '@unireq/core';
 * import { httpRetryPredicate, backoff } from '@unireq/http';
 *
 * const policy = retry(
 *   httpRetryPredicate({
 *     methods: ['GET', 'POST'],
 *     statusCodes: [500, 502, 503],
 *     maxBodySize: 1024 * 1024 // 1MB
 *   }),
 *   [backoff({ initial: 100, max: 5000 })],
 *   { tries: 3 }
 * );
 * ```
 */
export function httpRetryPredicate(options?: HttpRetryPredicateOptions): RetryPredicate<Response> {
  const { methods = DEFAULT_RETRY_METHODS, statusCodes = DEFAULT_RETRY_STATUS_CODES, maxBodySize } = options ?? {};

  const predicate = (result: Response | null, error: Error | null, _attempt: number, ctx: RequestContext): boolean => {
    // Always retry on network errors
    if (error !== null) {
      // Check if method is retryable
      if (!methods.includes(ctx.method.toUpperCase())) {
        return false;
      }

      // Check body size if maxBodySize is set
      if (maxBodySize !== undefined && ctx.body !== undefined) {
        const bodySize = getBodySize(ctx.body);
        if (bodySize > maxBodySize) {
          return false;
        }
      }

      return true;
    }

    // For successful responses, check status code
    if (result !== null) {
      // Check if method is retryable
      if (!methods.includes(ctx.method.toUpperCase())) {
        return false;
      }

      // Check body size if maxBodySize is set
      if (maxBodySize !== undefined && ctx.body !== undefined) {
        const bodySize = getBodySize(ctx.body);
        if (bodySize > maxBodySize) {
          return false;
        }
      }

      // Check if status code is retryable
      return statusCodes.includes(result.status);
    }

    return false;
  };

  return inspectable(predicate, {
    name: 'httpRetryPredicate',
    kind: 'predicate',
    options: { methods: [...methods], statusCodes: [...statusCodes], maxBodySize },
  });
}

/**
 * Calculates the body size in bytes
 */
function getBodySize(body: unknown): number {
  if (typeof body === 'string') {
    return new Blob([body]).size;
  }
  if (body instanceof Blob) {
    return body.size;
  }
  if (body instanceof ArrayBuffer) {
    return body.byteLength;
  }
  if (ArrayBuffer.isView(body)) {
    return body.byteLength;
  }
  return 0;
}
