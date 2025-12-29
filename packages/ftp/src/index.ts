/**
 * @unireq/ftp - FTP transport with BYOC (Bring Your Own Connector) pattern
 *
 * This package provides an FTP transport that can use:
 * - The default BasicFtpConnector (requires basic-ftp package as peer dependency)
 * - A custom connector implementing FTPConnector interface (BYOC)
 *
 * @example Default usage (requires: npm install basic-ftp)
 * ```ts
 * import { ftp } from '@unireq/ftp';
 * import { client } from '@unireq/core';
 *
 * const { transport } = ftp('ftp://user:pass@server.com');
 * const api = client(transport);
 *
 * // List directory
 * const files = await api.get('/path', ftpOperation('list'));
 *
 * // Download file
 * const content = await api.get('/file.txt', ftpOperation('get'));
 *
 * // Upload file
 * await api.put('/upload/file.txt', 'content', ftpOperation('put'));
 * ```
 *
 * @example BYOC (Bring Your Own Connector)
 * ```ts
 * import { ftp, type FTPConnector } from '@unireq/ftp';
 *
 * class MyFtpConnector implements FTPConnector {
 *   // Custom implementation...
 * }
 *
 * const { transport } = ftp('ftp://server.com', new MyFtpConnector());
 * ```
 *
 * @packageDocumentation
 */

// Re-export core types for convenience
export type { Connector, RequestContext, Response, TransportWithCapabilities } from '@unireq/core';
export { policy } from '@unireq/core';
// Connector interface for BYOC
export type {
  FTPCapabilities,
  FTPConnector,
  FTPConnectorOptions,
  FTPFileEntry,
  FTPOperation,
  FTPRequestContext,
  FTPSession,
} from './connector.js';
// Default connector (requires basic-ftp peer dependency)
export { BasicFtpConnector, createDefaultFtpConnector } from './connectors/basic-ftp.js';
// Main transport function
export { type FTPTransportOptions, ftp } from './transport.js';

// Import policy for internal use
import { type RequestContext as Ctx, type Policy, policy as policyFn, type Response as Res } from '@unireq/core';

/**
 * FTP operation policy factory
 * Creates a policy that injects the FTP operation into the request context
 *
 * @param operation - FTP operation to perform
 * @param extras - Additional context parameters (e.g., destination for rename)
 * @returns Policy that injects operation into context
 *
 * @example
 * ```ts
 * import { ftp, ftpOperation } from '@unireq/ftp';
 * import { client } from '@unireq/core';
 *
 * const { transport } = ftp('ftp://server.com');
 * const api = client(transport);
 *
 * // List directory
 * await api.get('/path', ftpOperation('list'));
 *
 * // Download file
 * await api.get('/file.txt', ftpOperation('get'));
 *
 * // Upload file
 * await api.put('/file.txt', content, ftpOperation('put'));
 *
 * // Delete file
 * await api.delete('/file.txt', ftpOperation('delete'));
 *
 * // Rename file
 * await api.get('/old.txt', ftpOperation('rename', { destination: '/new.txt' }));
 *
 * // Create directory
 * await api.get('/newdir', ftpOperation('mkdir'));
 *
 * // Remove directory
 * await api.get('/olddir', ftpOperation('rmdir'));
 * ```
 */
export function ftpOperation(
  operation: 'list' | 'get' | 'put' | 'delete' | 'rename' | 'mkdir' | 'rmdir',
  extras: Record<string, unknown> = {},
): Policy {
  return policyFn(
    async (ctx: Ctx, next: (ctx: Ctx) => Promise<Res>): Promise<Res> => next({ ...ctx, operation, ...extras }),
    { name: `ftp:${operation}`, kind: 'other' },
  );
}
