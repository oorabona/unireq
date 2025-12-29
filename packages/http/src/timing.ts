/**
 * Performance timing API for HTTP requests
 * Provides detailed timing information for requests
 */

import type { Policy, RequestContext, Response } from '@unireq/core';

/**
 * Timing information for a request
 */
export interface TimingInfo {
  /**
   * DNS lookup time in milliseconds
   * Note: Not available for all transports
   */
  readonly dns?: number;

  /**
   * TCP connection time in milliseconds
   * Note: Not available for all transports
   */
  readonly tcp?: number;

  /**
   * TLS handshake time in milliseconds
   * Note: Only for HTTPS requests
   */
  readonly tls?: number;

  /**
   * Time to first byte (TTFB) in milliseconds
   * Time from request sent to first response byte
   */
  readonly ttfb: number;

  /**
   * Content download time in milliseconds
   */
  readonly download: number;

  /**
   * Total request time in milliseconds
   */
  readonly total: number;

  /**
   * Request start timestamp (Unix ms)
   */
  readonly startTime: number;

  /**
   * Request end timestamp (Unix ms)
   */
  readonly endTime: number;
}

/**
 * Response with timing information
 */
export interface TimedResponse<T = unknown> extends Response<T> {
  /**
   * Timing information for the request
   */
  readonly timing: TimingInfo;
}

/**
 * Timing options
 */
export interface TimingOptions {
  /**
   * Include timing information in response headers
   * @default false
   */
  readonly includeInHeaders?: boolean;

  /**
   * Header name for timing information
   * @default 'x-unireq-timing'
   */
  readonly headerName?: string;

  /**
   * Callback for timing events
   */
  readonly onTiming?: (timing: TimingInfo, ctx: RequestContext) => void;
}

/**
 * Timing context key
 */
const TIMING_KEY = Symbol('unireq:timing');

/**
 * Create a timing policy
 *
 * Adds detailed timing information to responses.
 *
 * @param options - Timing options
 * @returns Policy that adds timing information
 *
 * @example
 * ```ts
 * import { client } from '@unireq/core';
 * import { http, timing } from '@unireq/http';
 *
 * const api = client(
 *   http('https://api.example.com'),
 *   timing()
 * );
 *
 * const response = await api.get('/users');
 * console.log(response.timing);
 * // {
 * //   ttfb: 150,
 * //   download: 30,
 * //   total: 180,
 * //   startTime: 1703001234567,
 * //   endTime: 1703001234747,
 * // }
 *
 * // With callback for logging/metrics
 * const api = client(
 *   http('https://api.example.com'),
 *   timing({
 *     onTiming: (timing, ctx) => {
 *       metrics.recordHistogram('http_request_duration', timing.total, {
 *         url: ctx.url,
 *         method: ctx.method,
 *       });
 *     },
 *   })
 * );
 * ```
 */
export function timing(options: TimingOptions = {}): Policy {
  const { includeInHeaders = false, headerName = 'x-unireq-timing', onTiming } = options;

  return async (ctx: RequestContext, next) => {
    const startTime = Date.now();
    let ttfbTime: number | undefined;

    // Add timing marker to context
    const timedCtx: RequestContext = {
      ...ctx,
      [TIMING_KEY]: {
        startTime,
        markTtfb: () => {
          if (!ttfbTime) {
            ttfbTime = Date.now();
          }
        },
      },
    };

    try {
      const response = await next(timedCtx);

      // Mark TTFB if not already marked
      if (!ttfbTime) {
        ttfbTime = Date.now();
      }

      const endTime = Date.now();

      const timingInfo: TimingInfo = {
        ttfb: ttfbTime - startTime,
        download: endTime - ttfbTime,
        total: endTime - startTime,
        startTime,
        endTime,
      };

      // Call timing callback if provided
      if (onTiming) {
        onTiming(timingInfo, ctx);
      }

      // Add timing to response headers if requested
      let headers = response.headers;
      if (includeInHeaders) {
        headers = {
          ...headers,
          [headerName]: JSON.stringify(timingInfo),
        };
      }

      // Return response with timing
      const timedResponse: TimedResponse = {
        ...response,
        headers,
        timing: timingInfo,
      };

      return timedResponse;
    } catch (error) {
      const endTime = Date.now();

      // Still calculate timing for failed requests
      const timingInfo: TimingInfo = {
        ttfb: ttfbTime ? ttfbTime - startTime : endTime - startTime,
        download: ttfbTime ? endTime - ttfbTime : 0,
        total: endTime - startTime,
        startTime,
        endTime,
      };

      // Call timing callback for errors too
      if (onTiming) {
        onTiming(timingInfo, ctx);
      }

      throw error;
    }
  };
}

/**
 * Get timing marker from context (for transport use)
 * @internal
 */
export function getTimingMarker(ctx: RequestContext): { markTtfb: () => void } | undefined {
  return (ctx as unknown as Record<symbol, unknown>)[TIMING_KEY] as { markTtfb: () => void } | undefined;
}

/**
 * Timing namespace
 */
export const timingPolicy = {
  timing,
  getTimingMarker,
};
