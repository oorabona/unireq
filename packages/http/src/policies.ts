/**
 * HTTP policies for request/response manipulation
 */

import { HTTP_CONFIG, SECURITY_CONFIG } from '@unireq/config';
import type { Policy } from '@unireq/core';
import { appendQueryParams, getHeader, policy, TimeoutError, UnireqError } from '@unireq/core';
import { BODY_TIMEOUT_KEY } from './connectors/undici.js';

/**
 * Per-phase timeout configuration
 * Each phase can have its own timeout in milliseconds
 *
 * Phase timing:
 * - `request`: Connection + sending request + receiving headers (TTFB)
 * - `body`: Time allowed for downloading the response body
 * - `total`: Overall safety limit for the entire request
 */
export interface PhaseTimeouts {
  /**
   * Timeout for the request phase (connection + headers/TTFB)
   * This is the time until the server starts responding
   */
  readonly request?: number;
  /**
   * Timeout for the body download phase
   * Time allowed to receive the response body after headers are received
   */
  readonly body?: number;
  /**
   * Total timeout for the entire request including body download
   * Acts as an overall safety limit
   */
  readonly total?: number;
}

/**
 * Timeout configuration options
 * Can be a simple number (milliseconds) or per-phase configuration
 */
export type TimeoutOptions = number | PhaseTimeouts;

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
 * Creates a combined abort signal from multiple signals using AbortSignal.any()
 * Falls back to manual composition if AbortSignal.any is not available
 * @internal
 */
function combineSignals(signals: AbortSignal[]): { signal: AbortSignal; cleanup: () => void } {
  // No-op cleanup function for cases that don't require resource cleanup
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op for consistent interface
  const noopCleanup = () => {};

  // Filter out undefined signals
  const validSignals = signals.filter((s): s is AbortSignal => s != null);

  /* v8 ignore next 4 -- @preserve defensive: combineSignals is only called with valid signals */
  if (validSignals.length === 0) {
    const controller = new AbortController();
    return { signal: controller.signal, cleanup: noopCleanup };
  }

  const firstSignal = validSignals[0];
  if (validSignals.length === 1 && firstSignal) {
    return { signal: firstSignal, cleanup: noopCleanup };
  }

  // Use native AbortSignal.any() if available (Node 20+)
  if (typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any(validSignals), cleanup: noopCleanup };
  }

  // Fallback: manual composition for older Node versions
  const controller = new AbortController();
  const handlers: Array<() => void> = [];

  for (const signal of validSignals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return { signal: controller.signal, cleanup: noopCleanup };
    }

    const handler = () => controller.abort(signal.reason);
    signal.addEventListener('abort', handler);
    handlers.push(() => signal.removeEventListener('abort', handler));
  }

  const cleanup = () => {
    for (const removeHandler of handlers) {
      removeHandler();
    }
  };

  return { signal: controller.signal, cleanup };
}

/**
 * Adds a timeout to requests using AbortSignal
 * Supports both simple timeout (number) and per-phase timeouts (PhaseTimeouts)
 *
 * @param options - Timeout in milliseconds or per-phase timeout configuration
 * @returns Policy that enforces timeout
 *
 * @example Simple timeout
 * ```typescript
 * timeout(5000) // 5 second timeout
 * ```
 *
 * @example Per-phase timeouts
 * ```typescript
 * timeout({
 *   request: 5000,  // 5s max for connection + TTFB
 *   body: 30000,    // 30s max for body download
 *   total: 60000,   // 60s total safety limit
 * })
 * ```
 */
export function timeout(options: TimeoutOptions): Policy {
  // Normalize options to PhaseTimeouts
  const config: PhaseTimeouts = typeof options === 'number' ? { total: options } : options;

  return policy(
    async (ctx, next) => {
      const signals: AbortSignal[] = [];
      const cleanupFns: Array<() => void> = [];

      // Add user signal if present
      if (ctx.signal) {
        signals.push(ctx.signal);
      }

      // Request phase timeout (connection + TTFB)
      let requestSignal: AbortSignal | undefined;
      if (config.request != null) {
        requestSignal = AbortSignal.timeout(config.request);
        signals.push(requestSignal);
      }

      // Total timeout (entire request including body)
      let totalSignal: AbortSignal | undefined;
      const totalMs = config.total ?? (typeof options === 'number' ? options : undefined);
      if (totalMs != null) {
        totalSignal = AbortSignal.timeout(totalMs);
        signals.push(totalSignal);
      }

      // If no timeout specified, just pass through (but still pass body timeout if set)
      if (signals.length === 0 || (signals.length === 1 && ctx.signal)) {
        // Pass body timeout to connector via context symbol
        if (config.body != null) {
          const ctxWithBodyTimeout = Object.assign({}, ctx, { [BODY_TIMEOUT_KEY]: config.body });
          return next(ctxWithBodyTimeout);
        }
        return next(ctx);
      }

      const { signal: combinedSignal, cleanup } = combineSignals(signals);
      cleanupFns.push(cleanup);

      // Build context with combined signal and optional body timeout
      let modifiedCtx = { ...ctx, signal: combinedSignal };
      if (config.body != null) {
        modifiedCtx = Object.assign(modifiedCtx, { [BODY_TIMEOUT_KEY]: config.body });
      }

      try {
        return await next(modifiedCtx);
      } catch (error) {
        // Determine which timeout fired for appropriate error message
        if (requestSignal?.aborted) {
          const reqError = new TimeoutError(config.request ?? 0, error instanceof Error ? error : undefined);
          reqError.message = `Request timed out after ${config.request}ms (connection/TTFB phase)`;
          throw reqError;
        }

        if (totalSignal?.aborted) {
          throw new TimeoutError(totalMs ?? 0, error instanceof Error ? error : undefined);
        }

        // User abort, body timeout (handled by connector), or other error
        throw error;
      } finally {
        for (const fn of cleanupFns) fn();
      }
    },
    {
      name: 'timeout',
      kind: 'timeout',
      options: typeof options === 'number' ? { ms: options } : { ...options },
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
