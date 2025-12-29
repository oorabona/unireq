/**
 * HTTP response parsers with content negotiation
 */

import type { Policy } from '@unireq/core';
import { getHeader, NotAcceptableError, setHeader } from '@unireq/core';

/**
 * Options for accept() policy
 */
export interface AcceptOptions {
  /**
   * Whether to validate response content-type matches Accept header
   * @default true
   */
  readonly validate?: boolean;
  /**
   * Allow empty content-type header (some APIs don't send it despite having valid content)
   * @default false
   */
  readonly allowMissingContentType?: boolean;
}

/**
 * Sets Accept header for content negotiation
 * @param mediaTypes - Array of acceptable media types
 * @param options - Validation options
 * @returns Policy that sets Accept header
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept
 */
export function accept(mediaTypes: ReadonlyArray<string>, options: AcceptOptions = {}): Policy {
  const { validate = true, allowMissingContentType = false } = options;

  return async (ctx, next) => {
    const acceptHeader = mediaTypes.join(', ');

    // Skip setting Accept header for HEAD requests (header won't be used anyway)
    const shouldSetHeader = ctx.method !== 'HEAD';

    const response = await next({
      ...ctx,
      headers: shouldSetHeader ? setHeader(ctx.headers, 'accept', acceptHeader) : ctx.headers,
    });

    // Skip validation if disabled or for responses without body
    // - 204 No Content: successful request with no body
    // - 205 Reset Content: successful request with no body
    // - 304 Not Modified: cached response with no body
    // - HEAD requests: never have a body
    const hasNoBody =
      response.status === 204 || response.status === 205 || response.status === 304 || ctx.method === 'HEAD';

    if (!validate || hasNoBody) {
      return response;
    }

    // Validate response content-type matches Accept header
    const contentType = getHeader(response.headers, 'content-type') || '';

    // Handle missing content-type
    if (!contentType) {
      if (allowMissingContentType) {
        return response;
      }
      // Throw error for missing content-type unless explicitly allowed
      if (response.status >= 200 && response.status < 300) {
        throw new NotAcceptableError(Array.from(mediaTypes), contentType);
      }
    }

    const isAcceptable = mediaTypes.some(
      (type) =>
        contentType.includes(type) ||
        type === '*/*' ||
        (type.endsWith('/*') && contentType.startsWith(type.slice(0, -2))),
    );

    if (!isAcceptable && response.status >= 200 && response.status < 300) {
      throw new NotAcceptableError(Array.from(mediaTypes), contentType);
    }

    return response;
  };
}

/**
 * Parses response as JSON
 * @returns Policy that parses JSON responses
 */
export function json(): Policy {
  return async (ctx, next) => {
    const response = await next(ctx);

    // Parse JSON from text or buffer (must come before generic object check)
    if (typeof response.data === 'string') {
      return {
        ...response,
        data: JSON.parse(response.data),
      };
    }

    if (response.data instanceof ArrayBuffer) {
      const text = new TextDecoder().decode(response.data);
      return {
        ...response,
        data: JSON.parse(text),
      };
    }

    // If data is already parsed object, return as-is
    if (typeof response.data === 'object' && response.data !== null) {
      return response;
    }

    return response;
  };
}

/**
 * Parses response as plain text
 * @returns Policy that parses text responses
 */
export function text(): Policy {
  return async (ctx, next) => {
    const response = await next(ctx);

    // If data is already text, return as-is
    if (typeof response.data === 'string') {
      return response;
    }

    // Convert buffer to text
    if (response.data instanceof ArrayBuffer) {
      return {
        ...response,
        data: new TextDecoder().decode(response.data),
      };
    }

    return response;
  };
}

/**
 * Returns raw response data without parsing
 * @returns Policy that passes through response data
 */
export function raw(): Policy {
  return async (ctx, next) => next(ctx);
}
