/**
 * Notice Extraction Utility
 *
 * Extracts notices from HTTP response headers for display in transcript.
 * Handles rate limits, deprecation warnings, and other API notifications.
 */

/**
 * Notice severity levels
 */
export type NoticeSeverity = 'info' | 'warning' | 'error';

/**
 * Extracted notice from response
 */
export interface Notice {
  /** Notice type identifier */
  type: 'rate-limit' | 'deprecation' | 'retry-after' | 'custom';
  /** Severity level */
  severity: NoticeSeverity;
  /** Human-readable message */
  message: string;
  /** Original header name (for debugging) */
  header?: string;
}

/**
 * Headers object type (compatible with fetch Response.headers)
 */
export type HeadersLike = Headers | Map<string, string> | Record<string, string>;

/**
 * Get header value from various header types
 */
function getHeader(headers: HeadersLike, name: string): string | undefined {
  const lowerName = name.toLowerCase();

  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  if (headers instanceof Map) {
    return headers.get(name) ?? headers.get(lowerName) ?? undefined;
  }

  // Record<string, string>
  return headers[name] ?? headers[lowerName] ?? undefined;
}

/**
 * Extract rate limit notices from headers
 */
function extractRateLimitNotices(headers: HeadersLike): Notice[] {
  const notices: Notice[] = [];

  // Standard rate limit headers
  const remaining = getHeader(headers, 'X-RateLimit-Remaining');
  const limit = getHeader(headers, 'X-RateLimit-Limit');
  const reset = getHeader(headers, 'X-RateLimit-Reset');

  if (remaining !== undefined && limit !== undefined) {
    const remainingNum = Number.parseInt(remaining, 10);
    const limitNum = Number.parseInt(limit, 10);

    if (!Number.isNaN(remainingNum) && !Number.isNaN(limitNum)) {
      const percentage = (remainingNum / limitNum) * 100;
      let severity: NoticeSeverity = 'info';
      let prefix = '';

      if (percentage <= 10) {
        severity = 'error';
        prefix = '🔴 ';
      } else if (percentage <= 25) {
        severity = 'warning';
        prefix = '⚠️ ';
      }

      if (percentage <= 25) {
        let message = `${prefix}Rate limit: ${remainingNum}/${limitNum} remaining`;

        if (reset) {
          const resetTime = Number.parseInt(reset, 10);
          if (!Number.isNaN(resetTime)) {
            // Check if it's a Unix timestamp or seconds until reset
            const now = Math.floor(Date.now() / 1000);
            const secondsUntil = resetTime > now ? resetTime - now : resetTime;
            const minutes = Math.ceil(secondsUntil / 60);
            message += ` (resets in ${minutes}min)`;
          }
        }

        notices.push({
          type: 'rate-limit',
          severity,
          message,
          header: 'X-RateLimit-*',
        });
      }
    }
  }

  return notices;
}

/**
 * Extract deprecation notices from headers
 */
function extractDeprecationNotices(headers: HeadersLike): Notice[] {
  const notices: Notice[] = [];

  // Standard Deprecation header (RFC 8594)
  const deprecation = getHeader(headers, 'Deprecation');
  const sunset = getHeader(headers, 'Sunset');
  const link = getHeader(headers, 'Link');

  if (deprecation) {
    let message = '⚠️ This API is deprecated';

    if (sunset) {
      try {
        const sunsetDate = new Date(sunset);
        message += ` and will be removed on ${sunsetDate.toLocaleDateString()}`;
      } catch {
        message += ` (sunset: ${sunset})`;
      }
    }

    // Check for deprecation link
    if (link?.includes('deprecation')) {
      message += ' - see Link header for migration info';
    }

    notices.push({
      type: 'deprecation',
      severity: 'warning',
      message,
      header: 'Deprecation',
    });
  }

  // X-Deprecated custom header
  const xDeprecated = getHeader(headers, 'X-Deprecated');
  if (xDeprecated && !deprecation) {
    notices.push({
      type: 'deprecation',
      severity: 'warning',
      message: `⚠️ Deprecated: ${xDeprecated}`,
      header: 'X-Deprecated',
    });
  }

  return notices;
}

/**
 * Extract retry-after notices from headers
 */
function extractRetryAfterNotices(headers: HeadersLike): Notice[] {
  const notices: Notice[] = [];

  const retryAfter = getHeader(headers, 'Retry-After');

  if (retryAfter) {
    let message: string;
    const seconds = Number.parseInt(retryAfter, 10);

    if (!Number.isNaN(seconds)) {
      if (seconds < 60) {
        message = `⏳ Retry after ${seconds} seconds`;
      } else {
        const minutes = Math.ceil(seconds / 60);
        message = `⏳ Retry after ${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
    } else {
      // HTTP-date format
      try {
        const date = new Date(retryAfter);
        message = `⏳ Retry after ${date.toLocaleTimeString()}`;
      } catch {
        message = `⏳ Retry after: ${retryAfter}`;
      }
    }

    notices.push({
      type: 'retry-after',
      severity: 'warning',
      message,
      header: 'Retry-After',
    });
  }

  return notices;
}

/**
 * Extract custom API notices from headers
 */
function extractCustomNotices(headers: HeadersLike): Notice[] {
  const notices: Notice[] = [];

  // X-API-Warn header
  const apiWarn = getHeader(headers, 'X-API-Warn');
  if (apiWarn) {
    notices.push({
      type: 'custom',
      severity: 'warning',
      message: `⚠️ ${apiWarn}`,
      header: 'X-API-Warn',
    });
  }

  // X-API-Notice header
  const apiNotice = getHeader(headers, 'X-API-Notice');
  if (apiNotice) {
    notices.push({
      type: 'custom',
      severity: 'info',
      message: `ℹ️ ${apiNotice}`,
      header: 'X-API-Notice',
    });
  }

  // Warning header (RFC 7234)
  const warning = getHeader(headers, 'Warning');
  if (warning) {
    // Parse warning: code agent "text" [date]
    const match = warning.match(/^\d+\s+\S+\s+"([^"]+)"/);
    const message = match ? match[1] : warning;
    notices.push({
      type: 'custom',
      severity: 'warning',
      message: `⚠️ ${message}`,
      header: 'Warning',
    });
  }

  return notices;
}

/**
 * Extract all notices from HTTP response headers
 *
 * @param headers - Response headers (Headers, Map, or plain object)
 * @returns Array of notices to display
 *
 * @example
 * ```typescript
 * const response = await fetch(url);
 * const notices = extractNotices(response.headers);
 * for (const notice of notices) {
 *   console.log(notice.message);
 * }
 * ```
 */
export function extractNotices(headers: HeadersLike): Notice[] {
  return [
    ...extractRateLimitNotices(headers),
    ...extractDeprecationNotices(headers),
    ...extractRetryAfterNotices(headers),
    ...extractCustomNotices(headers),
  ];
}

/**
 * Check if headers contain any notices
 */
export function hasNotices(headers: HeadersLike): boolean {
  return extractNotices(headers).length > 0;
}
