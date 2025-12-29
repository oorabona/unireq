/**
 * FTP Transport using BYOC (Bring Your Own Connector) pattern
 *
 * The ftp() function creates an FTP transport that can use:
 * - The default BasicFtpConnector (requires basic-ftp package)
 * - A custom connector implementing FTPConnector interface
 *
 * @example
 * ```ts
 * import { ftp } from '@unireq/ftp';
 * import { client } from '@unireq/core';
 *
 * // Using default connector (requires: npm install basic-ftp)
 * const { transport } = ftp('ftp://user:pass@server.com');
 * const api = client(transport);
 *
 * // Using custom connector (BYOC)
 * import { ftp, type FTPConnector } from '@unireq/ftp';
 * const { transport } = ftp('ftp://server.com', myCustomConnector);
 * ```
 */

import type { RequestContext, Response, TransportWithCapabilities } from '@unireq/core';
import { policy } from '@unireq/core';
import type { FTPConnector, FTPConnectorOptions, FTPSession } from './connector.js';

/**
 * Lazily loads the default FTP connector
 * Throws a helpful error if basic-ftp is not installed
 */
async function getDefaultConnector(options?: FTPConnectorOptions): Promise<FTPConnector> {
  try {
    const { createDefaultFtpConnector } = await import('./connectors/basic-ftp.js');
    return createDefaultFtpConnector(options);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Default FTP connector not available. Install basic-ftp or provide a custom connector.\n` +
        `Install: npm install basic-ftp\n` +
        `Or use BYOC: ftp('ftp://server.com', myConnector)\n` +
        `Cause: ${cause}`,
    );
  }
}

/**
 * FTP transport options
 */
export interface FTPTransportOptions {
  /** Connection timeout in milliseconds */
  readonly timeout?: number;
  /** Use passive mode (default: true) */
  readonly passive?: boolean;
  /** TLS options for FTPS connections */
  readonly secureOptions?: {
    readonly minVersion?: string;
    readonly rejectUnauthorized?: boolean;
  };
}

/**
 * Creates an FTP transport
 *
 * Supports BYOC (Bring Your Own Connector) pattern:
 * - Without connector: Uses default BasicFtpConnector (requires basic-ftp)
 * - With connector: Uses the provided FTPConnector implementation
 *
 * @param uri - FTP URI (e.g., 'ftp://user:pass@server.com/path')
 * @param connectorOrOptions - Custom connector or transport options
 * @returns Transport with FTP capabilities
 *
 * @example
 * ```ts
 * // Simple usage with default connector
 * const { transport } = ftp('ftp://server.com');
 *
 * // With credentials in URI
 * const { transport } = ftp('ftp://user:password@server.com');
 *
 * // With FTPS (secure)
 * const { transport } = ftp('ftps://secure.server.com');
 *
 * // With custom connector (BYOC)
 * const { transport } = ftp('ftp://server.com', myConnector);
 *
 * // With options (uses default connector)
 * const { transport } = ftp('ftp://server.com', { timeout: 30000 });
 * ```
 */
export function ftp(uri?: string, connectorOrOptions?: FTPConnector | FTPTransportOptions): TransportWithCapabilities {
  let session: FTPSession | null = null;
  let actualConnector: FTPConnector | null = null;

  // Determine if second argument is a connector or options
  const isConnector = (arg: unknown): arg is FTPConnector =>
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
      } else if (!ctx.url.startsWith('ftp://') && !ctx.url.startsWith('ftps://')) {
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
      name: 'ftp',
      kind: 'transport',
      options: uri ? { uri } : undefined,
    },
  );

  // Get capabilities from connector if available, otherwise use defaults
  const defaultCapabilities = {
    ftp: true,
    ftps: true,
    delete: true,
    rename: true,
    mkdir: true,
    rmdir: true,
  };

  return {
    transport,
    capabilities: providedConnector?.capabilities ?? defaultCapabilities,
  };
}
