/**
 * IMAP Facade - Ergonomic API built on top of imap() transport
 *
 * This is NOT a reimplementation of IMAP - it's syntactic sugar
 * over the existing transport + policy composition.
 *
 * @example
 * ```ts
 * const mail = preset.imap
 *   .uri('imap://user:pass@imap.gmail.com')
 *   .auth({ tokenSupplier })
 *   .retry
 *   .build();
 *
 * // These methods wrap: client.get('/', imapOperation('fetch', {...}))
 * const messages = await mail.fetch('INBOX', '1:20');
 * await mail.append('Drafts', emailContent);
 * await mail.idle();
 * ```
 */

import { backoff, type Client, client, type Policy, type Response, retry } from '@unireq/core';
// Note: @unireq/imap is an optional peer dependency
// Users must install it to use the IMAP facade
import {
  type IMAPConnector,
  type IMAPMessage,
  imap,
  imapOperation,
  type SearchCriteria,
  type XOAuth2Options,
  xoauth2,
} from '@unireq/imap';

/**
 * Default retry predicate for IMAP operations
 * Retries on errors (not on successful responses)
 */
const imapRetryPredicate = (_result: Response | null, error: Error | null): boolean => error !== null;

/**
 * Message envelope from IMAP FETCH
 */
export type { IMAPEnvelope as ImapEnvelope, IMAPMessage as ImapMessage, SearchCriteria } from '@unireq/imap';

/**
 * Append result from IMAP APPEND
 */
export interface ImapAppendResult {
  uid?: number;
  [key: string]: unknown;
}

/**
 * IMAP client facade with domain-specific methods
 * All methods are syntactic sugar over the underlying transport
 */
export interface ImapClient {
  /**
   * Fetch messages from a mailbox
   * Wraps: client.get('/', imapOperation('fetch', { mailbox, range }))
   *
   * @param mailbox - Mailbox name (e.g., 'INBOX', 'Sent')
   * @param range - Message range (e.g., '1:10', '1:*', '*')
   * @returns Array of message objects
   */
  fetch(mailbox: string, range?: string): Promise<IMAPMessage[]>;

  /**
   * Select a mailbox (ping/verify access)
   * Wraps: client.get('/', imapOperation('select', { mailbox }))
   *
   * @param mailbox - Mailbox name
   * @returns Array of messages (same as fetch)
   */
  select(mailbox: string): Promise<IMAPMessage[]>;

  /**
   * Append a message to a mailbox
   * Wraps: client.post('/', body, imapOperation('append', { mailbox }))
   *
   * @param mailbox - Destination mailbox (e.g., 'Drafts', 'Sent')
   * @param content - Email content (RFC 2822 format or object to serialize)
   * @returns Append result with UID if server supports UIDPLUS
   */
  append(mailbox: string, content: string | Buffer | unknown): Promise<ImapAppendResult>;

  /**
   * Enter IDLE mode to wait for server notifications
   * Wraps: client.get('/', imapOperation('idle'))
   *
   * @returns Status object when IDLE completes
   */
  idle(): Promise<{ status: string }>;

  /**
   * Search for messages matching criteria
   * Wraps: client.get('/', imapOperation('search', { mailbox, criteria }))
   *
   * @param mailbox - Mailbox to search in
   * @param criteria - Search criteria (see SearchCriteria)
   * @returns Array of message UIDs matching the criteria
   */
  search(mailbox: string, criteria: SearchCriteria): Promise<number[]>;

  /**
   * Move messages to another mailbox
   * Wraps: client.get('/', imapOperation('move', { mailbox, destination, range }))
   *
   * @param mailbox - Source mailbox
   * @param destination - Destination mailbox
   * @param range - Message range to move (e.g., '1:10', UIDs)
   * @returns Move result
   */
  move(
    mailbox: string,
    destination: string,
    range?: string | number[],
  ): Promise<{ moved: boolean; destination: string }>;

  /**
   * Add flags to messages
   * Wraps: client.get('/', imapOperation('addFlags', { mailbox, range, flags }))
   *
   * @param mailbox - Mailbox containing the messages
   * @param range - Message range (e.g., '1:10', UIDs)
   * @param flags - Flags to add (e.g., ['\\Seen', '\\Flagged'])
   * @returns Result with flags added
   */
  addFlags(mailbox: string, range: string | number[], flags: string[]): Promise<{ flagsAdded: string[] }>;

  /**
   * Remove flags from messages
   * Wraps: client.get('/', imapOperation('removeFlags', { mailbox, range, flags }))
   *
   * @param mailbox - Mailbox containing the messages
   * @param range - Message range (e.g., '1:10', UIDs)
   * @param flags - Flags to remove (e.g., ['\\Seen'])
   * @returns Result with flags removed
   */
  removeFlags(mailbox: string, range: string | number[], flags: string[]): Promise<{ flagsRemoved: string[] }>;

  /**
   * Permanently delete messages marked as \Deleted
   * Wraps: client.get('/', imapOperation('expunge', { mailbox, range }))
   *
   * @param mailbox - Mailbox to expunge
   * @param range - Optional range of messages to expunge
   * @returns Expunge result
   */
  expunge(mailbox: string, range?: string | number[]): Promise<{ expunged: boolean }>;

  /**
   * Access the underlying unireq client for advanced use cases
   */
  readonly raw: Client;
}

/**
 * Configuration accumulated during builder chain
 */
interface ImapFacadeConfig {
  uri?: string;
  connector?: IMAPConnector;
  xoauth2?: XOAuth2Options;
  retry?: boolean | { tries?: number };
  policies?: Policy[];
}

/**
 * Fluent builder for IMAP client facade
 *
 * @example
 * ```ts
 * // With default connector (requires: npm install imapflow)
 * const mail = preset.imap
 *   .uri('imap://user:pass@imap.gmail.com')
 *   .auth({ tokenSupplier: () => getToken() })
 *   .retry
 *   .build();
 *
 * // With custom connector (BYOC)
 * const mail = preset.imap
 *   .uri('imap://imap.gmail.com')
 *   .connector(myCustomConnector)
 *   .retry
 *   .build();
 * ```
 */
export class ImapFacadeBuilder {
  private config: ImapFacadeConfig;

  constructor(config: ImapFacadeConfig = {}) {
    this.config = { ...config };
  }

  /**
   * Set the IMAP URI (required)
   */
  uri(imapUri: string): ImapFacadeBuilder {
    return new ImapFacadeBuilder({ ...this.config, uri: imapUri });
  }

  /**
   * Set a custom IMAP connector (BYOC)
   * If not provided, uses the default ImapFlowConnector (requires imapflow)
   */
  connector(imapConnector: IMAPConnector): ImapFacadeBuilder {
    return new ImapFacadeBuilder({ ...this.config, connector: imapConnector });
  }

  /**
   * Add XOAUTH2 authentication
   */
  auth(options: XOAuth2Options): ImapFacadeBuilder {
    return new ImapFacadeBuilder({ ...this.config, xoauth2: options });
  }

  /**
   * Add retry with exponential backoff
   */
  get retry(): ImapFacadeBuilder {
    return new ImapFacadeBuilder({ ...this.config, retry: true });
  }

  /**
   * Add retry with custom configuration
   */
  withRetry(options: { tries?: number }): ImapFacadeBuilder {
    return new ImapFacadeBuilder({ ...this.config, retry: options });
  }

  /**
   * Add custom policies
   */
  with(...policies: Policy[]): ImapFacadeBuilder {
    return new ImapFacadeBuilder({
      ...this.config,
      policies: [...(this.config.policies || []), ...policies],
    });
  }

  /**
   * Build the IMAP client facade
   * @throws Error if URI is not provided
   */
  build(): ImapClient {
    if (!this.config.uri) {
      throw new Error('IMAP URI is required. Use .uri("imap://user:pass@host")');
    }

    const policies: Policy[] = [];

    // Add XOAUTH2 if configured
    if (this.config.xoauth2) {
      policies.push(xoauth2(this.config.xoauth2));
    }

    // Add retry if configured
    if (this.config.retry) {
      const tries = typeof this.config.retry === 'object' ? (this.config.retry.tries ?? 3) : 3;
      policies.push(retry(imapRetryPredicate, [backoff({ initial: 1000, max: 10000, jitter: true })], { tries }));
    }

    // Add custom policies
    if (this.config.policies) {
      policies.push(...this.config.policies);
    }

    // Create the underlying client using the new imap() transport
    const { transport } = imap(this.config.uri, this.config.connector);
    const rawClient = client(transport, ...policies);

    // Create the facade with domain-specific methods
    const facade: ImapClient = {
      raw: rawClient,

      async fetch(mailbox: string, range = '1:*'): Promise<IMAPMessage[]> {
        const response = await rawClient.get<IMAPMessage[]>('/', imapOperation('fetch', { mailbox, range }));
        return response.data ?? [];
      },

      async select(mailbox: string): Promise<IMAPMessage[]> {
        const response = await rawClient.get<IMAPMessage[]>('/', imapOperation('select', { mailbox }));
        return response.data ?? [];
      },

      async append(mailbox: string, content: string | Buffer | unknown): Promise<ImapAppendResult> {
        const response = await rawClient.post<ImapAppendResult>('/', content, imapOperation('append', { mailbox }));
        return response.data ?? {};
      },

      async idle(): Promise<{ status: string }> {
        const response = await rawClient.get<{ status: string }>('/', imapOperation('idle'));
        return response.data ?? { status: 'unknown' };
      },

      async search(mailbox: string, criteria: SearchCriteria): Promise<number[]> {
        const response = await rawClient.get<number[]>('/', imapOperation('search', { mailbox, criteria }));
        return response.data ?? [];
      },

      async move(
        mailbox: string,
        destination: string,
        range: string | number[] = '1:*',
      ): Promise<{ moved: boolean; destination: string }> {
        const response = await rawClient.get<{ moved: boolean; destination: string }>(
          '/',
          imapOperation('move', { mailbox, destination, range }),
        );
        return response.data ?? { moved: false, destination };
      },

      async addFlags(mailbox: string, range: string | number[], flags: string[]): Promise<{ flagsAdded: string[] }> {
        const response = await rawClient.get<{ flagsAdded: string[] }>(
          '/',
          imapOperation('addFlags', { mailbox, range, flags }),
        );
        return response.data ?? { flagsAdded: [] };
      },

      async removeFlags(
        mailbox: string,
        range: string | number[],
        flags: string[],
      ): Promise<{ flagsRemoved: string[] }> {
        const response = await rawClient.get<{ flagsRemoved: string[] }>(
          '/',
          imapOperation('removeFlags', { mailbox, range, flags }),
        );
        return response.data ?? { flagsRemoved: [] };
      },

      async expunge(mailbox: string, range?: string | number[]): Promise<{ expunged: boolean }> {
        const response = await rawClient.get<{ expunged: boolean }>('/', imapOperation('expunge', { mailbox, range }));
        return response.data ?? { expunged: false };
      },
    };

    return facade;
  }
}

/**
 * Entry point for IMAP facade builder
 */
export const imapPreset = {
  /**
   * Start building an IMAP client with a URI
   */
  uri(imapUri: string): ImapFacadeBuilder {
    return new ImapFacadeBuilder({ uri: imapUri });
  },

  /**
   * Start building an IMAP client (URI required before build)
   */
  get builder(): ImapFacadeBuilder {
    return new ImapFacadeBuilder();
  },
};
