/**
 * HTTP policies for request/response manipulation
 */

import { HTTP_CONFIG, SECURITY_CONFIG } from '@unireq/config';
import type { Policy } from '@unireq/core';
import { appendQueryParams, getHeader, policy, UnireqError } from '@unireq/core';

/**
 * Validates header value for CRLF injection (OWASP A03:2021)
 * @param value - Header value to validate
 * @returns True if valid, false if contains CRLF characters
 * @see https://owasp.org/www-community/vulnerabilities/CRLF_Injection
 */
function isValidHeaderValue(value: string): boolean {
  // Reject any header value containing CR (\r) or LF (\n)
  return !SECURITY_CONFIG.CRLF_VALIDATION.PATTERN.test(value);
}

/**
 * Adds custom headers to requests with CRLF injection protection
 * @param headersToAdd - Headers to merge into requests
 * @returns Policy that adds headers
 * @throws Error if header values contain CRLF characters
 */
export function headers(headersToAdd: Record<string, string>): Policy {
  return policy(
    async (ctx, next) => {
      // Validate all header values for CRLF injection
      for (const [name, value] of Object.entries(headersToAdd)) {
        if (!isValidHeaderValue(value)) {
          throw new UnireqError(
            `Invalid header value for "${name}": contains CRLF characters (potential injection attack)`,
            'SECURITY_ERROR',
          );
        }
      }

      const mergedHeaders = {
        ...ctx.headers,
        ...headersToAdd,
      };
      return next({ ...ctx, headers: mergedHeaders });
    },
    {
      name: 'headers',
      kind: 'headers',
      options: { headers: headersToAdd },
    },
  );
}

/**
 * Adds query parameters to requests
 * @param params - Query parameters to append
 * @returns Policy that adds query params
 */
export function query(params: Record<string, string | number | boolean | undefined>): Policy {
  return policy(
    async (ctx, next) => {
      const urlWithQuery = appendQueryParams(ctx.url, params);
      return next({ ...ctx, url: urlWithQuery });
    },
    {
      name: 'query',
      kind: 'other',
      options: { params },
    },
  );
}

/**
 * Adds a timeout to requests using AbortSignal
 * @param ms - Timeout in milliseconds
 * @returns Policy that enforces timeout
 */
export function timeout(ms: number): Policy {
  return policy(
    async (ctx, next) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ms);

      // Abort handler for cleanup
      const abortHandler = () => controller.abort();

      try {
        // Merge with existing signal if present
        if (ctx.signal) {
          ctx.signal.addEventListener('abort', abortHandler);
        }

        const response = await next({ ...ctx, signal: controller.signal });
        return response;
      } finally {
        clearTimeout(timeoutId);
        // Remove event listener to prevent memory leak
        if (ctx.signal) {
          ctx.signal.removeEventListener('abort', abortHandler);
        }
      }
    },
    {
      name: 'timeout',
      kind: 'timeout',
      options: { ms },
    },
  );
}

/**
 * Configuration for redirect policy
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#redirection_messages
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/308
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
 */
export interface RedirectPolicyOptions {
  /** Allowed redirect status codes (default: [307, 308]) */
  readonly allow?: ReadonlyArray<number>;
  /** Follow 303 See Other redirects (default: false) */
  readonly follow303?: boolean;
  /** Maximum number of redirects to follow (default: 5) */
  readonly maxRedirects?: number;
}

/**
 * Handles HTTP redirects with preference for 307/308 (safe redirects)
 * 303 (See Other) is opt-in via follow303 option
 *
 * @param options - Redirect policy configuration
 * @returns Policy that handles redirects
 *
 * @see RFC 9110 - HTTP Semantics (redirection)
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
 */
export function redirectPolicy(options: RedirectPolicyOptions = {}): Policy {
  const {
    allow = [...HTTP_CONFIG.REDIRECT.ALLOWED_STATUS_CODES],
    follow303 = HTTP_CONFIG.REDIRECT.FOLLOW_303,
    maxRedirects = HTTP_CONFIG.REDIRECT.MAX_REDIRECTS,
  } = options;

  return policy(
    async (ctx, next) => {
      let currentCtx = ctx;
      let redirectCount = 0;
      const visitedUrls = new Set<string>();

      while (redirectCount < maxRedirects) {
        const response = await next(currentCtx);

        // Check if redirect
        const { status, headers: responseHeaders } = response;
        const location = getHeader(responseHeaders, 'location');

        if (!location) {
          return response;
        }

        // Check if status is allowed
        const shouldFollow = allow.includes(status) || (follow303 && status === 303);

        if (!shouldFollow) {
          return response;
        }

        // Resolve redirect URL
        const redirectUrl = new URL(location, currentCtx.url).toString();

        // Detect redirect loop
        if (visitedUrls.has(redirectUrl)) {
          throw new UnireqError(`Redirect loop detected: ${redirectUrl}`, 'REDIRECT_LOOP');
        }

        visitedUrls.add(currentCtx.url);

        // Handle 303: convert to GET
        if (status === 303) {
          currentCtx = {
            ...currentCtx,
            url: redirectUrl,
            method: 'GET',
            body: undefined,
          };
        } else {
          // 307/308: preserve method and body
          currentCtx = {
            ...currentCtx,
            url: redirectUrl,
          };
        }

        redirectCount++;
      }

      throw new UnireqError(`Maximum redirect limit (${maxRedirects}) reached for URL: ${ctx.url}`, 'MAX_REDIRECTS');
    },
    {
      name: 'redirectPolicy',
      kind: 'other',
      options: { allow, follow303, maxRedirects },
    },
  );
}
