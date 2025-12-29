/**
 * @unireq/imap - IMAP transport with BYOC (Bring Your Own Connector) pattern
 *
 * This package provides an IMAP transport that can use:
 * - The default ImapFlowConnector (requires imapflow package as peer dependency)
 * - A custom connector implementing IMAPConnector interface (BYOC)
 *
 * @example Default usage (requires: npm install imapflow)
 * ```ts
 * import { imap, imapOperation } from '@unireq/imap';
 * import { client } from '@unireq/core';
 *
 * const { transport } = imap('imap://user:pass@mail.server.com');
 * const api = client(transport);
 *
 * // Fetch messages
 * const messages = await api.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));
 *
 * // Search messages
 * const ids = await api.get('/', imapOperation('search', {
 *   mailbox: 'INBOX',
 *   criteria: { from: 'sender@example.com' }
 * }));
 * ```
 *
 * @example BYOC (Bring Your Own Connector)
 * ```ts
 * import { imap, type IMAPConnector } from '@unireq/imap';
 *
 * class MyImapConnector implements IMAPConnector {
 *   // Custom implementation...
 * }
 *
 * const { transport } = imap('imap://mail.server.com', new MyImapConnector());
 * ```
 *
 * @packageDocumentation
 */

// Re-export core types for convenience
export type { Connector, RequestContext, Response, TransportWithCapabilities } from '@unireq/core';
export { policy } from '@unireq/core';
// Connector interface for BYOC
export type {
  IMAPAddress,
  IMAPCapabilities,
  IMAPConnector,
  IMAPConnectorOptions,
  IMAPEnvelope,
  IMAPMessage,
  IMAPOperation,
  IMAPRequestContext,
  IMAPSession,
  SearchCriteria,
} from './connector.js';
// Default connector (requires imapflow peer dependency)
export { createDefaultImapConnector, ImapFlowConnector } from './connectors/imapflow.js';
// Main transport function
export { type IMAPTransportOptions, imap } from './transport.js';

// Import policy for internal use
import { type RequestContext as Ctx, type Policy, policy as policyFn, type Response as Res } from '@unireq/core';
import type { IMAPOperation, SearchCriteria } from './connector.js';

/**
 * IMAP operation options for imapOperation policy
 */
export interface ImapOperationOptions {
  /** Target mailbox for operations */
  readonly mailbox?: string;
  /** Message range for operations (e.g., '1:*', '1,2,3') */
  readonly range?: string | number[];
  /** Search criteria for search operation */
  readonly criteria?: SearchCriteria;
  /** Destination mailbox for move operation */
  readonly destination?: string;
  /** Flags for flag operations */
  readonly flags?: string[];
  /** Whether to use UID instead of sequence numbers */
  readonly useUid?: boolean;
}

/**
 * IMAP operation policy factory
 * Creates a policy that injects the IMAP operation into the request context
 *
 * @param operation - IMAP operation to perform
 * @param options - Operation-specific options
 * @returns Policy that injects operation into context
 *
 * @example
 * ```ts
 * import { imap, imapOperation } from '@unireq/imap';
 * import { client } from '@unireq/core';
 *
 * const { transport } = imap('imap://mail.server.com');
 * const api = client(transport);
 *
 * // Fetch messages from INBOX
 * await api.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));
 *
 * // Search for unread messages
 * await api.get('/', imapOperation('search', {
 *   mailbox: 'INBOX',
 *   criteria: { seen: false }
 * }));
 *
 * // Move messages to Trash
 * await api.get('/', imapOperation('move', {
 *   mailbox: 'INBOX',
 *   range: '1:5',
 *   destination: 'Trash'
 * }));
 *
 * // Add flags to messages
 * await api.get('/', imapOperation('addFlags', {
 *   mailbox: 'INBOX',
 *   range: '1:*',
 *   flags: ['\\Seen']
 * }));
 *
 * // Append a message to a mailbox
 * await api.post('/INBOX', messageContent, imapOperation('append'));
 *
 * // Wait for new messages (IDLE)
 * await api.get('/', imapOperation('idle'));
 *
 * // Expunge deleted messages
 * await api.get('/', imapOperation('expunge', { mailbox: 'INBOX' }));
 * ```
 */
export function imapOperation(operation: IMAPOperation, options: ImapOperationOptions = {}): Policy {
  return policyFn(
    async (ctx: Ctx, next: (ctx: Ctx) => Promise<Res>): Promise<Res> => next({ ...ctx, operation, ...options }),
    { name: `imap:${operation}`, kind: 'other' },
  );
}

/**
 * XOAUTH2 authentication options
 */
export interface XOAuth2Options {
  /** Function that returns the OAuth2 access token */
  readonly tokenSupplier: () => string | Promise<string>;
}

/**
 * Creates an XOAUTH2 authentication policy for IMAP
 *
 * This policy adds OAuth2 token to the request context for authentication.
 *
 * @param options - XOAUTH2 options with token supplier
 * @returns Policy that adds XOAUTH2 token
 *
 * @example
 * ```ts
 * import { imap, imapOperation, xoauth2 } from '@unireq/imap';
 * import { client, compose } from '@unireq/core';
 *
 * const { transport } = imap('imap://mail.server.com');
 * const api = client(
 *   compose(
 *     transport,
 *     xoauth2({ tokenSupplier: async () => await getToken() })
 *   )
 * );
 * ```
 */
export function xoauth2(options: XOAuth2Options): Policy {
  const { tokenSupplier } = options;

  return policyFn(
    async (ctx: Ctx, next: (ctx: Ctx) => Promise<Res>): Promise<Res> => {
      const token = await Promise.resolve(tokenSupplier());

      return next({
        ...ctx,
        xoauth2Token: token,
      } as Ctx);
    },
    { name: 'imap:xoauth2', kind: 'auth' },
  );
}
