/**
 * SMTP Transport using BYOC (Bring Your Own Connector) pattern
 *
 * The smtp() function creates an SMTP transport that can use:
 * - The default NodemailerConnector (requires nodemailer package)
 * - A custom connector implementing SMTPConnector interface
 *
 * @example
 * ```ts
 * import { smtp } from '@unireq/smtp';
 * import { client } from '@unireq/core';
 *
 * // Using default connector (requires: npm install nodemailer)
 * const { transport } = smtp('smtp://user:pass@smtp.gmail.com:587');
 * const mail = client(transport);
 *
 * // Send an email
 * await mail.post('/', {
 *   from: 'me@gmail.com',
 *   to: 'you@example.com',
 *   subject: 'Hello!',
 *   text: 'This is a test email.',
 * });
 * ```
 */

import type { RequestContext, Response, TransportWithCapabilities } from '@unireq/core';
import { policy } from '@unireq/core';
import type { SMTPConnector, SMTPConnectorOptions, SMTPSession } from './connector.js';

/**
 * Lazily loads the default SMTP connector
 * Throws a helpful error if nodemailer is not installed
 */
async function getDefaultConnector(options?: SMTPConnectorOptions): Promise<SMTPConnector> {
  try {
    const { createDefaultSmtpConnector } = await import('./connectors/nodemailer.js');
    return createDefaultSmtpConnector(options);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Default SMTP connector not available. Install nodemailer or provide a custom connector.\n` +
        `Install: npm install nodemailer\n` +
        `Or use BYOC: smtp('smtp://server.com', myConnector)\n` +
        `Cause: ${cause}`,
    );
  }
}

/**
 * SMTP transport options
 */
export interface SMTPTransportOptions extends SMTPConnectorOptions {
  /** OAuth2 credentials for authentication */
  readonly oauth2?: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly refreshToken: string;
    readonly accessToken?: string;
  };
}

/**
 * Creates an SMTP transport
 *
 * Supports BYOC (Bring Your Own Connector) pattern:
 * - Without connector: Uses default NodemailerConnector (requires nodemailer)
 * - With connector: Uses the provided SMTPConnector implementation
 *
 * @param uri - SMTP URI (e.g., 'smtp://user:pass@server.com:587' or 'smtps://...')
 * @param connectorOrOptions - Custom connector or transport options
 * @returns Transport with SMTP capabilities
 *
 * @example
 * ```ts
 * // Simple usage with App Password (Gmail)
 * const { transport } = smtp('smtp://user@gmail.com:app-password@smtp.gmail.com:587');
 *
 * // With SMTPS (implicit TLS, port 465)
 * const { transport } = smtp('smtps://user:pass@smtp.gmail.com');
 *
 * // With OAuth2
 * const { transport } = smtp('smtp://user@gmail.com@smtp.gmail.com:587', {
 *   oauth2: {
 *     clientId: 'your-client-id',
 *     clientSecret: 'your-client-secret',
 *     refreshToken: 'your-refresh-token',
 *   },
 * });
 *
 * // With custom connector (BYOC)
 * const { transport } = smtp('smtp://server.com', myConnector);
 * ```
 */
export function smtp(
  uri?: string,
  connectorOrOptions?: SMTPConnector | SMTPTransportOptions,
): TransportWithCapabilities {
  let session: SMTPSession | null = null;
  let actualConnector: SMTPConnector | null = null;

  // Determine if second argument is a connector or options
  const isConnector = (arg: unknown): arg is SMTPConnector =>
    arg !== null && typeof arg === 'object' && 'connect' in arg && 'request' in arg && 'disconnect' in arg;

  const providedConnector = isConnector(connectorOrOptions) ? connectorOrOptions : null;
  const options = !isConnector(connectorOrOptions) ? connectorOrOptions : undefined;

  const transport = policy(
    async (ctx: RequestContext): Promise<Response> => {
      // Lazy load connector
      if (!actualConnector) {
        actualConnector = providedConnector ?? (await getDefaultConnector(options));
      }

      // Connect if not connected and URI provided
      if (!session && uri) {
        session = await actualConnector.connect(uri);
      }

      // biome-ignore lint/style/noNonNullAssertion: session is guaranteed by connect() or existing connection above
      return actualConnector.request(session!, ctx);
    },
    {
      name: 'smtp',
      kind: 'transport',
      options: uri ? { uri } : undefined,
    },
  );

  // Get capabilities from connector if available, otherwise use defaults
  const defaultCapabilities = {
    smtp: true,
    smtps: true,
    starttls: true,
    oauth2: true,
    html: true,
    attachments: true,
  };

  return {
    transport,
    capabilities: providedConnector?.capabilities ?? defaultCapabilities,
  };
}
