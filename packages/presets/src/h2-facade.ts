/**
 * HTTP/2 Facade - Ergonomic API built on top of http2 transport
 *
 * This is NOT a reimplementation of HTTP/2 - it's syntactic sugar
 * over the existing transport + policy composition.
 *
 * @example
 * ```ts
 * const api = preset.h2
 *   .uri('https://api.example.com')
 *   .json()
 *   .retry()
 *   .build();
 *
 * // Uses HTTP/2 multiplexing over a single connection
 * const [users, posts] = await Promise.all([
 *   api.get('/users'),
 *   api.get('/posts'),
 * ]);
 * ```
 */

import {
  backoff,
  type Client,
  client,
  type Logger,
  log,
  type Policy,
  type Response,
  retry,
  type ValidationAdapter,
  validate,
} from '@unireq/core';
import { accept, headers as headersPolicy, parse, timeout as timeoutPolicy } from '@unireq/http';
// Note: @unireq/http2 is an optional peer dependency
// Users must install it to use the HTTP/2 facade
import { Http2Connector, type Http2ConnectorOptions, http2 } from '@unireq/http2';

/**
 * Default retry predicate for HTTP/2 operations
 * Retries on errors or 5xx status codes
 */
const h2RetryPredicate = (result: Response | null, error: Error | null): boolean => {
  if (error !== null) return true;
  if (result && result.status >= 500 && result.status < 600) return true;
  return false;
};

/**
 * Configuration accumulated during builder chain
 */
interface H2FacadeConfig {
  uri?: string;
  connector?: Http2ConnectorOptions;
  json?: boolean;
  timeout?: number;
  retry?: boolean | { tries?: number };
  headers?: Record<string, string>;
  logging?: Logger | boolean;
  validate?: { schema: unknown; adapter: ValidationAdapter<unknown, unknown> };
  policies?: Policy[];
}

/**
 * Fluent builder for HTTP/2 client facade
 *
 * @example
 * ```ts
 * const api = preset.h2
 *   .uri('https://api.example.com')
 *   .json()
 *   .timeout(30000)
 *   .retry()
 *   .build();
 * ```
 */
export class H2FacadeBuilder {
  private config: H2FacadeConfig;

  constructor(config: H2FacadeConfig = {}) {
    this.config = { ...config };
  }

  /**
   * Set the base URI (required)
   */
  uri(baseUri: string): H2FacadeBuilder {
    return new H2FacadeBuilder({ ...this.config, uri: baseUri });
  }

  /**
   * Configure HTTP/2 connector options
   */
  connector(options: Http2ConnectorOptions): H2FacadeBuilder {
    return new H2FacadeBuilder({ ...this.config, connector: options });
  }

  /**
   * Add JSON parsing
   */
  get json(): H2FacadeBuilder {
    return new H2FacadeBuilder({ ...this.config, json: true });
  }

  /**
   * Add request timeout (default: 30s)
   */
  get timeout(): H2FacadeBuilder {
    return new H2FacadeBuilder({ ...this.config, timeout: 30000 });
  }

  /**
   * Add custom timeout
   */
  withTimeout(ms: number): H2FacadeBuilder {
    return new H2FacadeBuilder({ ...this.config, timeout: ms });
  }

  /**
   * Add retry with exponential backoff
   */
  get retry(): H2FacadeBuilder {
    return new H2FacadeBuilder({ ...this.config, retry: true });
  }

  /**
   * Add retry with custom configuration
   */
  withRetry(options: { tries?: number }): H2FacadeBuilder {
    return new H2FacadeBuilder({ ...this.config, retry: options });
  }

  /**
   * Add static headers to all requests
   */
  withHeaders(headers: Record<string, string>): H2FacadeBuilder {
    return new H2FacadeBuilder({
      ...this.config,
      headers: { ...this.config.headers, ...headers },
    });
  }

  /**
   * Add logging
   */
  get logging(): H2FacadeBuilder {
    return new H2FacadeBuilder({ ...this.config, logging: true });
  }

  /**
   * Add logging with custom logger
   */
  withLogging(logger: Logger): H2FacadeBuilder {
    return new H2FacadeBuilder({ ...this.config, logging: logger });
  }

  /**
   * Add response validation
   */
  withValidation<TSchema, TOutput>(schema: TSchema, adapter: ValidationAdapter<TSchema, TOutput>): H2FacadeBuilder {
    return new H2FacadeBuilder({
      ...this.config,
      validate: { schema, adapter: adapter as ValidationAdapter<unknown, unknown> },
    });
  }

  /**
   * Add custom policies
   */
  with(...policies: Policy[]): H2FacadeBuilder {
    return new H2FacadeBuilder({
      ...this.config,
      policies: [...(this.config.policies || []), ...policies],
    });
  }

  /**
   * Build the HTTP/2 client
   * @returns Configured unireq client using HTTP/2 transport
   * @throws Error if URI is not provided
   */
  build(): Client {
    if (!this.config.uri) {
      throw new Error('Base URI is required. Use .uri(baseUri)');
    }

    const policies: Policy[] = [];

    // Static headers
    if (this.config.headers && Object.keys(this.config.headers).length > 0) {
      policies.push(headersPolicy(this.config.headers));
    }

    // Accept header for JSON
    if (this.config.json) {
      policies.push(accept(['application/json']));
    }

    // Timeout
    if (this.config.timeout) {
      policies.push(timeoutPolicy(this.config.timeout));
    }

    // Retry
    if (this.config.retry) {
      const tries = typeof this.config.retry === 'object' ? (this.config.retry.tries ?? 3) : 3;
      policies.push(retry(h2RetryPredicate, [backoff({ initial: 1000, max: 30000, jitter: true })], { tries }));
    }

    // Logging
    if (this.config.logging) {
      if (typeof this.config.logging === 'object') {
        policies.push(log({ logger: this.config.logging }));
      } else {
        policies.push(
          log({
            logger: {
              info: (msg, ctx) => console.info(`[H2] ${msg}`, ctx),
              warn: (msg, ctx) => console.warn(`[H2] ${msg}`, ctx),
              error: (msg, ctx) => console.error(`[H2] ${msg}`, ctx),
              debug: (msg, ctx) => console.debug(`[H2] ${msg}`, ctx),
            },
          }),
        );
      }
    }

    // Validation
    if (this.config.validate) {
      policies.push(validate(this.config.validate.schema, this.config.validate.adapter));
    }

    // JSON parsing
    if (this.config.json) {
      policies.push(parse.json());
    }

    // Custom policies
    if (this.config.policies) {
      policies.push(...this.config.policies);
    }

    // Create HTTP/2 transport with connector
    const connector = this.config.connector ? new Http2Connector(this.config.connector) : undefined;
    const { transport } = http2(this.config.uri, connector);

    return client(transport, ...policies);
  }
}

/**
 * Entry point for HTTP/2 facade builder
 */
export const h2Preset = {
  /**
   * Start building an HTTP/2 client with a base URI
   */
  uri(baseUri: string): H2FacadeBuilder {
    return new H2FacadeBuilder({ uri: baseUri });
  },

  /**
   * Start building an HTTP/2 client (URI required before build)
   */
  get builder(): H2FacadeBuilder {
    return new H2FacadeBuilder();
  },
};
