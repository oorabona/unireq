/**
 * BasicFtpConnector - Default FTP connector using basic-ftp library
 *
 * This connector implements the FTPConnector interface using the basic-ftp library.
 * It is the default connector used when no custom connector is provided.
 *
 * @requires basic-ftp - Install with: npm install basic-ftp
 */

import { Readable, Writable } from 'node:stream';
import type { RequestContext, Response } from '@unireq/core';
import type {
  FTPCapabilities,
  FTPConnector,
  FTPConnectorOptions,
  FTPFileEntry,
  FTPOperation,
  FTPSession,
} from '../connector.js';

/**
 * BasicFtpConnector using basic-ftp library
 *
 * @example
 * ```ts
 * import { ftp } from '@unireq/ftp';
 * import { BasicFtpConnector } from '@unireq/ftp/connectors/basic-ftp';
 *
 * // With default options
 * const { transport } = ftp('ftp://server.com');
 *
 * // With custom options
 * const connector = new BasicFtpConnector({ timeout: 30000 });
 * const { transport } = ftp('ftp://server.com', connector);
 * ```
 */
export class BasicFtpConnector implements FTPConnector {
  private readonly options: FTPConnectorOptions;
  private client: BasicFtpClient | null = null;

  readonly capabilities: FTPCapabilities = {
    ftp: true,
    ftps: true,
    delete: true,
    rename: true,
    mkdir: true,
    rmdir: true,
  };

  constructor(options: FTPConnectorOptions = {}) {
    this.options = options;
  }

  async connect(uri: string): Promise<FTPSession> {
    const url = new URL(uri);

    // Dynamically import basic-ftp
    const { Client } = await import('basic-ftp');
    // Cast to our minimal interface to avoid type conflicts with basic-ftp internals
    const client = new Client(this.options.timeout) as unknown as BasicFtpClient;
    this.client = client;

    const secure = url.protocol === 'ftps:';

    await client.access({
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : secure ? 990 : 21,
      user: url.username || 'anonymous',
      password: url.password || 'anonymous@',
      secure,
      secureOptions: this.options.secureOptions,
    });

    return {
      connected: true,
      host: url.hostname,
      user: url.username || 'anonymous',
      secure,
    };
  }

  async request(session: FTPSession, ctx: RequestContext): Promise<Response> {
    if (!this.client || !session.connected) {
      throw new Error('FTP session not connected');
    }

    const operation = (ctx as Record<string, unknown>)['operation'] as FTPOperation | undefined;
    const url = new URL(ctx.url);
    const path = decodeURIComponent(url.pathname) || '/';

    try {
      let data: unknown;

      switch (operation) {
        case 'list': {
          const rawList = await this.client.list(path);
          data = rawList.map(
            (item): FTPFileEntry => ({
              name: item.name,
              type: item.type,
              size: item.size,
              modifiedAt: item.modifiedAt,
              permissions: item.permissions,
              owner: item.user,
              group: item.group,
            }),
          );
          break;
        }

        case 'get': {
          const chunks: Buffer[] = [];
          const writable = new Writable({
            write(chunk, _encoding, callback) {
              chunks.push(chunk);
              callback();
            },
          });
          await this.client.downloadTo(writable, path);
          data = Buffer.concat(chunks);
          break;
        }

        case 'put': {
          const content =
            typeof ctx.body === 'string'
              ? Buffer.from(ctx.body)
              : ctx.body instanceof Buffer
                ? ctx.body
                : Buffer.from(JSON.stringify(ctx.body));

          const readable = Readable.from(content);
          await this.client.uploadFrom(readable, path);
          data = { uploaded: true, path };
          break;
        }

        case 'delete': {
          await this.client.remove(path);
          data = { deleted: true, path };
          break;
        }

        case 'rename': {
          const destination = (ctx as Record<string, unknown>)['destination'] as string;
          if (!destination) {
            throw new Error('Rename operation requires a destination path');
          }
          await this.client.rename(path, destination);
          data = { renamed: true, from: path, to: destination };
          break;
        }

        case 'mkdir': {
          await this.client.ensureDir(path);
          data = { created: true, path };
          break;
        }

        case 'rmdir': {
          await this.client.removeDir(path);
          data = { removed: true, path };
          break;
        }

        default:
          throw new Error(`Unsupported FTP operation: ${operation}`);
      }

      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data,
        ok: true,
      };
    } catch (error) {
      return {
        status: 500,
        statusText: 'Error',
        headers: {},
        data: { error: error instanceof Error ? error.message : String(error) },
        ok: false,
      };
    }
  }

  disconnect(session: FTPSession): void {
    if (this.client && session.connected) {
      this.client.close();
      this.client = null;
    }
  }
}

/**
 * basic-ftp Client interface (minimal subset used by connector)
 * This allows the connector to work without requiring basic-ftp types at compile time
 */
interface BasicFtpClient {
  access(options: {
    host: string;
    port?: number;
    user?: string;
    password?: string;
    secure?: boolean;
    secureOptions?: unknown;
  }): Promise<void>;
  close(): void;
  list(path?: string): Promise<BasicFtpFileInfo[]>;
  downloadTo(destination: NodeJS.WritableStream, fromPath: string): Promise<void>;
  uploadFrom(source: NodeJS.ReadableStream, toPath: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(fromPath: string, toPath: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  removeDir(path: string): Promise<void>;
}

interface BasicFtpFileInfo {
  name: string;
  type: number;
  size: number;
  modifiedAt?: Date;
  permissions?: string;
  user?: string;
  group?: string;
}

/**
 * Creates a default BasicFtpConnector instance
 * Used internally by the ftp() transport function
 */
export function createDefaultFtpConnector(options?: FTPConnectorOptions): FTPConnector {
  return new BasicFtpConnector(options);
}
