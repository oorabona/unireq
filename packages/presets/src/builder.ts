/**
 * Fluent preset builder for composable HTTP client configuration
 * Supports chainable syntax like: preset.api.json.retry.timeout.build(uri)
 */

import {
  type BackoffOptions,
  backoff,
  circuitBreaker,
  client,
  type Logger,
  log,
  type Policy,
  retry,
  throttle,
  type ValidationAdapter,
  validate,
} from '@unireq/core';
import {
  accept,
  type CachePolicyOptions,
  cache,
  conditional,
  type ErrorInterceptor,
  type ETagPolicyOptions,
  headers as headersPolicy,
  http,
  httpRetryPredicate,
  interceptError,
  interceptRequest,
  interceptResponse,
  type LastModifiedPolicyOptions,
  parse,
  query as queryPolicy,
  type RequestInterceptor,
  type ResponseInterceptor,
  rateLimitDelay,
  redirectPolicy,
  timeout as timeoutPolicy,
} from '@unireq/http';
import { type JWKSSource, oauthBearer, type TokenSupplier } from '@unireq/oauth';
import { type FtpFacadeBuilder, ftpPreset } from './ftp-facade.js';
import { type H2FacadeBuilder, h2Preset } from './h2-facade.js';
import { type ImapFacadeBuilder, imapPreset } from './imap-facade.js';
import { type SmtpFacadeBuilder, smtpPreset } from './smtp-facade.js';

/**
 * Configuration accumulated during builder chain
 */
interface PresetConfig {
  baseUri?: string;
  json?: boolean;
  xml?: boolean;
  retry?: RetryConfig | boolean;
  timeout?: number;
  oauth?: OAuthConfig;
  cache?: CachePolicyOptions | boolean;
  logging?: Logger | boolean;
  redirect?: RedirectConfig | boolean;
  circuitBreaker?: CircuitBreakerConfig | boolean;
  throttle?: ThrottleConfig | boolean;
  validate?: { schema: unknown; adapter: ValidationAdapter<unknown, unknown> };
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  conditional?: ConditionalConfig | boolean;
  interceptors?: InterceptorsConfig;
  customPolicies?: Policy[];
}

interface RetryConfig {
  tries?: number;
  methods?: string[];
  statusCodes?: number[];
  backoff?: BackoffOptions;
  respectRateLimit?: boolean;
}

interface OAuthConfig {
  tokenSupplier: TokenSupplier;
  jwks?: JWKSSource;
  allowUnsafeMode?: boolean;
}

interface RedirectConfig {
  allow?: number[];
}

interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  threshold?: number;
  /** Time in ms to wait before trying again */
  resetTimeout?: number;
}

interface ThrottleConfig {
  /** Number of requests allowed per interval */
  limit?: number;
  /** Interval in milliseconds (default: 1000) */
  interval?: number;
}

type ConditionalConfig = ETagPolicyOptions & LastModifiedPolicyOptions;

interface InterceptorsConfig {
  request?: RequestInterceptor | RequestInterceptor[];
  response?: ResponseInterceptor | ResponseInterceptor[];
  error?: ErrorInterceptor | ErrorInterceptor[];
}

/**
 * Fluent builder for HTTP API clients
 * All chainable properties return new PresetBuilder instances for full chaining support
 *
 * @example Default config via property chaining
 * ```ts
 * preset.api.json.retry.timeout.build('https://api.example.com')
 * ```
 *
 * @example Custom config via methods
 * ```ts
 * preset.api.json.withRetry({ tries: 5 }).withTimeout(10000).build('https://api.example.com')
 * ```
 */
export class PresetBuilder {
  private config: PresetConfig;

  constructor(config: PresetConfig = {}) {
    this.config = { ...config };
  }

  // =========================================================================
  // Property-based chaining (uses sensible defaults)
  // =========================================================================

  /**
   * Add JSON request/response handling
   */
  get json(): PresetBuilder {
    return new PresetBuilder({ ...this.config, json: true });
  }

  /**
   * Add XML request/response handling
   */
  get xml(): PresetBuilder {
    return new PresetBuilder({ ...this.config, xml: true });
  }

  /**
   * Add retry with exponential backoff (default: 3 tries)
   */
  get retry(): PresetBuilder {
    return new PresetBuilder({ ...this.config, retry: true });
  }

  /**
   * Add request timeout (default: 30s)
   */
  get timeout(): PresetBuilder {
    return new PresetBuilder({ ...this.config, timeout: 30000 });
  }

  /**
   * Add HTTP caching (default: 5min TTL)
   */
  get cache(): PresetBuilder {
    return new PresetBuilder({ ...this.config, cache: true });
  }

  /**
   * Add request/response logging (default console logger)
   */
  get logging(): PresetBuilder {
    return new PresetBuilder({ ...this.config, logging: true });
  }

  /**
   * Add safe redirect handling (307/308 only)
   */
  get redirect(): PresetBuilder {
    return new PresetBuilder({ ...this.config, redirect: true });
  }

  /**
   * Add circuit breaker (default: 5 failures, 30s reset)
   */
  get circuitBreaker(): PresetBuilder {
    return new PresetBuilder({ ...this.config, circuitBreaker: true });
  }

  /**
   * Add request throttling (default: 10 req/s)
   */
  get throttle(): PresetBuilder {
    return new PresetBuilder({ ...this.config, throttle: true });
  }

  /**
   * Add conditional requests (ETag + Last-Modified)
   */
  get conditional(): PresetBuilder {
    return new PresetBuilder({ ...this.config, conditional: true });
  }

  // =========================================================================
  // Method-based configuration (for custom options)
  // =========================================================================

  /**
   * Set base URI for the client
   */
  uri(baseUri: string): PresetBuilder {
    return new PresetBuilder({ ...this.config, baseUri });
  }

  /**
   * Add retry with custom configuration
   */
  withRetry(options: RetryConfig): PresetBuilder {
    return new PresetBuilder({ ...this.config, retry: options });
  }

  /**
   * Add timeout with custom milliseconds
   */
  withTimeout(ms: number): PresetBuilder {
    return new PresetBuilder({ ...this.config, timeout: ms });
  }

  /**
   * Add caching with custom configuration
   */
  withCache(options: CachePolicyOptions): PresetBuilder {
    return new PresetBuilder({ ...this.config, cache: options });
  }

  /**
   * Add logging with custom logger
   */
  withLogging(logger: Logger): PresetBuilder {
    return new PresetBuilder({ ...this.config, logging: logger });
  }

  /**
   * Add redirect handling with custom allowed status codes
   */
  withRedirect(options: RedirectConfig): PresetBuilder {
    return new PresetBuilder({ ...this.config, redirect: options });
  }

  /**
   * Add circuit breaker with custom configuration
   */
  withCircuitBreaker(options: CircuitBreakerConfig): PresetBuilder {
    return new PresetBuilder({ ...this.config, circuitBreaker: options });
  }

  /**
   * Add throttling with custom configuration
   */
  withThrottle(options: ThrottleConfig): PresetBuilder {
    return new PresetBuilder({ ...this.config, throttle: options });
  }

  /**
   * Add conditional requests with custom configuration
   */
  withConditional(options: ConditionalConfig): PresetBuilder {
    return new PresetBuilder({ ...this.config, conditional: options });
  }

  /**
   * Add OAuth2 Bearer token authentication
   */
  oauth(options: OAuthConfig): PresetBuilder {
    return new PresetBuilder({ ...this.config, oauth: options });
  }

  /**
   * Add response validation with a schema adapter (Zod, Valibot, etc.)
   */
  withValidation<TSchema, TOutput>(schema: TSchema, adapter: ValidationAdapter<TSchema, TOutput>): PresetBuilder {
    return new PresetBuilder({
      ...this.config,
      validate: { schema, adapter: adapter as ValidationAdapter<unknown, unknown> },
    });
  }

  /**
   * Add static headers to all requests
   */
  withHeaders(headers: Record<string, string>): PresetBuilder {
    return new PresetBuilder({
      ...this.config,
      headers: { ...this.config.headers, ...headers },
    });
  }

  /**
   * Add query parameters to all requests
   */
  withQuery(params: Record<string, string | number | boolean | undefined>): PresetBuilder {
    return new PresetBuilder({
      ...this.config,
      query: { ...this.config.query, ...params },
    });
  }

  /**
   * Add request/response/error interceptors
   */
  withInterceptors(interceptors: InterceptorsConfig): PresetBuilder {
    return new PresetBuilder({
      ...this.config,
      interceptors: {
        request: interceptors.request,
        response: interceptors.response,
        error: interceptors.error,
      },
    });
  }

  /**
   * Add custom policies (escape hatch for full control)
   */
  with(...policies: Policy[]): PresetBuilder {
    return new PresetBuilder({
      ...this.config,
      customPolicies: [...(this.config.customPolicies || []), ...policies],
    });
  }

  /**
   * Build the configured client
   * @param uri - Base URI (optional if already set via .uri())
   */
  build(uri?: string) {
    const baseUri = uri || this.config.baseUri;
    if (!baseUri) {
      throw new Error('Base URI is required. Use .uri(baseUri) or .build(baseUri)');
    }

    const policies: Policy[] = [];

    // === Request preparation phase ===

    // Static headers
    if (this.config.headers && Object.keys(this.config.headers).length > 0) {
      policies.push(headersPolicy(this.config.headers));
    }

    // Query parameters
    if (this.config.query && Object.keys(this.config.query).length > 0) {
      policies.push(queryPolicy(this.config.query));
    }

    // Accept header for content negotiation
    if (this.config.json || this.config.xml) {
      const types: string[] = [];
      if (this.config.json) types.push('application/json');
      if (this.config.xml) types.push('application/xml');
      policies.push(accept(types));
    }

    // === Flow control phase ===

    // Timeout (should be early to wrap everything)
    if (this.config.timeout) {
      policies.push(timeoutPolicy(this.config.timeout));
    }

    // Throttling
    if (this.config.throttle) {
      const throttleConfig = typeof this.config.throttle === 'object' ? this.config.throttle : {};
      policies.push(
        throttle({
          limit: throttleConfig.limit ?? 10,
          interval: throttleConfig.interval ?? 1000,
        }),
      );
    }

    // Circuit breaker
    if (this.config.circuitBreaker) {
      const cbConfig = typeof this.config.circuitBreaker === 'object' ? this.config.circuitBreaker : {};
      policies.push(
        circuitBreaker({
          failureThreshold: cbConfig.threshold ?? 5,
          resetTimeout: cbConfig.resetTimeout ?? 30000,
        }),
      );
    }

    // Redirect handling
    if (this.config.redirect) {
      const redirectConfig = typeof this.config.redirect === 'object' ? this.config.redirect : {};
      policies.push(redirectPolicy({ allow: redirectConfig.allow ?? [307, 308] }));
    }

    // Retry with exponential backoff
    if (this.config.retry) {
      const retryConfig = typeof this.config.retry === 'object' ? this.config.retry : {};
      const delayStrategies = [];

      // Rate limit aware retry first
      if (retryConfig.respectRateLimit !== false) {
        delayStrategies.push(rateLimitDelay({ maxWait: 60000 }));
      }

      // Exponential backoff fallback
      delayStrategies.push(backoff(retryConfig.backoff ?? { initial: 1000, max: 30000, jitter: true }));

      policies.push(
        retry(
          httpRetryPredicate({
            methods: retryConfig.methods ?? ['GET', 'PUT', 'DELETE'],
            statusCodes: retryConfig.statusCodes ?? [408, 429, 500, 502, 503, 504],
          }),
          delayStrategies,
          { tries: retryConfig.tries ?? 3 },
        ),
      );
    }

    // === Caching phase ===

    // Conditional requests (ETag/Last-Modified)
    if (this.config.conditional) {
      const condConfig = typeof this.config.conditional === 'object' ? this.config.conditional : {};
      policies.push(conditional(condConfig));
    }

    // HTTP caching
    if (this.config.cache) {
      const cacheConfig = typeof this.config.cache === 'object' ? this.config.cache : {};
      policies.push(cache(cacheConfig));
    }

    // === Authentication phase ===

    // OAuth Bearer authentication
    if (this.config.oauth) {
      policies.push(
        oauthBearer({
          tokenSupplier: this.config.oauth.tokenSupplier,
          jwks: this.config.oauth.jwks,
          allowUnsafeMode: this.config.oauth.allowUnsafeMode,
        }),
      );
    }

    // === Interceptors phase ===

    if (this.config.interceptors) {
      // Request interceptors
      if (this.config.interceptors.request) {
        const requestInterceptors = Array.isArray(this.config.interceptors.request)
          ? this.config.interceptors.request
          : [this.config.interceptors.request];
        for (const interceptor of requestInterceptors) {
          policies.push(interceptRequest(interceptor));
        }
      }

      // Response interceptors
      if (this.config.interceptors.response) {
        const responseInterceptors = Array.isArray(this.config.interceptors.response)
          ? this.config.interceptors.response
          : [this.config.interceptors.response];
        for (const interceptor of responseInterceptors) {
          policies.push(interceptResponse(interceptor));
        }
      }

      // Error interceptors
      if (this.config.interceptors.error) {
        const errorInterceptors = Array.isArray(this.config.interceptors.error)
          ? this.config.interceptors.error
          : [this.config.interceptors.error];
        for (const interceptor of errorInterceptors) {
          policies.push(interceptError(interceptor));
        }
      }
    }

    // === Observability phase ===

    // Logging
    if (this.config.logging) {
      if (typeof this.config.logging === 'object') {
        policies.push(log({ logger: this.config.logging }));
      } else {
        // Use default console logger
        /* c8 ignore start */ // Console logger functions are tested via logging property getter
        policies.push(
          log({
            logger: {
              info: (msg, ctx) => console.info(`[INFO] ${msg}`, ctx),
              warn: (msg, ctx) => console.warn(`[WARN] ${msg}`, ctx),
              error: (msg, ctx) => console.error(`[ERROR] ${msg}`, ctx),
              debug: (msg, ctx) => console.debug(`[DEBUG] ${msg}`, ctx),
            },
          }),
        );
        /* c8 ignore stop */
      }
    }

    // === Response processing phase ===

    // Validation
    if (this.config.validate) {
      policies.push(validate(this.config.validate.schema, this.config.validate.adapter));
    }

    // Content parsing (should be near the end)
    if (this.config.json) {
      policies.push(parse.json());
    }
    if (this.config.xml) {
      // XML parsing would go here if we had parse.xml()
      // For now, just add JSON
    }

    // === Custom policies (escape hatch) ===
    if (this.config.customPolicies) {
      policies.push(...this.config.customPolicies);
    }

    return client(http(baseUri), ...policies);
  }
}

/**
 * Entry point for the fluent builder API
 *
 * @example Basic JSON API client with retry and timeout
 * ```ts
 * const api = preset.api.json.retry.timeout.build('https://api.example.com');
 *
 * const data = await api.get('/users');
 * ```
 *
 * @example With custom options
 * ```ts
 * const api = preset.api
 *   .json
 *   .withRetry({ tries: 5, methods: ['GET'] })
 *   .withTimeout(10000)
 *   .oauth({
 *     tokenSupplier: () => getAccessToken(),
 *     jwks: jwksFromIssuer('https://auth.example.com'),
 *   })
 *   .build('https://api.example.com');
 * ```
 *
 * @example With all features
 * ```ts
 * const api = preset.api
 *   .json
 *   .withHeaders({ 'X-API-Key': 'secret' })
 *   .withQuery({ version: 'v2' })
 *   .retry
 *   .timeout
 *   .cache
 *   .circuitBreaker
 *   .throttle
 *   .conditional
 *   .logging
 *   .build('https://api.example.com');
 * ```
 *
 * @example IMAP mail client
 * ```ts
 * const mail = preset.imap
 *   .connection(imapConnection)
 *   .auth(xoauth2({ tokenSupplier }))
 *   .retry
 *   .build();
 *
 * const messages = await mail.fetch('INBOX', '1:20');
 * ```
 *
 * @example FTP client
 * ```ts
 * const ftp = preset.ftp
 *   .client(basicFtpClient)
 *   .retry
 *   .build();
 *
 * const files = await ftp.list('ftp://ftp.example.com/public');
 * ```
 *
 * @example HTTP/2 client
 * ```ts
 * const h2api = preset.h2
 *   .uri('https://api.example.com')
 *   .json
 *   .retry
 *   .build();
 *
 * const data = await h2api.get('/users');
 * ```
 */
export const preset = {
  /**
   * Start building an API client (HTTP/1.1)
   * This is the entry point for the fluent builder
   */
  get api(): PresetBuilder {
    return new PresetBuilder();
  },

  /**
   * Start building an API client with a specific base URI
   */
  uri(baseUri: string): PresetBuilder {
    return new PresetBuilder({ baseUri });
  },

  /**
   * Start building an IMAP mail client
   * Requires @unireq/imap package
   *
   * @example
   * ```ts
   * const mail = preset.imap
   *   .connection(imapConnection)
   *   .auth(xoauth2({ tokenSupplier }))
   *   .build();
   *
   * await mail.fetch('INBOX', '1:20');
   * ```
   */
  get imap(): ImapFacadeBuilder {
    return imapPreset.builder;
  },

  /**
   * Start building an FTP client
   * Requires @unireq/ftp package
   *
   * @example
   * ```ts
   * const ftp = preset.ftp
   *   .client(basicFtpClient)
   *   .retry
   *   .build();
   *
   * await ftp.list('ftp://ftp.example.com/');
   * ```
   */
  get ftp(): FtpFacadeBuilder {
    return ftpPreset.builder;
  },

  /**
   * Start building an HTTP/2 client
   * Requires @unireq/http2 package
   *
   * @example
   * ```ts
   * const api = preset.h2
   *   .uri('https://api.example.com')
   *   .json
   *   .retry
   *   .build();
   *
   * await api.get('/users');
   * ```
   */
  get h2(): H2FacadeBuilder {
    return h2Preset.builder;
  },

  /**
   * Start building an SMTP email client
   * Requires @unireq/smtp package
   *
   * @example Gmail with App Password
   * ```ts
   * const mail = preset.smtp
   *   .uri('smtp://user@gmail.com:app-password@smtp.gmail.com:587')
   *   .retry
   *   .build();
   *
   * await mail.send({
   *   from: 'user@gmail.com',
   *   to: 'recipient@example.com',
   *   subject: 'Hello!',
   *   text: 'This is a test email.',
   * });
   * ```
   *
   * @example Gmail with OAuth2
   * ```ts
   * const mail = preset.smtp
   *   .uri('smtp://user@gmail.com@smtp.gmail.com:587')
   *   .oauth2({
   *     clientId: 'your-client-id',
   *     clientSecret: 'your-client-secret',
   *     refreshToken: 'your-refresh-token',
   *   })
   *   .retry
   *   .build();
   * ```
   */
  get smtp(): SmtpFacadeBuilder {
    return smtpPreset.builder;
  },
};
