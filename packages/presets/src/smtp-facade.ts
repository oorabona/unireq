/**
 * SMTP Facade - Ergonomic API built on top of smtp() transport
 *
 * This is NOT a reimplementation of SMTP - it's syntactic sugar
 * over the existing transport + policy composition.
 *
 * @example
 * ```ts
 * const mail = preset.smtp
 *   .uri('smtp://user:app-password@smtp.gmail.com:587')
 *   .retry
 *   .build();
 *
 * // Send an email
 * await mail.send({
 *   from: 'me@gmail.com',
 *   to: 'you@example.com',
 *   subject: 'Hello!',
 *   text: 'This is a test email.',
 * });
 * ```
 */

import { backoff, type Client, client, type Policy, type Response, retry } from '@unireq/core';
// Note: @unireq/smtp is an optional peer dependency
// Users must install it to use the SMTP facade
import {
  type EmailAttachment,
  type EmailMessage,
  type OAuth2Credentials,
  type SendResult,
  type SMTPConnector,
  smtp,
} from '@unireq/smtp';

/**
 * Default retry predicate for SMTP operations
 * Retries on errors (not on successful responses)
 */
const smtpRetryPredicate = (_result: Response | null, error: Error | null): boolean => error !== null;

/**
 * Re-export email types
 */
export type { EmailMessage, EmailAttachment, SendResult, OAuth2Credentials };

/**
 * SMTP client facade with domain-specific methods
 * All methods are syntactic sugar over the underlying transport
 */
export interface SmtpClient {
  /**
   * Send an email
   * Wraps: client.post('/', message)
   *
   * @param message - Email message to send
   * @returns Send result with accepted/rejected recipients and messageId
   */
  send(message: EmailMessage): Promise<SendResult>;

  /**
   * Send a simple text email (shorthand)
   *
   * @param to - Recipient email
   * @param subject - Email subject
   * @param text - Plain text body
   * @param from - Optional sender (uses default from URI if omitted)
   * @returns Send result
   */
  sendText(to: string, subject: string, text: string, from?: string): Promise<SendResult>;

  /**
   * Send an HTML email (shorthand)
   *
   * @param to - Recipient email
   * @param subject - Email subject
   * @param html - HTML body
   * @param text - Optional plain text fallback
   * @param from - Optional sender (uses default from URI if omitted)
   * @returns Send result
   */
  sendHtml(to: string, subject: string, html: string, text?: string, from?: string): Promise<SendResult>;

  /**
   * Access the underlying unireq client for advanced use cases
   */
  readonly raw: Client;
}

/**
 * Configuration accumulated during builder chain
 */
interface SmtpFacadeConfig {
  uri?: string;
  connector?: SMTPConnector;
  oauth2?: OAuth2Credentials;
  defaultFrom?: string;
  retry?: boolean | { tries?: number };
  policies?: Policy[];
  pool?: boolean;
  debug?: boolean;
}

/**
 * Fluent builder for SMTP client facade
 *
 * @example
 * ```ts
 * // Gmail with App Password
 * const mail = preset.smtp
 *   .uri('smtp://user@gmail.com:app-password@smtp.gmail.com:587')
 *   .retry
 *   .build();
 *
 * // Gmail with OAuth2
 * const mail = preset.smtp
 *   .uri('smtp://user@gmail.com@smtp.gmail.com:587')
 *   .oauth2({
 *     clientId: 'your-client-id',
 *     clientSecret: 'your-client-secret',
 *     refreshToken: 'your-refresh-token',
 *   })
 *   .retry
 *   .build();
 *
 * // With custom connector (BYOC)
 * const mail = preset.smtp
 *   .uri('smtp://smtp.example.com')
 *   .connector(myCustomConnector)
 *   .retry
 *   .build();
 * ```
 */
export class SmtpFacadeBuilder {
  private config: SmtpFacadeConfig;

  constructor(config: SmtpFacadeConfig = {}) {
    this.config = { ...config };
  }

  /**
   * Set the SMTP URI (required)
   * Format: smtp://user:password@host:port or smtps://...
   */
  uri(smtpUri: string): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({ ...this.config, uri: smtpUri });
  }

  /**
   * Set a custom SMTP connector (BYOC)
   * If not provided, uses the default NodemailerConnector (requires nodemailer)
   */
  connector(smtpConnector: SMTPConnector): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({ ...this.config, connector: smtpConnector });
  }

  /**
   * Add OAuth2 authentication (for Gmail and other providers)
   */
  oauth2(credentials: OAuth2Credentials): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({ ...this.config, oauth2: credentials });
  }

  /**
   * Set default "from" address for emails
   */
  from(address: string): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({ ...this.config, defaultFrom: address });
  }

  /**
   * Enable connection pooling for better performance
   */
  get pool(): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({ ...this.config, pool: true });
  }

  /**
   * Enable debug logging
   */
  get debug(): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({ ...this.config, debug: true });
  }

  /**
   * Add retry with exponential backoff
   */
  get retry(): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({ ...this.config, retry: true });
  }

  /**
   * Add retry with custom configuration
   */
  withRetry(options: { tries?: number }): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({ ...this.config, retry: options });
  }

  /**
   * Add custom policies
   */
  with(...policies: Policy[]): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({
      ...this.config,
      policies: [...(this.config.policies || []), ...policies],
    });
  }

  /**
   * Build the SMTP client facade
   * @throws Error if URI is not provided
   */
  build(): SmtpClient {
    if (!this.config.uri) {
      throw new Error('SMTP URI is required. Use .uri("smtp://user:pass@host:port")');
    }

    const policies: Policy[] = [];

    // Add retry if configured
    if (this.config.retry) {
      const tries = typeof this.config.retry === 'object' ? (this.config.retry.tries ?? 3) : 3;
      policies.push(retry(smtpRetryPredicate, [backoff({ initial: 1000, max: 10000, jitter: true })], { tries }));
    }

    // Add custom policies
    if (this.config.policies) {
      policies.push(...this.config.policies);
    }

    // Build transport options
    const transportOptions = {
      ...(this.config.oauth2 ? { oauth2: this.config.oauth2 } : {}),
      pool: this.config.pool,
      debug: this.config.debug,
    };

    // Create the underlying client using the smtp() transport
    const { transport } = smtp(
      this.config.uri,
      this.config.connector ?? (Object.keys(transportOptions).length > 0 ? transportOptions : undefined),
    );
    const rawClient = client(transport, ...policies);

    // Extract default from from URI if not explicitly set
    let defaultFrom = this.config.defaultFrom;
    if (!defaultFrom && this.config.uri) {
      try {
        const url = new URL(this.config.uri);
        if (url.username) {
          defaultFrom = decodeURIComponent(url.username);
        }
      } catch {
        // Ignore URL parsing errors
      }
    }

    // Create the facade with domain-specific methods
    const facade: SmtpClient = {
      raw: rawClient,

      async send(message: EmailMessage): Promise<SendResult> {
        const response = await rawClient.post<SendResult>('/', message);
        if (!response.ok) {
          throw new Error((response.data as { error?: string })?.error ?? 'Failed to send email');
        }
        // biome-ignore lint/style/noNonNullAssertion: data is guaranteed when response.ok is true
        return response.data!;
      },

      async sendText(to: string, subject: string, text: string, from?: string): Promise<SendResult> {
        const fromAddr = from ?? defaultFrom;
        if (!fromAddr) {
          throw new Error('From address is required. Set it via .from() or include in URI');
        }
        return facade.send({ from: fromAddr, to, subject, text });
      },

      async sendHtml(to: string, subject: string, html: string, text?: string, from?: string): Promise<SendResult> {
        const fromAddr = from ?? defaultFrom;
        if (!fromAddr) {
          throw new Error('From address is required. Set it via .from() or include in URI');
        }
        return facade.send({ from: fromAddr, to, subject, html, text });
      },
    };

    return facade;
  }
}

/**
 * Entry point for SMTP facade builder
 */
export const smtpPreset = {
  /**
   * Start building an SMTP client with a URI
   */
  uri(smtpUri: string): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder({ uri: smtpUri });
  },

  /**
   * Start building an SMTP client (URI required before build)
   */
  get builder(): SmtpFacadeBuilder {
    return new SmtpFacadeBuilder();
  },
};
