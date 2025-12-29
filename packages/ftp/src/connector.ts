/**
 * FTP Connector interface for BYOC (Bring Your Own Connector) pattern
 *
 * This interface extends the core Connector with FTP-specific capabilities.
 * Implement this interface to create custom FTP connectors.
 *
 * @example
 * ```ts
 * import { ftp, type FTPConnector } from '@unireq/ftp';
 *
 * class MyFtpConnector implements FTPConnector {
 *   // ... implementation
 * }
 *
 * const { transport } = ftp('ftp://server.com', new MyFtpConnector());
 * ```
 */

import type { Connector, RequestContext, Response } from '@unireq/core';

/**
 * FTP session representing an active connection
 */
export interface FTPSession {
  /** Whether the session is currently connected */
  readonly connected: boolean;
  /** FTP server hostname */
  readonly host: string;
  /** Authenticated username */
  readonly user: string;
  /** Whether the connection uses TLS (FTPS) */
  readonly secure: boolean;
}

/**
 * FTP connector capabilities
 */
export interface FTPCapabilities {
  /** Supports FTP protocol */
  readonly ftp: boolean;
  /** Supports FTPS (FTP over TLS) */
  readonly ftps: boolean;
  /** Supports file deletion */
  readonly delete: boolean;
  /** Supports file/directory renaming */
  readonly rename: boolean;
  /** Supports directory creation */
  readonly mkdir: boolean;
  /** Supports directory removal */
  readonly rmdir: boolean;
  /** Index signature for TransportCapabilities compatibility */
  readonly [key: string]: boolean | undefined;
}

/**
 * FTP connector options for connection configuration
 */
export interface FTPConnectorOptions {
  /** Connection timeout in milliseconds */
  readonly timeout?: number;
  /** Use passive mode (default: true) */
  readonly passive?: boolean;
  /** TLS options for secure connections */
  readonly secureOptions?: {
    /** Minimum TLS version */
    readonly minVersion?: string;
    /** Reject unauthorized certificates */
    readonly rejectUnauthorized?: boolean;
  };
}

/**
 * FTP operation types extracted from request context
 */
export type FTPOperation = 'list' | 'get' | 'put' | 'delete' | 'rename' | 'mkdir' | 'rmdir';

/**
 * Extended request context for FTP operations
 */
export interface FTPRequestContext extends RequestContext {
  /** FTP operation to perform */
  readonly operation: FTPOperation;
  /** Destination path for rename operations */
  readonly destination?: string;
}

/**
 * FTP Connector interface
 *
 * Extends the core Connector interface with FTP-specific capabilities.
 * The connector is responsible for:
 * - Establishing and managing FTP connections
 * - Translating RequestContext to FTP operations
 * - Returning standardized Response objects
 */
export interface FTPConnector extends Connector<FTPSession> {
  /**
   * Connect to an FTP server
   * @param uri - FTP URI (e.g., 'ftp://user:pass@host:port')
   * @returns FTP session
   */
  connect(uri: string): Promise<FTPSession>;

  /**
   * Execute an FTP request
   * @param session - Active FTP session
   * @param ctx - Request context with FTP operation
   * @returns Response with operation result
   */
  request(session: FTPSession, ctx: RequestContext): Promise<Response>;

  /**
   * Disconnect from FTP server
   * @param session - Active FTP session
   */
  disconnect(session: FTPSession): Promise<void> | void;

  /**
   * Connector capabilities
   */
  readonly capabilities: FTPCapabilities;
}

/**
 * FTP file entry from directory listing
 */
export interface FTPFileEntry {
  /** File or directory name */
  readonly name: string;
  /** Entry type: 0 = file, 1 = directory, 2 = symbolic link */
  readonly type: number;
  /** File size in bytes (for files only) */
  readonly size?: number;
  /** Last modification date */
  readonly modifiedAt?: Date;
  /** File permissions string (e.g., 'rwxr-xr-x') */
  readonly permissions?: string;
  /** Owner name */
  readonly owner?: string;
  /** Group name */
  readonly group?: string;
}
