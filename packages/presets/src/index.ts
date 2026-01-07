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
  type ResumeState,
  rateLimitDelay,
  redirectPolicy,
  resume,
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
