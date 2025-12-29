/**
 * ImapFlowConnector - Default IMAP connector using imapflow library
 *
 * This connector implements the IMAPConnector interface using the imapflow library.
 * It is the default connector used when no custom connector is provided.
 *
 * @requires imapflow - Install with: npm install imapflow
 */

import type { RequestContext, Response } from '@unireq/core';
import type {
  IMAPCapabilities,
  IMAPConnector,
  IMAPConnectorOptions,
  IMAPMessage,
  IMAPOperation,
  IMAPSession,
  SearchCriteria,
} from '../connector.js';

/**
 * ImapFlowConnector using imapflow library
 *
 * @example
 * ```ts
 * import { imap } from '@unireq/imap';
 * import { ImapFlowConnector } from '@unireq/imap/connectors/imapflow';
 *
 * // With default options
 * const { transport } = imap('imap://mail.server.com');
 *
 * // With custom options
 * const connector = new ImapFlowConnector({ timeout: 30000 });
 * const { transport } = imap('imap://mail.server.com', connector);
 * ```
 */
export class ImapFlowConnector implements IMAPConnector {
  private readonly options: IMAPConnectorOptions;
  private client: ImapFlowClient | null = null;

  readonly capabilities: IMAPCapabilities = {
    imap: true,
    xoauth2: true,
    idle: true,
    append: true,
    search: true,
    move: true,
    flags: true,
    expunge: true,
  };

  constructor(options: IMAPConnectorOptions = {}) {
    this.options = options;
  }

  async connect(uri: string): Promise<IMAPSession> {
    const url = new URL(uri);

    // Dynamically import imapflow
    const { ImapFlow } = await import('imapflow');

    const secure = url.protocol === 'imaps:';
    const port = url.port ? parseInt(url.port, 10) : secure ? 993 : 143;

    // Build auth config
    const auth: ImapFlowAuth = {
      user: decodeURIComponent(url.username) || 'anonymous',
      pass: decodeURIComponent(url.password) || '',
    };

    // Build config object
    const config: ImapFlowConfig = {
      host: url.hostname,
      port,
      secure,
      auth,
      logger: this.options.debug ? console : false,
      tls: this.options.tls,
    };

    // Cast to our minimal interface to avoid type conflicts
    const client = new (ImapFlow as unknown as ImapFlowConstructor)(config) as ImapFlowClient;

    this.client = client;

    await client.connect();

    return {
      connected: true,
      host: url.hostname,
      user: auth.user,
      usable: client.usable ?? true,
      secure,
    };
  }

  async request(session: IMAPSession, ctx: RequestContext): Promise<Response> {
    if (!this.client || !session.connected) {
      throw new Error('IMAP session not connected');
    }

    const client = this.client;
    const operation = (ctx as Record<string, unknown>)['operation'] as IMAPOperation | undefined;

    try {
      let data: unknown;

      switch (operation) {
        case 'fetch':
        case 'select': {
          const mailbox = (ctx as Record<string, unknown>)['mailbox'] as string;
          const range = ((ctx as Record<string, unknown>)['range'] as string) || '1:*';
          const lock = await client.getMailboxLock(mailbox);
          try {
            const messages: IMAPMessage[] = [];
            for await (const msg of client.fetch(range, { envelope: true, flags: true, size: true })) {
              messages.push({
                seq: msg.seq,
                uid: msg.uid,
                envelope: msg.envelope as IMAPMessage['envelope'],
                flags: msg.flags,
                size: msg.size,
              });
            }
            data = messages;
          } finally {
            lock.release();
          }
          break;
        }

        case 'append': {
          const mailbox = (ctx as Record<string, unknown>)['mailbox'] as string;
          const content = typeof ctx.body === 'string' ? ctx.body : JSON.stringify(ctx.body);
          const flags = (ctx as Record<string, unknown>)['flags'] as string[] | undefined;
          data = await client.append(mailbox, content, flags);
          break;
        }

        case 'idle': {
          await client.idle();
          data = { status: 'idle' };
          break;
        }

        case 'search': {
          const mailbox = (ctx as Record<string, unknown>)['mailbox'] as string;
          const criteria = (ctx as Record<string, unknown>)['criteria'] as SearchCriteria;
          const useUid = ((ctx as Record<string, unknown>)['useUid'] as boolean) ?? true;
          const lock = await client.getMailboxLock(mailbox);
          try {
            data = await client.search(criteria, { uid: useUid });
          } finally {
            lock.release();
          }
          break;
        }

        case 'move': {
          const mailbox = (ctx as Record<string, unknown>)['mailbox'] as string;
          const destination = (ctx as Record<string, unknown>)['destination'] as string;
          const range = ((ctx as Record<string, unknown>)['range'] as string | number[]) || '1:*';
          const lock = await client.getMailboxLock(mailbox);
          try {
            await client.messageMove(range, destination);
            data = { moved: true, destination };
          } finally {
            lock.release();
          }
          break;
        }

        case 'addFlags':
        case 'setFlags': {
          const mailbox = (ctx as Record<string, unknown>)['mailbox'] as string;
          const range = ((ctx as Record<string, unknown>)['range'] as string | number[]) || '1:*';
          const flags = (ctx as Record<string, unknown>)['flags'] as string[];
          const lock = await client.getMailboxLock(mailbox);
          try {
            await client.messageFlagsAdd(range, flags);
            data = { flagsAdded: flags };
          } finally {
            lock.release();
          }
          break;
        }

        case 'removeFlags': {
          const mailbox = (ctx as Record<string, unknown>)['mailbox'] as string;
          const range = ((ctx as Record<string, unknown>)['range'] as string | number[]) || '1:*';
          const flags = (ctx as Record<string, unknown>)['flags'] as string[];
          const lock = await client.getMailboxLock(mailbox);
          try {
            await client.messageFlagsRemove(range, flags);
            data = { flagsRemoved: flags };
          } finally {
            lock.release();
          }
          break;
        }

        case 'replaceFlags': {
          const mailbox = (ctx as Record<string, unknown>)['mailbox'] as string;
          const range = ((ctx as Record<string, unknown>)['range'] as string | number[]) || '1:*';
          const flags = (ctx as Record<string, unknown>)['flags'] as string[];
          const lock = await client.getMailboxLock(mailbox);
          try {
            await client.messageFlagsSet(range, flags);
            data = { flagsSet: flags };
          } finally {
            lock.release();
          }
          break;
        }

        case 'expunge': {
          const mailbox = (ctx as Record<string, unknown>)['mailbox'] as string;
          const range = (ctx as Record<string, unknown>)['range'] as string | number[] | undefined;
          const lock = await client.getMailboxLock(mailbox);
          try {
            await client.expunge(range);
            data = { expunged: true };
          } finally {
            lock.release();
          }
          break;
        }

        default:
          throw new Error(`Unsupported IMAP operation: ${operation}`);
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

  async disconnect(session: IMAPSession): Promise<void> {
    if (this.client && session.connected) {
      await this.client.logout();
      this.client = null;
    }
  }
}

/**
 * imapflow Client interface (minimal subset used by connector)
 * This allows the connector to work without requiring imapflow types at compile time
 */
interface ImapFlowClient {
  usable?: boolean;
  connect(): Promise<void>;
  logout(): Promise<void>;
  getMailboxLock(path: string): Promise<{ release: () => void }>;
  fetch(
    range: string,
    options: { envelope?: boolean; flags?: boolean; size?: boolean },
  ): AsyncIterableIterator<ImapFlowMessage>;
  append(path: string, content: string | Buffer, flags?: string[]): Promise<unknown>;
  idle(): Promise<void>;
  search(criteria: SearchCriteria, options?: { uid?: boolean }): Promise<number[]>;
  messageMove(range: string | number[], destination: string): Promise<void>;
  messageFlagsAdd(range: string | number[], flags: string[]): Promise<void>;
  messageFlagsRemove(range: string | number[], flags: string[]): Promise<void>;
  messageFlagsSet(range: string | number[], flags: string[]): Promise<void>;
  expunge(range?: string | number[]): Promise<void>;
}

interface ImapFlowMessage {
  seq: number;
  uid: number;
  envelope?: unknown;
  flags?: Set<string>;
  size?: number;
}

interface ImapFlowAuth {
  user: string;
  pass?: string;
  accessToken?: string;
}

/**
 * ImapFlow configuration (minimal subset)
 */
interface ImapFlowConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: ImapFlowAuth;
  logger?: unknown;
  tls?: unknown;
}

/**
 * ImapFlow constructor type
 */
interface ImapFlowConstructor {
  new (config: ImapFlowConfig): ImapFlowClient;
}

/**
 * Creates a default ImapFlowConnector instance
 * Used internally by the imap() transport function
 */
export function createDefaultImapConnector(options?: IMAPConnectorOptions): IMAPConnector {
  return new ImapFlowConnector(options);
}
