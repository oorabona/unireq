/**
 * IMAP Connector interface for BYOC (Bring Your Own Connector) pattern
 *
 * This interface extends the core Connector with IMAP-specific capabilities.
 * Implement this interface to create custom IMAP connectors.
 *
 * @example
 * ```ts
 * import { imap, type IMAPConnector } from '@unireq/imap';
 *
 * class MyImapConnector implements IMAPConnector {
 *   // ... implementation
 * }
 *
 * const { transport } = imap('imap://mail.server.com', new MyImapConnector());
 * ```
 */

import type { Connector, RequestContext, Response } from '@unireq/core';

/**
 * IMAP session representing an active connection
 */
export interface IMAPSession {
  /** Whether the session is currently connected */
  readonly connected: boolean;
  /** IMAP server hostname */
  readonly host: string;
  /** Authenticated username */
  readonly user: string;
  /** Whether the connection is usable for operations */
  readonly usable: boolean;
  /** Whether the connection uses TLS */
  readonly secure: boolean;
}

/**
 * IMAP connector capabilities
 */
export interface IMAPCapabilities {
  /** Supports IMAP protocol */
  readonly imap: boolean;
  /** Supports XOAUTH2 authentication */
  readonly xoauth2: boolean;
  /** Supports IDLE command for push notifications */
  readonly idle: boolean;
  /** Supports APPEND command */
  readonly append: boolean;
  /** Supports SEARCH command */
  readonly search: boolean;
  /** Supports MOVE command */
  readonly move: boolean;
  /** Supports flag operations */
  readonly flags: boolean;
  /** Supports EXPUNGE command */
  readonly expunge: boolean;
  /** Index signature for TransportCapabilities compatibility */
  readonly [key: string]: boolean | undefined;
}

/**
 * IMAP connector options for connection configuration
 */
export interface IMAPConnectorOptions {
  /** Connection timeout in milliseconds */
  readonly timeout?: number;
  /** TLS options for secure connections */
  readonly tls?: {
    /** Minimum TLS version */
    readonly minVersion?: string;
    /** Reject unauthorized certificates */
    readonly rejectUnauthorized?: boolean;
  };
  /** Enable debug logging */
  readonly debug?: boolean;
}

/**
 * IMAP operation types extracted from request context
 */
export type IMAPOperation =
  | 'fetch'
  | 'select'
  | 'append'
  | 'idle'
  | 'search'
  | 'move'
  | 'addFlags'
  | 'removeFlags'
  | 'setFlags'
  | 'replaceFlags'
  | 'expunge';

/**
 * Extended request context for IMAP operations
 */
export interface IMAPRequestContext extends RequestContext {
  /** IMAP operation to perform */
  readonly operation: IMAPOperation;
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
  /** XOAUTH2 token for authentication */
  readonly xoauth2Token?: string;
}

/**
 * IMAP search criteria
 * @see https://www.rfc-editor.org/rfc/rfc3501#section-6.4.4
 */
export interface SearchCriteria {
  /** Messages that have the \Seen flag */
  seen?: boolean;
  /** Messages that have the \Answered flag */
  answered?: boolean;
  /** Messages that have the \Deleted flag */
  deleted?: boolean;
  /** Messages that have the \Flagged flag */
  flagged?: boolean;
  /** Messages that have the \Draft flag */
  draft?: boolean;
  /** Messages that contain the specified string in the header or body */
  keyword?: string;
  /** Messages that do not contain the specified string */
  unkeyword?: string;
  /** Messages from the specified sender */
  from?: string;
  /** Messages to the specified recipient */
  to?: string;
  /** Messages with the specified subject */
  subject?: string;
  /** Messages sent before the specified date */
  before?: Date;
  /** Messages sent on the specified date */
  on?: Date;
  /** Messages sent after the specified date */
  since?: Date;
  /** Messages larger than the specified size in bytes */
  larger?: number;
  /** Messages smaller than the specified size in bytes */
  smaller?: number;
  /** Messages with all of the specified criteria (AND) */
  and?: SearchCriteria[];
  /** Messages with any of the specified criteria (OR) */
  or?: SearchCriteria[];
  /** Messages not matching the specified criteria (NOT) */
  not?: SearchCriteria;
  /** UID range (e.g., '1:100', '*') */
  uid?: string;
  /** Sequence number range */
  seq?: string;
}

/**
 * IMAP Connector interface
 *
 * Extends the core Connector interface with IMAP-specific capabilities.
 * The connector is responsible for:
 * - Establishing and managing IMAP connections
 * - Translating RequestContext to IMAP operations
 * - Returning standardized Response objects
 */
export interface IMAPConnector extends Connector<IMAPSession> {
  /**
   * Connect to an IMAP server
   * @param uri - IMAP URI (e.g., 'imap://user:pass@host:port' or 'imaps://...')
   * @returns IMAP session
   */
  connect(uri: string): Promise<IMAPSession>;

  /**
   * Execute an IMAP request
   * @param session - Active IMAP session
   * @param ctx - Request context with IMAP operation
   * @returns Response with operation result
   */
  request(session: IMAPSession, ctx: RequestContext): Promise<Response>;

  /**
   * Disconnect from IMAP server
   * @param session - Active IMAP session
   */
  disconnect(session: IMAPSession): Promise<void> | void;

  /**
   * Connector capabilities
   */
  readonly capabilities: IMAPCapabilities;
}

/**
 * IMAP message envelope (simplified)
 */
export interface IMAPEnvelope {
  /** Message date */
  readonly date?: Date;
  /** Subject line */
  readonly subject?: string;
  /** From addresses */
  readonly from?: IMAPAddress[];
  /** Sender addresses */
  readonly sender?: IMAPAddress[];
  /** Reply-To addresses */
  readonly replyTo?: IMAPAddress[];
  /** To addresses */
  readonly to?: IMAPAddress[];
  /** CC addresses */
  readonly cc?: IMAPAddress[];
  /** BCC addresses */
  readonly bcc?: IMAPAddress[];
  /** In-Reply-To header */
  readonly inReplyTo?: string;
  /** Message-ID header */
  readonly messageId?: string;
}

/**
 * IMAP address
 */
export interface IMAPAddress {
  /** Display name */
  readonly name?: string;
  /** Email address */
  readonly address?: string;
}

/**
 * IMAP message (simplified)
 */
export interface IMAPMessage {
  /** Sequence number */
  readonly seq: number;
  /** UID */
  readonly uid: number;
  /** Message envelope */
  readonly envelope?: IMAPEnvelope;
  /** Message flags */
  readonly flags?: Set<string>;
  /** Message size in bytes */
  readonly size?: number;
}
