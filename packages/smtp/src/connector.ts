/**
 * SMTP Connector interface for BYOC (Bring Your Own Connector) pattern
 *
 * This interface extends the core Connector with SMTP-specific capabilities.
 * Implement this interface to create custom SMTP connectors.
 *
 * @example
 * ```ts
 * import { smtp, type SMTPConnector } from '@unireq/smtp';
 *
 * class MySmtpConnector implements SMTPConnector {
 *   // ... implementation
 * }
 *
 * const { transport } = smtp('smtp://mail.server.com', new MySmtpConnector());
 * ```
 */

import type { Connector, RequestContext, Response } from '@unireq/core';

/**
 * SMTP session representing an active connection
 */
export interface SMTPSession {
  /** Whether the session is currently connected */
  readonly connected: boolean;
  /** SMTP server hostname */
  readonly host: string;
  /** Authenticated username */
  readonly user: string;
  /** Whether the connection uses TLS */
  readonly secure: boolean;
}

/**
 * SMTP connector capabilities
 */
export interface SMTPCapabilities {
  /** Supports SMTP protocol */
  readonly smtp: boolean;
  /** Supports SMTPS (implicit TLS) */
  readonly smtps: boolean;
  /** Supports STARTTLS upgrade */
  readonly starttls: boolean;
  /** Supports OAuth2 authentication */
  readonly oauth2: boolean;
  /** Supports HTML emails */
  readonly html: boolean;
  /** Supports attachments */
  readonly attachments: boolean;
  /** Index signature for TransportCapabilities compatibility */
  readonly [key: string]: boolean | undefined;
}

/**
 * SMTP connector options for connection configuration
 */
export interface SMTPConnectorOptions {
  /** Connection timeout in milliseconds */
  readonly timeout?: number;
  /** TLS options for secure connections */
  readonly tls?: {
    /** Minimum TLS version */
    readonly minVersion?: string;
    /** Reject unauthorized certificates */
    readonly rejectUnauthorized?: boolean;
  };
  /** Enable debug logging */
  readonly debug?: boolean;
  /** Pool connections for better performance */
  readonly pool?: boolean;
  /** Maximum number of connections in pool */
  readonly maxConnections?: number;
}

/**
 * Email address representation
 */
export interface EmailAddress {
  /** Display name (optional) */
  readonly name?: string;
  /** Email address */
  readonly address: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  /** Filename */
  readonly filename: string;
  /** Content as Buffer, string, or readable stream */
  readonly content: Buffer | string | NodeJS.ReadableStream;
  /** MIME type (optional, auto-detected if omitted) */
  readonly contentType?: string;
  /** Content disposition: 'attachment' or 'inline' */
  readonly disposition?: 'attachment' | 'inline';
  /** Content-ID for inline attachments (for HTML embedding) */
  readonly cid?: string;
}

/**
 * Email message to send
 */
export interface EmailMessage {
  /** Sender address */
  readonly from: string | EmailAddress;
  /** Recipient(s) */
  readonly to: string | EmailAddress | (string | EmailAddress)[];
  /** CC recipient(s) */
  readonly cc?: string | EmailAddress | (string | EmailAddress)[];
  /** BCC recipient(s) */
  readonly bcc?: string | EmailAddress | (string | EmailAddress)[];
  /** Reply-To address */
  readonly replyTo?: string | EmailAddress;
  /** Email subject */
  readonly subject: string;
  /** Plain text body */
  readonly text?: string;
  /** HTML body */
  readonly html?: string;
  /** Attachments */
  readonly attachments?: EmailAttachment[];
  /** Custom headers */
  readonly headers?: Record<string, string>;
  /** Message priority: 'high', 'normal', 'low' */
  readonly priority?: 'high' | 'normal' | 'low';
}

/**
 * Result of sending an email
 */
export interface SendResult {
  /** Whether the email was accepted */
  readonly accepted: string[];
  /** Whether the email was rejected */
  readonly rejected: string[];
  /** Message ID assigned by the server */
  readonly messageId: string;
  /** Server response */
  readonly response: string;
}

/**
 * SMTP Connector interface
 *
 * Extends the core Connector interface with SMTP-specific capabilities.
 * The connector is responsible for:
 * - Establishing and managing SMTP connections
 * - Translating EmailMessage to SMTP commands
 * - Returning standardized Response objects
 */
export interface SMTPConnector extends Connector<SMTPSession> {
  /**
   * Connect to an SMTP server
   * @param uri - SMTP URI (e.g., 'smtp://user:pass@host:port' or 'smtps://...')
   * @returns SMTP session
   */
  connect(uri: string): Promise<SMTPSession>;

  /**
   * Send an email
   * @param session - Active SMTP session
   * @param ctx - Request context with email message in body
   * @returns Response with SendResult
   */
  request(session: SMTPSession, ctx: RequestContext): Promise<Response>;

  /**
   * Disconnect from SMTP server
   * @param session - Active SMTP session
   */
  disconnect(session: SMTPSession): Promise<void> | void;

  /**
   * Verify connection is still alive
   * @param session - Active SMTP session
   */
  verify?(session: SMTPSession): Promise<boolean>;

  /**
   * Connector capabilities
   */
  readonly capabilities: SMTPCapabilities;
}
