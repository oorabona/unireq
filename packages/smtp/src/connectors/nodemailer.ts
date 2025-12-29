/**
 * Default SMTP connector using nodemailer
 *
 * This connector provides SMTP functionality using the popular nodemailer library.
 * It's the default connector used when no custom connector is provided.
 *
 * @example
 * ```ts
 * import { smtp } from '@unireq/smtp';
 *
 * // Uses NodemailerConnector by default
 * const { transport } = smtp('smtp://user:pass@smtp.gmail.com:587');
 * ```
 */

import type { RequestContext, Response } from '@unireq/core';
import type {
  EmailMessage,
  SendResult,
  SMTPCapabilities,
  SMTPConnector,
  SMTPConnectorOptions,
  SMTPSession,
} from '../connector.js';

/**
 * Nodemailer transporter type (minimal interface)
 */
interface NodemailerTransporter {
  sendMail(options: unknown): Promise<{
    accepted: string[];
    rejected: string[];
    messageId: string;
    response: string;
  }>;
  verify(): Promise<true>;
  close(): void;
}

/**
 * Nodemailer module type
 */
interface NodemailerModule {
  createTransport(options: unknown): NodemailerTransporter;
}

/**
 * OAuth2 credentials for Gmail and other providers
 */
export interface OAuth2Credentials {
  /** OAuth2 client ID */
  readonly clientId: string;
  /** OAuth2 client secret */
  readonly clientSecret: string;
  /** OAuth2 refresh token */
  readonly refreshToken: string;
  /** OAuth2 access token (optional, will be refreshed automatically) */
  readonly accessToken?: string;
}

/**
 * Extended options for NodemailerConnector
 */
export interface NodemailerConnectorOptions extends SMTPConnectorOptions {
  /** OAuth2 credentials for authentication */
  readonly oauth2?: OAuth2Credentials;
}

/**
 * Parse SMTP URI into connection options
 */
function parseSmtpUri(uri: string): {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
} {
  const url = new URL(uri);

  // Determine port and security based on protocol
  let port = Number(url.port);
  let secure = false;

  if (url.protocol === 'smtps:') {
    secure = true;
    port = port || 465;
  } else {
    // smtp:// - use STARTTLS on port 587
    port = port || 587;
  }

  return {
    host: url.hostname,
    port,
    secure,
    user: decodeURIComponent(url.username),
    pass: decodeURIComponent(url.password),
  };
}

/**
 * Default SMTP connector using nodemailer
 */
export class NodemailerConnector implements SMTPConnector {
  private transporter: NodemailerTransporter | null = null;
  private nodemailer: NodemailerModule | null = null;

  readonly capabilities: SMTPCapabilities = {
    smtp: true,
    smtps: true,
    starttls: true,
    oauth2: true,
    html: true,
    attachments: true,
  };

  constructor(private readonly options: NodemailerConnectorOptions = {}) {}

  async connect(uri: string): Promise<SMTPSession> {
    // Lazy load nodemailer
    if (!this.nodemailer) {
      try {
        this.nodemailer = (await import('nodemailer')) as unknown as NodemailerModule;
      } catch {
        throw new Error(
          'nodemailer is required for the default SMTP connector. ' + 'Install it with: npm install nodemailer',
        );
      }
    }

    const { host, port, secure, user, pass } = parseSmtpUri(uri);

    // Build transport options
    const transportOptions: Record<string, unknown> = {
      host,
      port,
      secure,
      connectionTimeout: this.options.timeout ?? 30000,
      greetingTimeout: this.options.timeout ?? 30000,
      socketTimeout: this.options.timeout ?? 60000,
      debug: this.options.debug ?? false,
      logger: this.options.debug ?? false,
    };

    // Add pooling if enabled
    if (this.options.pool) {
      transportOptions['pool'] = true;
      transportOptions['maxConnections'] = this.options.maxConnections ?? 5;
    }

    // Add TLS options
    if (this.options.tls) {
      transportOptions['tls'] = {
        minVersion: this.options.tls.minVersion,
        rejectUnauthorized: this.options.tls.rejectUnauthorized ?? true,
      };
    }

    // Add authentication
    if (this.options.oauth2) {
      // OAuth2 authentication
      transportOptions['auth'] = {
        type: 'OAuth2',
        user,
        clientId: this.options.oauth2.clientId,
        clientSecret: this.options.oauth2.clientSecret,
        refreshToken: this.options.oauth2.refreshToken,
        accessToken: this.options.oauth2.accessToken,
      };
    } else if (user && pass) {
      // Password authentication (App Password for Gmail)
      transportOptions['auth'] = {
        user,
        pass,
      };
    }

    this.transporter = this.nodemailer.createTransport(transportOptions);

    return {
      connected: true,
      host,
      user,
      secure,
    };
  }

  async request(_session: SMTPSession, ctx: RequestContext): Promise<Response> {
    if (!this.transporter) {
      return {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        data: { error: 'Not connected to SMTP server' },
        ok: false,
      };
    }

    try {
      const message = ctx.body as EmailMessage;

      if (!message || !message.to || !message.subject) {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          data: { error: 'Invalid email message: to and subject are required' },
          ok: false,
        };
      }

      // Build nodemailer options
      const mailOptions: Record<string, unknown> = {
        from: this.formatAddress(message.from),
        to: this.formatAddresses(message.to),
        subject: message.subject,
      };

      if (message['cc']) mailOptions['cc'] = this.formatAddresses(message['cc']);
      if (message['bcc']) mailOptions['bcc'] = this.formatAddresses(message['bcc']);
      if (message['replyTo']) mailOptions['replyTo'] = this.formatAddress(message['replyTo']);
      if (message['text']) mailOptions['text'] = message['text'];
      if (message['html']) mailOptions['html'] = message['html'];
      if (message['headers']) mailOptions['headers'] = message['headers'];

      // Handle priority
      if (message['priority']) {
        const priorityMap = {
          high: { priority: 'high', headers: { 'X-Priority': '1' } },
          normal: { priority: 'normal', headers: { 'X-Priority': '3' } },
          low: { priority: 'low', headers: { 'X-Priority': '5' } },
        };
        const p = priorityMap[message['priority']];
        mailOptions['priority'] = p.priority;
        mailOptions['headers'] = { ...(mailOptions['headers'] as object), ...p.headers };
      }

      // Handle attachments
      if (message['attachments'] && message['attachments'].length > 0) {
        mailOptions['attachments'] = message['attachments'].map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          contentDisposition: att.disposition,
          cid: att.cid,
        }));
      }

      const result = await this.transporter.sendMail(mailOptions);

      const sendResult: SendResult = {
        accepted: result.accepted,
        rejected: result.rejected,
        messageId: result.messageId,
        response: result.response,
      };

      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: sendResult,
        ok: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        data: { error: message },
        ok: false,
      };
    }
  }

  async verify(_session: SMTPSession): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  disconnect(): void {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }

  private formatAddress(addr: string | { name?: string; address: string }): string {
    if (typeof addr === 'string') return addr;
    if (addr.name) return `"${addr.name}" <${addr.address}>`;
    return addr.address;
  }

  private formatAddresses(
    addrs: string | { name?: string; address: string } | (string | { name?: string; address: string })[],
  ): string | string[] {
    if (Array.isArray(addrs)) {
      return addrs.map((a) => this.formatAddress(a));
    }
    return this.formatAddress(addrs);
  }
}

/**
 * Creates a default nodemailer connector
 */
export function createDefaultSmtpConnector(options?: NodemailerConnectorOptions): SMTPConnector {
  return new NodemailerConnector(options);
}
