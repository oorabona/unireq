/**
 * @unireq/presets - Pre-configured client presets for common use cases
 */

// Fluent builder API
export { PresetBuilder, preset } from './builder.js';
export { type FtpClient, FtpFacadeBuilder, type FtpFileEntry, ftpPreset } from './ftp-facade.js';
export { H2FacadeBuilder, h2Preset } from './h2-facade.js';
// Protocol-specific facades
export {
  type ImapAppendResult,
  type ImapClient,
  ImapFacadeBuilder,
  type ImapMessage,
  imapPreset,
} from './imap-facade.js';
export {
  type EmailAttachment,
  type EmailMessage,
  type SendResult,
  type SmtpClient,
  SmtpFacadeBuilder,
  smtpPreset,
} from './smtp-facade.js';

import { backoff, client, either, type Policy, retry } from '@unireq/core';
import {
  accept,
  headers as headersPolicy,
  http,
  httpRetryPredicate,
  json,
  type MultipartField,
  type MultipartFile,
  type MultipartValidationOptions,
  multipart,
  query as queryPolicy,
  type ResumeState,
  rateLimitDelay,
  redirectPolicy,
  resume,
  text,
  timeout as timeoutPolicy,
} from '@unireq/http';
import { xoauth2 } from '@unireq/imap';
import { type JWKSSource, oauthBearer } from '@unireq/oauth';
import { xml } from '@unireq/xml';

/**
 * Options for httpsJsonAuthSmart preset
 */
export interface HttpsJsonAuthSmartOptions {
  /** OAuth token supplier */
  tokenSupplier?: () => string | Promise<string>;
  /** JWKS source for secure JWT verification */
  jwks?: JWKSSource;
  /** Allow unsafe mode without JWKS verification (NOT RECOMMENDED) */
  allowUnsafeMode?: boolean;
  /** Custom policies to add to the client */
  policies?: Policy[];
}

/**
 * HTTPS JSON client with smart auth, rate limiting, and retry
 * - Accept: application/json or application/xml
 * - Redirects: 307/308 only (safe redirects)
 * - Rate limit aware (429/503 + Retry-After)
 * - Retry with exponential backoff fallback
 * - OAuth Bearer with auto-refresh (optional)
 * - Content negotiation: JSON or XML
 *
 * Uses new composable delay strategy architecture:
 * - rateLimitDelay respects Retry-After headers (429/503)
 * - backoff provides exponential backoff with jitter as fallback
 * - Strategies evaluated in order for optimal retry behavior
 *
 * @param uri - Base URI for the client
 * @param optionsOrSupplier - OAuth token supplier OR options object
 * @returns Promise that resolves to configured client
 *
 * @example
 * ```ts
 * // Simple usage with token supplier (unsafe mode required if no JWKS)
 * const client = await httpsJsonAuthSmart(
 *   'https://api.example.com',
 *   {
 *     tokenSupplier: async () => 'my-token',
 *     allowUnsafeMode: true // Required for dev/test without JWKS
 *   }
 * );
 *
 * // Secure usage with JWKS
 * const client = await httpsJsonAuthSmart(
 *   'https://api.example.com',
 *   {
 *     tokenSupplier: async () => 'my-token',
 *     jwks: { type: 'url', url: 'https://...' }
 *   }
 * );
 * ```
 */
export async function httpsJsonAuthSmart(
  uri: string,
  optionsOrSupplier?: HttpsJsonAuthSmartOptions | (() => string | Promise<string>),
) {
  const policies: Policy[] = [
    accept(['application/json', 'application/xml']),
    redirectPolicy({ allow: [307, 308] }),
    retry(
      httpRetryPredicate({
        methods: ['GET', 'PUT', 'DELETE'],
        statusCodes: [408, 429, 500, 502, 503, 504],
      }),
      [
        rateLimitDelay({ maxWait: 60000 }), // Respect Retry-After headers first
        backoff({ initial: 1000, max: 30000, jitter: true }), // Fallback to exponential backoff
      ],
      { tries: 3 },
    ),
  ];

  // Normalize options
  let options: HttpsJsonAuthSmartOptions = {};
  if (typeof optionsOrSupplier === 'function') {
    options = { tokenSupplier: optionsOrSupplier };
  } else if (optionsOrSupplier) {
    options = optionsOrSupplier;
  }

  const { tokenSupplier, jwks, allowUnsafeMode, policies: userPolicies } = options;

  // Add OAuth if token supplier provided
  if (tokenSupplier) {
    policies.push(oauthBearer({ tokenSupplier, jwks, allowUnsafeMode }));
  }

  // Add either JSON or XML parser based on content-type
  const xmlPolicy = xml();

  policies.push(
    either(
      /* v8 ignore next 4 - either policy predicate, covered by either.ts tests */
      (ctx) => {
        const accept = ctx.headers['accept'] || ctx.headers['Accept'] || '';
        return accept.includes('application/json');
      },
      json(),
      xmlPolicy,
    ),
  );

  if (userPolicies) {
    policies.push(...userPolicies);
  }

  return client(http(uri), ...policies);
}

/**
 * Options for httpUploadGeneric preset
 */
export interface HttpUploadGenericOptions {
  /** Custom policies to add to the client */
  policies?: Policy[];
}

/**
 * Generic HTTP upload client
 * - Multipart form data if files provided
 * - Otherwise, octet-stream
 *
 * @param uri - Base URI for the client
 * @param options - Configuration options
 * @returns Configured client
 */
export function httpUploadGeneric(uri?: string, options?: HttpUploadGenericOptions) {
  const policies = options?.policies || [];
  return client(http(uri), ...policies);
}

/**
 * Creates a multipart upload policy with security validation
 * @param files - Files to upload
 * @param fields - Additional fields
 * @param options - Validation options
 * @returns Policy for multipart upload
 */
export function createMultipartUpload(
  files: ReadonlyArray<MultipartFile>,
  fields?: ReadonlyArray<MultipartField>,
  options?: MultipartValidationOptions,
) {
  return multipart(files, fields, options);
}

/**
 * Options for httpDownloadResume preset
 */
export interface HttpDownloadResumeOptions {
  /** Resume state */
  resumeState?: ResumeState;
  /** Custom policies to add to the client */
  policies?: Policy[];
}

/**
 * HTTP download with resume support
 * - Uses Range requests if server supports Accept-Ranges: bytes
 * - Automatic resume from last position
 *
 * @param uri - Base URI for the client
 * @param optionsOrState - Resume state or options object
 * @returns Configured client
 *
 * @example
 * ```ts
 * const downloader = httpDownloadResume(
 *   'https://cdn.example.com',
 *   { downloaded: 5000 }
 * );
 * ```
 */
export function httpDownloadResume(uri: string, optionsOrState?: ResumeState | HttpDownloadResumeOptions) {
  let policies: Policy[] = [];
  let resumeState: ResumeState | undefined;

  if (optionsOrState) {
    if ('downloaded' in optionsOrState) {
      // It's a ResumeState
      resumeState = optionsOrState as ResumeState;
    } else {
      // It's HttpDownloadResumeOptions
      const options = optionsOrState as HttpDownloadResumeOptions;
      resumeState = options.resumeState;
      if (options.policies) {
        policies = options.policies;
      }
    }
  }

  const clientPolicies = [...policies];
  if (resumeState) {
    clientPolicies.push(resume(resumeState));
  }

  return client(http(uri), ...clientPolicies);
}

/**
 * Gmail IMAP client with XOAUTH2
 * - XOAUTH2 authentication
 * - SELECT INBOX
 *
 * @param tokenSupplier - OAuth token supplier
 * @returns Policy for Gmail IMAP
 *
 * @example
 * ```ts
 * const gmailPolicy = gmailImap(async () => 'gmail-access-token');
 * ```
 */
export function gmailImap(tokenSupplier: () => string | Promise<string>): Policy {
  return async (ctx, next) => {
    return xoauth2({ tokenSupplier })(
      {
        ...ctx,
        operation: 'select',
        mailbox: 'INBOX',
      },
      next,
    );
  };
}

// Re-export commonly used utilities
export {
  type MultipartField,
  type MultipartFile,
  type MultipartValidationOptions,
  multipart,
  type ResumeState,
  resume,
} from '@unireq/http';

/**
 * Options for the simple httpClient helper
 */
export interface HttpClientOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Default headers to send with every request */
  headers?: Record<string, string>;
  /** Default query parameters to add to every request */
  query?: Record<string, string | number | boolean | undefined>;
  /** Parse responses as JSON (default: true) */
  json?: boolean;
  /** Follow redirects (default: true, 307/308 only for safety) */
  followRedirects?: boolean;
  /** Additional custom policies */
  policies?: Policy[];
}

/**
 * Simple HTTP client factory with sensible defaults
 *
 * Creates a pre-configured HTTP client for common use cases.
 * For more advanced configuration, use the fluent `preset` builder.
 *
 * @param baseUrl - Optional base URL for all requests
 * @param options - Configuration options
 * @returns Configured HTTP client
 *
 * @example
 * ```ts
 * // Basic usage - minimal configuration
 * const api = httpClient('https://api.example.com');
 * const response = await api.get<User[]>('/users');
 *
 * // With options
 * const api = httpClient('https://api.example.com', {
 *   timeout: 5000,
 *   headers: { 'X-API-Key': 'secret' },
 * });
 *
 * // With default query parameters (added to every request)
 * const api = httpClient('https://api.example.com', {
 *   query: { api_key: 'secret', format: 'json' },
 * });
 * // GET /users?api_key=secret&format=json
 * await api.get('/users');
 *
 * // Without base URL (for ad-hoc requests)
 * const api = httpClient();
 * await api.get('https://httpbin.org/get');
 *
 * // Using safe methods with Result type
 * const result = await api.safe.get<User>('/users/1');
 * result.match({
 *   ok: (response) => console.log(response.data),
 *   err: (error) => console.error(error.message),
 * });
 * ```
 */
export function httpClient(baseUrl?: string, options: HttpClientOptions = {}) {
  const {
    timeout: timeoutMs,
    headers: defaultHeaders,
    query: defaultQuery,
    json: useJson = true,
    followRedirects = true,
    policies: userPolicies = [],
  } = options;

  const policies: Policy[] = [];

  // Add Accept header for JSON
  if (useJson) {
    policies.push(accept(['application/json']));
  }

  // Add redirect policy (safe redirects only by default)
  if (followRedirects) {
    policies.push(redirectPolicy({ allow: [307, 308] }));
  }

  // Add default headers
  if (defaultHeaders && Object.keys(defaultHeaders).length > 0) {
    policies.push(headersPolicy(defaultHeaders));
  }

  // Add default query parameters
  if (defaultQuery && Object.keys(defaultQuery).length > 0) {
    policies.push(queryPolicy(defaultQuery));
  }

  // Add timeout
  if (timeoutMs) {
    policies.push(timeoutPolicy(timeoutMs));
  }

  // Add JSON parser
  if (useJson) {
    policies.push(json());
  }

  // Add user policies
  policies.push(...userPolicies);

  return client(http(baseUrl), ...policies);
}

/**
 * Options for the restApi preset
 */
export interface RestApiOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Default headers to send with every request */
  headers?: Record<string, string>;
  /** Default query parameters to add to every request */
  query?: Record<string, string | number | boolean | undefined>;
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Additional custom policies */
  policies?: Policy[];
}

/**
 * REST API client preset with production-ready defaults
 *
 * Optimized for consuming REST APIs with:
 * - JSON Accept header and response parsing
 * - Safe redirects (307/308 only)
 * - Retry on transient errors (408, 429, 500, 502, 503, 504)
 * - Rate limit awareness (respects Retry-After headers)
 * - Exponential backoff with jitter
 *
 * @param baseUrl - Base URL for the API
 * @param options - Configuration options
 * @returns Configured HTTP client
 *
 * @example
 * ```ts
 * const api = restApi('https://api.example.com', {
 *   headers: { 'Authorization': 'Bearer token' },
 *   timeout: 10000,
 * });
 *
 * const users = await api.get('/users');
 * const created = await api.post('/users', { body: { name: 'John' } });
 * ```
 */
export function restApi(baseUrl: string, options: RestApiOptions = {}) {
  const {
    timeout: timeoutMs = 30000,
    headers: defaultHeaders,
    query: defaultQuery,
    retries = 3,
    policies: userPolicies = [],
  } = options;

  const policies: Policy[] = [
    // Accept JSON responses
    accept(['application/json']),
    // Safe redirects only (307/308 preserve method)
    redirectPolicy({ allow: [307, 308] }),
    // Retry on transient errors with rate limit awareness
    retry(
      httpRetryPredicate({
        methods: ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'],
        statusCodes: [408, 429, 500, 502, 503, 504],
      }),
      [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 1000, max: 30000, jitter: true })],
      { tries: retries },
    ),
  ];

  // Add default headers
  if (defaultHeaders && Object.keys(defaultHeaders).length > 0) {
    policies.push(headersPolicy(defaultHeaders));
  }

  // Add default query parameters
  if (defaultQuery && Object.keys(defaultQuery).length > 0) {
    policies.push(queryPolicy(defaultQuery));
  }

  // Add timeout
  policies.push(timeoutPolicy(timeoutMs));

  // Parse JSON responses
  policies.push(json());

  // Add user policies
  policies.push(...userPolicies);

  return client(http(baseUrl), ...policies);
}

/**
 * Options for the webhook preset
 */
export interface WebhookOptions {
  /** Timeout in milliseconds (default: 10000 - webhooks should fail fast) */
  timeout?: number;
  /** Default headers to send with every request */
  headers?: Record<string, string>;
  /** Number of retry attempts (default: 5 - webhooks need reliable delivery) */
  retries?: number;
  /** Additional custom policies */
  policies?: Policy[];
}

/**
 * Webhook sender preset optimized for reliable event delivery
 *
 * Designed for sending webhooks/callbacks with:
 * - JSON Accept header and response parsing
 * - No redirects (security: webhooks should go to exact URL)
 * - Aggressive retry with exponential backoff (5 attempts by default)
 * - Rate limit awareness
 * - Short timeout (fail fast, retry quickly)
 *
 * @param baseUrl - Optional base URL for webhooks
 * @param options - Configuration options
 * @returns Configured HTTP client
 *
 * @example
 * ```ts
 * const hooks = webhook('https://hooks.example.com', {
 *   headers: { 'X-Webhook-Secret': 'secret' },
 * });
 *
 * await hooks.post('/events', { body: { type: 'order.created', data: order } });
 * ```
 */
export function webhook(baseUrl?: string, options: WebhookOptions = {}) {
  const { timeout: timeoutMs = 10000, headers: defaultHeaders, retries = 5, policies: userPolicies = [] } = options;

  const policies: Policy[] = [
    // Accept JSON responses
    accept(['application/json']),
    // No redirects - webhooks must hit exact URL for security
    redirectPolicy({ allow: [] }),
    // Aggressive retry for reliable delivery
    retry(
      httpRetryPredicate({
        methods: ['POST', 'PUT'],
        statusCodes: [408, 429, 500, 502, 503, 504],
      }),
      [rateLimitDelay({ maxWait: 30000 }), backoff({ initial: 500, max: 15000, jitter: true })],
      { tries: retries },
    ),
  ];

  // Add default headers
  if (defaultHeaders && Object.keys(defaultHeaders).length > 0) {
    policies.push(headersPolicy(defaultHeaders));
  }

  // Short timeout - fail fast
  policies.push(timeoutPolicy(timeoutMs));

  // Parse JSON responses
  policies.push(json());

  // Add user policies
  policies.push(...userPolicies);

  return client(http(baseUrl), ...policies);
}

/**
 * Options for the scraper preset
 */
export interface ScraperOptions {
  /** Timeout in milliseconds (default: 60000 - pages can be slow) */
  timeout?: number;
  /** User-Agent header (default: generic browser-like agent) */
  userAgent?: string;
  /** Default headers to send with every request */
  headers?: Record<string, string>;
  /** Follow redirects (default: true, all redirect types) */
  followRedirects?: boolean;
  /** Additional custom policies */
  policies?: Policy[];
}

/** Default User-Agent for scraping (looks like a modern browser) */
const DEFAULT_SCRAPER_USER_AGENT = 'Mozilla/5.0 (compatible; UnireqScraper/1.0; +https://github.com/oorabona/unireq)';

/**
 * Web scraper preset optimized for fetching HTML content
 *
 * Designed for web scraping with:
 * - Accept HTML and text content
 * - Follow all redirect types (301, 302, 307, 308)
 * - Browser-like User-Agent (configurable)
 * - Longer timeout for slow pages
 * - Text response parsing (for HTML)
 *
 * @param baseUrl - Optional base URL
 * @param options - Configuration options
 * @returns Configured HTTP client
 *
 * @example
 * ```ts
 * const crawler = scraper('https://example.com', {
 *   userAgent: 'MyBot/1.0',
 *   timeout: 30000,
 * });
 *
 * const html = await crawler.get('/page');
 * console.log(html.data); // HTML string
 * ```
 */
export function scraper(baseUrl?: string, options: ScraperOptions = {}) {
  const {
    timeout: timeoutMs = 60000,
    userAgent = DEFAULT_SCRAPER_USER_AGENT,
    headers: defaultHeaders,
    followRedirects = true,
    policies: userPolicies = [],
  } = options;

  const policies: Policy[] = [
    // Accept HTML and text
    accept(['text/html', 'text/plain', 'application/xhtml+xml']),
  ];

  // Follow all redirects (common for web pages)
  if (followRedirects) {
    policies.push(redirectPolicy({ allow: [301, 302, 307, 308] }));
  }

  // Set User-Agent (important for scraping)
  const allHeaders = {
    'User-Agent': userAgent,
    ...defaultHeaders,
  };
  policies.push(headersPolicy(allHeaders));

  // Longer timeout for slow pages
  policies.push(timeoutPolicy(timeoutMs));

  // Parse as text (HTML)
  policies.push(text());

  // Add user policies
  policies.push(...userPolicies);

  return client(http(baseUrl), ...policies);
}
