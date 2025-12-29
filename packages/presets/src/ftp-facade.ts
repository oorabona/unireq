/**
 * FTP Facade - Ergonomic API built on top of ftp() transport
 *
 * This is NOT a reimplementation of FTP - it's syntactic sugar
 * over the existing transport + policy composition.
 *
 * @example
 * ```ts
 * const ftpClient = preset.ftp
 *   .uri('ftp://user:pass@ftp.example.com')
 *   .retry
 *   .build();
 *
 * // These methods wrap: client.get(url, ftpOperation('list'))
 * const files = await ftpClient.list('/public');
 * const data = await ftpClient.download('/file.txt');
 * await ftpClient.upload('/upload/file.txt', content);
 * ```
 */

import { backoff, type Client, client, type Policy, type Response, retry } from '@unireq/core';
// Note: @unireq/ftp is an optional peer dependency
// Users must install it to use the FTP facade
import { type FTPConnector, type FTPFileEntry, ftp, ftpOperation } from '@unireq/ftp';

/**
 * Default retry predicate for FTP operations
 * Retries on errors (not on successful responses)
 */
const ftpRetryPredicate = (_result: Response | null, error: Error | null): boolean => error !== null;

/**
 * FTP file listing entry
 */
export type { FTPFileEntry as FtpFileEntry } from '@unireq/ftp';

/**
 * FTP client facade with domain-specific methods
 * All methods are syntactic sugar over the underlying transport
 */
export interface FtpClient {
  /**
   * List directory contents
   * Wraps: client.get(path, ftpOperation('list'))
   *
   * @param path - Path relative to base URI (e.g., '/public', '/documents')
   * @returns Array of file entries
   */
  list(path: string): Promise<FTPFileEntry[]>;

  /**
   * Download a file
   * Wraps: client.get(path, ftpOperation('get'))
   *
   * @param path - Path to the file relative to base URI
   * @returns File contents as Buffer
   */
  download(path: string): Promise<Buffer>;

  /**
   * Upload a file
   * Wraps: client.put(path, content, ftpOperation('put'))
   *
   * @param path - Destination path relative to base URI
   * @param content - File content (string, Buffer, or object to serialize as JSON)
   * @returns Upload result
   */
  upload(path: string, content: string | Buffer | unknown): Promise<{ uploaded: boolean }>;

  /**
   * Delete a file
   * Wraps: client.delete(path, ftpOperation('delete'))
   *
   * @param path - Path to the file to delete
   * @returns Delete result
   */
  delete(path: string): Promise<{ deleted: boolean; path: string }>;

  /**
   * Rename/move a file
   * Wraps: client.get(path, ftpOperation('rename', { destination }))
   *
   * @param path - Source file path
   * @param destination - New path for the file
   * @returns Rename result
   */
  rename(path: string, destination: string): Promise<{ renamed: boolean; from: string; to: string }>;

  /**
   * Create a directory
   * Wraps: client.get(path, ftpOperation('mkdir'))
   *
   * @param path - Directory path to create
   * @returns Create result
   */
  mkdir(path: string): Promise<{ created: boolean; path: string }>;

  /**
   * Remove a directory
   * Wraps: client.get(path, ftpOperation('rmdir'))
   *
   * @param path - Directory path to remove
   * @returns Remove result
   */
  rmdir(path: string): Promise<{ removed: boolean; path: string }>;

  /**
   * Access the underlying unireq client for advanced use cases
   */
  readonly raw: Client;
}

/**
 * Configuration accumulated during builder chain
 */
interface FtpFacadeConfig {
  uri?: string;
  connector?: FTPConnector;
  retry?: boolean | { tries?: number };
  policies?: Policy[];
}

/**
 * Fluent builder for FTP client facade
 *
 * @example
 * ```ts
 * // With default connector (requires: npm install basic-ftp)
 * const ftpClient = preset.ftp
 *   .uri('ftp://user:pass@ftp.example.com')
 *   .retry
 *   .build();
 *
 * // With custom connector (BYOC)
 * const ftpClient = preset.ftp
 *   .uri('ftp://ftp.example.com')
 *   .connector(myCustomConnector)
 *   .retry
 *   .build();
 * ```
 */
export class FtpFacadeBuilder {
  private config: FtpFacadeConfig;

  constructor(config: FtpFacadeConfig = {}) {
    this.config = { ...config };
  }

  /**
   * Set the FTP URI (required)
   */
  uri(ftpUri: string): FtpFacadeBuilder {
    return new FtpFacadeBuilder({ ...this.config, uri: ftpUri });
  }

  /**
   * Set a custom FTP connector (BYOC)
   * If not provided, uses the default BasicFtpConnector (requires basic-ftp)
   */
  connector(ftpConnector: FTPConnector): FtpFacadeBuilder {
    return new FtpFacadeBuilder({ ...this.config, connector: ftpConnector });
  }

  /**
   * Add retry with exponential backoff
   */
  get retry(): FtpFacadeBuilder {
    return new FtpFacadeBuilder({ ...this.config, retry: true });
  }

  /**
   * Add retry with custom configuration
   */
  withRetry(options: { tries?: number }): FtpFacadeBuilder {
    return new FtpFacadeBuilder({ ...this.config, retry: options });
  }

  /**
   * Add custom policies
   */
  with(...policies: Policy[]): FtpFacadeBuilder {
    return new FtpFacadeBuilder({
      ...this.config,
      policies: [...(this.config.policies || []), ...policies],
    });
  }

  /**
   * Build the FTP client facade
   * @throws Error if URI is not provided
   */
  build(): FtpClient {
    if (!this.config.uri) {
      throw new Error('FTP URI is required. Use .uri("ftp://user:pass@host")');
    }

    const policies: Policy[] = [];

    // Add retry if configured
    if (this.config.retry) {
      const tries = typeof this.config.retry === 'object' ? (this.config.retry.tries ?? 3) : 3;
      policies.push(retry(ftpRetryPredicate, [backoff({ initial: 1000, max: 10000, jitter: true })], { tries }));
    }

    // Add custom policies
    if (this.config.policies) {
      policies.push(...this.config.policies);
    }

    // Create the underlying client using the new ftp() transport
    const { transport } = ftp(this.config.uri, this.config.connector);
    const rawClient = client(transport, ...policies);

    // Create the facade with domain-specific methods
    const facade: FtpClient = {
      raw: rawClient,

      async list(path: string): Promise<FTPFileEntry[]> {
        const response = await rawClient.get<FTPFileEntry[]>(path, ftpOperation('list'));
        return response.data ?? [];
      },

      async download(path: string): Promise<Buffer> {
        const response = await rawClient.get<Buffer>(path, ftpOperation('get'));
        return response.data ?? Buffer.alloc(0);
      },

      async upload(path: string, content: string | Buffer | unknown): Promise<{ uploaded: boolean }> {
        const response = await rawClient.put<{ uploaded: boolean }>(path, content, ftpOperation('put'));
        return response.data ?? { uploaded: false };
      },

      async delete(path: string): Promise<{ deleted: boolean; path: string }> {
        const response = await rawClient.delete<{ deleted: boolean; path: string }>(path, ftpOperation('delete'));
        return response.data ?? { deleted: false, path };
      },

      async rename(path: string, destination: string): Promise<{ renamed: boolean; from: string; to: string }> {
        const response = await rawClient.get<{ renamed: boolean; from: string; to: string }>(
          path,
          ftpOperation('rename', { destination }),
        );
        return response.data ?? { renamed: false, from: path, to: destination };
      },

      async mkdir(path: string): Promise<{ created: boolean; path: string }> {
        const response = await rawClient.get<{ created: boolean; path: string }>(path, ftpOperation('mkdir'));
        return response.data ?? { created: false, path };
      },

      async rmdir(path: string): Promise<{ removed: boolean; path: string }> {
        const response = await rawClient.get<{ removed: boolean; path: string }>(path, ftpOperation('rmdir'));
        return response.data ?? { removed: false, path };
      },
    };

    return facade;
  }
}

/**
 * Entry point for FTP facade builder
 */
export const ftpPreset = {
  /**
   * Start building an FTP client with a URI
   */
  uri(ftpUri: string): FtpFacadeBuilder {
    return new FtpFacadeBuilder({ uri: ftpUri });
  },

  /**
   * Start building an FTP client (URI required before build)
   */
  get builder(): FtpFacadeBuilder {
    return new FtpFacadeBuilder();
  },
};
