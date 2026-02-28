/**
 * HTTP Range requests and resume support (RFC 7233)
 * @see https://datatracker.ietf.org/doc/html/rfc7233
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416
 */

import type { Policy } from '@unireq/core';

/**
 * Range request options
 */
export interface RangeOptions {
  /** Start byte (inclusive) */
  readonly start: number;
  /** End byte (inclusive, optional) */
  readonly end?: number;
  /** Unit (default: 'bytes') */
  readonly unit?: string;
}

/**
 * Creates a Range request policy
 * @param options - Range request options
 * @returns Policy that adds Range header
 *
 * @example
 * ```ts
 * // Request first 1024 bytes
 * const policy = range({ start: 0, end: 1023 });
 *
 * // Request from byte 1024 to end
 * const policy = range({ start: 1024 });
 * ```
 */
export function range(options: RangeOptions): Policy {
  const { start, end, unit = 'bytes' } = options;

  return async (ctx, next) => {
    const rangeValue = end !== undefined ? `${start}-${end}` : `${start}-`;

    return next({
      ...ctx,
      headers: {
        ...ctx.headers,
        range: `${unit}=${rangeValue}`,
      },
    });
  };
}

/**
 * Resume download state
 */
export interface ResumeState {
  /** Bytes already downloaded */
  readonly downloaded: number;
  /** Total size (if known) */
  readonly total?: number;
}

/**
 * Creates a resume download policy
 * Automatically uses Range header based on downloaded state
 *
 * @param state - Current download state
 * @returns Policy that resumes from last position
 *
 * @example
 * ```ts
 * const state = { downloaded: 5000, total: 10000 };
 * const resumePolicy = resume(state);
 * ```
 */
export function resume(state: ResumeState): Policy {
  return async (ctx, next) => {
    if (state.downloaded === 0) {
      // No resume needed
      return next(ctx);
    }

    const response = await next({
      ...ctx,
      headers: {
        ...ctx.headers,
        range: `bytes=${state.downloaded}-`,
      },
    });

    // Server honored the Range request — partial content as expected
    if (response.status === 206) {
      return response;
    }

    // Server doesn't support ranges — returned full content.
    // Mark via header so consumers know not to append but to overwrite.
    return {
      ...response,
      headers: {
        ...response.headers,
        'x-resume-reset': 'true',
      },
    };
  };
}

/**
 * Checks if server supports range requests
 * @param response - Response to check
 * @returns True if range requests are supported
 */
export function supportsRange(response: { readonly headers: Record<string, string> }): boolean {
  const acceptRanges = response.headers['accept-ranges'] || response.headers['Accept-Ranges'];
  return acceptRanges === 'bytes';
}

/**
 * Parses Content-Range header
 * @param header - Content-Range header value
 * @returns Parsed range information
 *
 * @example
 * ```ts
 * parseContentRange('bytes 200-1023/1024')
 * // { start: 200, end: 1023, total: 1024, unit: 'bytes' }
 * ```
 */
export function parseContentRange(header: string): {
  start: number;
  end: number;
  total: number | undefined;
  unit: string;
} | null {
  const match = /^(\w+)\s+(\d+)-(\d+)\/(\d+|\*)$/.exec(header);
  if (!match) return null;

  const [, unit, startStr, endStr, totalStr] = match;

  return {
    unit: unit as string,
    start: Number.parseInt(startStr as string, 10),
    end: Number.parseInt(endStr as string, 10),
    total: totalStr === '*' ? undefined : Number.parseInt(totalStr as string, 10),
  };
}
