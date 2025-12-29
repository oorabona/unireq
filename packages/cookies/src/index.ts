/**
 * @unireq/cookies - Cookie jar integration with tough-cookie and http-cookie-agent/undici
 * @see https://www.npmjs.com/package/tough-cookie
 * @see https://www.npmjs.com/package/http-cookie-agent
 */

import { SECURITY_CONFIG } from '@unireq/config';
import type { Policy, RequestContext, Response } from '@unireq/core';

/** Cookie jar interface (compatible with tough-cookie) */
export interface CookieJar {
  getCookieString: (url: string) => Promise<string> | string;
  setCookie: (cookie: string, url: string) => Promise<void> | void;
}

/**
 * Validates cookie value for CRLF injection (OWASP A03:2021)
 * @param value - Cookie value to validate
 * @returns True if valid, false if contains CRLF characters
 * @see https://owasp.org/www-community/vulnerabilities/CRLF_Injection
 */
function isValidCookieValue(value: string): boolean {
  // Reject any cookie value containing CR (\r) or LF (\n)
  return !SECURITY_CONFIG.CRLF_VALIDATION.PATTERN.test(value);
}

/**
 * Creates a cookie jar policy
 * Integrates with tough-cookie CookieJar
 *
 * @param jar - Cookie jar instance (tough-cookie CookieJar)
 * @returns Policy that manages cookies
 *
 * @example
 * ```ts
 * import { CookieJar } from 'tough-cookie';
 *
 * const jar = new CookieJar();
 * const cookiePolicy = cookieJar(jar);
 * ```
 *
 * Note: For proxy support, use http-cookie-agent with undici:
 * ```ts
 * import { CookieJar } from 'tough-cookie';
 * import { CookieAgent } from 'http-cookie-agent/undici';
 *
 * const jar = new CookieJar();
 * const agent = new CookieAgent({ cookies: { jar } });
 * // Use agent with fetchTransport or undici
 * ```
 */
export function cookieJar(jar: CookieJar): Policy {
  return async (ctx: RequestContext, next: (ctx: RequestContext) => Promise<Response>) => {
    // Get cookies for this URL
    const cookies = await Promise.resolve(jar.getCookieString(ctx.url));

    // Validate cookies for CRLF injection
    if (cookies && !isValidCookieValue(cookies)) {
      throw new Error('Invalid cookie value: contains CRLF characters (potential injection attack)');
    }

    // Add cookies to request if present
    const updatedCtx = cookies
      ? {
          ...ctx,
          headers: {
            ...ctx.headers,
            cookie: cookies,
          },
        }
      : ctx;

    // Execute request
    const response = await next(updatedCtx);

    // Store Set-Cookie headers from response
    const setCookieHeaders = response.headers['set-cookie'] || response.headers['Set-Cookie'];

    if (setCookieHeaders) {
      const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

      for (const cookie of cookieArray) {
        // Validate Set-Cookie header for CRLF injection
        if (!isValidCookieValue(cookie)) {
          console.warn('Skipping invalid Set-Cookie header: contains CRLF characters (potential injection attack)');
          continue;
        }

        await Promise.resolve(jar.setCookie(cookie, ctx.url));
      }
    }

    return response;
  };
}
