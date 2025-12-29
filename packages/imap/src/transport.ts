/**
 * IMAP Transport using BYOC (Bring Your Own Connector) pattern
 *
 * The imap() function creates an IMAP transport that can use:
 * - The default ImapFlowConnector (requires imapflow package)
 * - A custom connector implementing IMAPConnector interface
 *
 * @example
 * ```ts
 * import { imap } from '@unireq/imap';
 * import { client } from '@unireq/core';
 *
 * // Using default connector (requires: npm install imapflow)
 * const { transport } = imap('imap://user:pass@mail.server.com');
 * const api = client(transport);
 *
 * // Using custom connector (BYOC)
 * import { imap, type IMAPConnector } from '@unireq/imap';
 * const { transport } = imap('imap://server.com', myCustomConnector);
 * ```
 */

import type { RequestContext, Response, TransportWithCapabilities } from '@unireq/core';
import { policy } from '@unireq/core';
import type { IMAPConnector, IMAPConnectorOptions, IMAPSession } from './connector.js';

/**
 * Lazily loads the default IMAP connector
 * Throws a helpful error if imapflow is not installed
 */
async function getDefaultConnector(options?: IMAPConnectorOptions): Promise<IMAPConnector> {
  try {
    const { createDefaultImapConnector } = await import('./connectors/imapflow.js');
    return createDefaultImapConnector(options);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Default IMAP connector not available. Install imapflow or provide a custom connector.\n` +
        `Install: npm install imapflow\n` +
        `Or use BYOC: imap('imap://server.com', myConnector)\n` +
        `Cause: ${cause}`,
    );
  }
}

/**
 * IMAP transport options
 */
export interface IMAPTransportOptions {
  /** Connection timeout in milliseconds */
  readonly timeout?: number;
  /** TLS options for secure connections */
  readonly tls?: {
    readonly minVersion?: string;
    readonly rejectUnauthorized?: boolean;
  };
  /** Enable debug logging */
  readonly debug?: boolean;
}

/**
 * Creates an IMAP transport
 *
 * Supports BYOC (Bring Your Own Connector) pattern:
 * - Without connector: Uses default ImapFlowConnector (requires imapflow)
 * - With connector: Uses the provided IMAPConnector implementation
 *
 * @param uri - IMAP URI (e.g., 'imap://user:pass@server.com' or 'imaps://...')
 * @param connectorOrOptions - Custom connector or transport options
 * @returns Transport with IMAP capabilities
 *
 * @example
 * ```ts
 * // Simple usage with default connector
 * const { transport } = imap('imap://mail.server.com');
 *
 * // With credentials in URI
 * const { transport } = imap('imap://user:password@mail.server.com');
 *
 * // With IMAPS (secure)
 * const { transport } = imap('imaps://mail.server.com');
 *
 * // With custom connector (BYOC)
 * const { transport } = imap('imap://server.com', myConnector);
 *
 * // With options (uses default connector)
 * const { transport } = imap('imap://server.com', { timeout: 30000 });
 * ```
 */
export function imap(
  uri?: string,
  connectorOrOptions?: IMAPConnector | IMAPTransportOptions,
): TransportWithCapabilities {
  let session: IMAPSession | null = null;
  let actualConnector: IMAPConnector | null = null;

  // Determine if second argument is a connector or options
  const isConnector = (arg: unknown): arg is IMAPConnector =>
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

      // Build final URL: combine base URI with relative path
      let finalUrl = ctx.url;
      if (uri && ctx.url.startsWith('/')) {
        const baseUrl = new URL(uri);
        baseUrl.pathname = ctx.url;
        finalUrl = baseUrl.toString();
      } else if (!ctx.url.startsWith('imap://') && !ctx.url.startsWith('imaps://')) {
        // If no scheme, prepend the base URI
        if (uri) {
          const baseUrl = new URL(uri);
          baseUrl.pathname = ctx.url.startsWith('/') ? ctx.url : `/${ctx.url}`;
          finalUrl = baseUrl.toString();
        }
      }

      // biome-ignore lint/style/noNonNullAssertion: session is guaranteed by connect() or existing connection above
      return actualConnector.request(session!, { ...ctx, url: finalUrl });
    },
    {
      name: 'imap',
      kind: 'transport',
      options: uri ? { uri } : undefined,
    },
  );

  // Get capabilities from connector if available, otherwise use defaults
  const defaultCapabilities = {
    imap: true,
    xoauth2: true,
    idle: true,
    append: true,
    search: true,
    move: true,
    flags: true,
    expunge: true,
  };

  return {
    transport,
    capabilities: providedConnector?.capabilities ?? defaultCapabilities,
  };
}
