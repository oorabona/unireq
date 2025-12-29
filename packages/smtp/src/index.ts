/**
 * @unireq/smtp - SMTP transport with BYOC (Bring Your Own Connector) pattern
 *
 * This package provides an SMTP transport that can use:
 * - The default NodemailerConnector (requires nodemailer package as peer dependency)
 * - A custom connector implementing SMTPConnector interface (BYOC)
 *
 * @example Default usage (requires: npm install nodemailer)
 * ```ts
 * import { smtp } from '@unireq/smtp';
 * import { client } from '@unireq/core';
 *
 * // Gmail with App Password
 * const { transport } = smtp('smtp://user@gmail.com:your-app-password@smtp.gmail.com:587');
 * const mail = client(transport);
 *
 * // Send an email
 * await mail.post('/', {
 *   from: 'user@gmail.com',
 *   to: 'recipient@example.com',
 *   subject: 'Hello from Unireq!',
 *   text: 'This is a test email.',
 *   html: '<h1>Hello!</h1><p>This is a test email.</p>',
 * });
 * ```
 *
 * @example With OAuth2 (Gmail)
 * ```ts
 * import { smtp } from '@unireq/smtp';
 *
 * const { transport } = smtp('smtp://user@gmail.com@smtp.gmail.com:587', {
 *   oauth2: {
 *     clientId: 'your-client-id.apps.googleusercontent.com',
 *     clientSecret: 'your-client-secret',
 *     refreshToken: 'your-refresh-token',
 *   },
 * });
 * ```
 *
 * @example BYOC (Bring Your Own Connector)
 * ```ts
 * import { smtp, type SMTPConnector } from '@unireq/smtp';
 *
 * class MySmtpConnector implements SMTPConnector {
 *   // Custom implementation...
 * }
 *
 * const { transport } = smtp('smtp://mail.server.com', new MySmtpConnector());
 * ```
 *
 * @packageDocumentation
 */

// Re-export core types for convenience
export type { Connector, RequestContext, Response, TransportWithCapabilities } from '@unireq/core';
export { policy } from '@unireq/core';
// Connector interface for BYOC
export type {
  EmailAddress,
  EmailAttachment,
  EmailMessage,
  SendResult,
  SMTPCapabilities,
  SMTPConnector,
  SMTPConnectorOptions,
  SMTPSession,
} from './connector.js';
// Default connector (requires nodemailer peer dependency)
export {
  createDefaultSmtpConnector,
  NodemailerConnector,
  type NodemailerConnectorOptions,
  type OAuth2Credentials,
} from './connectors/nodemailer.js';
// Main transport function
export { type SMTPTransportOptions, smtp } from './transport.js';
