# @unireq/imap

IMAP transport with a pluggable connector architecture. Ships with a default connector powered by [`imapflow`](https://github.com/postalsys/imapflow), but you can bring your own implementation (BYOC).

## Installation

```bash
pnpm add @unireq/imap

# For the default connector (optional peer dependency)
pnpm add imapflow
```

## Export Overview

| Category | Symbols | Purpose |
| --- | --- | --- |
| Transport | `imap(uri?, connector?)` | Creates a `TransportWithCapabilities` that knows how to talk to IMAP servers. |
| Connector interface | `IMAPConnector`, `IMAPSession`, `IMAPCapabilities` | Types for implementing custom connectors. |
| Default connector | `ImapFlowConnector` | Default implementation using `imapflow` library. |
| Policy | `imapOperation(op, options?)` | Injects operation type and parameters into the request context. |
| Auth | `xoauth2({ tokenSupplier })` | OAuth2 authentication policy. |
| Types | `IMAPMessage`, `IMAPEnvelope`, `SearchCriteria` | Message and search structures. |

## Quick Start

```typescript
import { client } from '@unireq/core';
import { imap, imapOperation } from '@unireq/imap';

// Create transport (uses ImapFlowConnector by default)
const { transport, capabilities } = imap('imap://user:pass@imap.gmail.com');

// Create client
const mail = client(transport);

// Fetch messages from INBOX
const messages = await mail.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));

// Search for unread messages
const ids = await mail.get('/', imapOperation('search', {
  mailbox: 'INBOX',
  criteria: { seen: false }
}));

// Append a message to Drafts
await mail.post('/Drafts', draftContent, imapOperation('append'));
```

## Transport Factory

```typescript
import { imap, ImapFlowConnector } from '@unireq/imap';

// Option 1: Default connector (requires imapflow)
const { transport } = imap('imap://user:pass@imap.gmail.com');

// Option 2: Custom connector options
const connector = new ImapFlowConnector({ timeout: 30000 });
const { transport } = imap('imap://imap.gmail.com', connector);

// Option 3: Bring Your Own Connector (BYOC)
const { transport } = imap('imap://imap.gmail.com', myCustomConnector);
```

- Use `imap://` for plain connections and `imaps://` for TLS (ports 143 and 993 respectively).
- Credentials can be embedded in the URL; if omitted, authentication must be handled separately.
- The `capabilities` object indicates supported operations.

## Supported Operations

| Operation | Policy | Description |
| --- | --- | --- |
| `fetch` | `imapOperation('fetch', { mailbox, range? })` | Fetch messages from mailbox. Returns `IMAPMessage[]`. |
| `select` | `imapOperation('select', { mailbox })` | Select mailbox (useful for checking status). |
| `search` | `imapOperation('search', { mailbox, criteria })` | Search messages. Returns UIDs. |
| `append` | `imapOperation('append', { mailbox? })` | Append message to mailbox. Returns `{ uid }`. |
| `move` | `imapOperation('move', { mailbox, destination, range })` | Move messages between mailboxes. |
| `addFlags` | `imapOperation('addFlags', { mailbox, range, flags })` | Add flags to messages. |
| `removeFlags` | `imapOperation('removeFlags', { mailbox, range, flags })` | Remove flags from messages. |
| `expunge` | `imapOperation('expunge', { mailbox })` | Expunge deleted messages. |
| `idle` | `imapOperation('idle')` | Wait for server-side events. |

## Search Criteria

```typescript
import { imap, imapOperation } from '@unireq/imap';
import type { SearchCriteria } from '@unireq/imap';

const criteria: SearchCriteria = {
  seen: false,           // Unread messages
  from: 'boss@work.com', // From specific sender
  since: new Date('2025-01-01'), // After date
  larger: 1024 * 100,    // Larger than 100KB
};

// Combine with AND/OR
const complexCriteria: SearchCriteria = {
  or: [
    { from: 'alice@example.com' },
    { from: 'bob@example.com' },
  ],
  since: new Date('2025-01-01'),
};

const uids = await mail.get('/', imapOperation('search', {
  mailbox: 'INBOX',
  criteria: complexCriteria,
}));
```

## XOAUTH2 Integration

```typescript
import { imap, imapOperation, xoauth2 } from '@unireq/imap';
import { client, compose } from '@unireq/core';

const { transport } = imap('imap://user@gmail.com@imap.gmail.com');

// Add XOAUTH2 token to requests
const gmail = client(
  compose(
    transport,
    xoauth2({ tokenSupplier: () => oauthClient.getAccessToken() }),
  ),
);

await gmail.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));
```

`xoauth2` resolves your token (sync or async) just before the transport runs. Pair it with `@unireq/oauth` refresh policies for automatic rotation.

## Ergonomic Facade with Presets

For a higher-level API, use the facade from `@unireq/presets`:

```typescript
import { preset } from '@unireq/presets';

const mail = preset.imap
  .uri('imap://user:pass@imap.gmail.com')
  .auth({ tokenSupplier: () => getOAuthToken() })
  .retry
  .build();

// Domain-specific methods
const messages = await mail.fetch('INBOX', '1:*');
const uids = await mail.search('INBOX', { seen: false });
await mail.addFlags('INBOX', [1, 2, 3], ['\\Seen']);
await mail.removeFlags('INBOX', [1], ['\\Flagged']);
await mail.move('INBOX', 'Archive', [5, 6]);
await mail.expunge('INBOX');
const { uid } = await mail.append('Drafts', draftContent);

// Access raw client for advanced operations
const raw = mail.raw;
```

## Bring Your Own Connector (BYOC)

When the default `imapflow` connector doesn't meet your needs, implement `IMAPConnector`:

```typescript
import type { IMAPConnector, IMAPSession, IMAPCapabilities } from '@unireq/imap';
import type { RequestContext, Response } from '@unireq/core';

class MyImapConnector implements IMAPConnector {
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

  async connect(uri: string): Promise<IMAPSession> {
    const url = new URL(uri);
    const session = await myImapLibrary.connect({
      host: url.hostname,
      port: Number(url.port) || 993,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      secure: url.protocol === 'imaps:',
    });

    return {
      connected: true,
      host: url.hostname,
      user: url.username,
      usable: true,
      secure: url.protocol === 'imaps:',
    };
  }

  async request(session: IMAPSession, context: RequestContext): Promise<Response> {
    const operation = context['operation'] as string;
    const mailbox = context['mailbox'] as string;

    switch (operation) {
      case 'fetch':
        const range = context['range'] || '1:*';
        const messages = await myImapLibrary.fetch(mailbox, range);
        return { status: 200, statusText: 'OK', headers: {}, data: messages, ok: true };

      case 'search':
        const criteria = context['criteria'];
        const uids = await myImapLibrary.search(mailbox, criteria);
        return { status: 200, statusText: 'OK', headers: {}, data: uids, ok: true };

      case 'append':
        const result = await myImapLibrary.append(mailbox, context.body);
        return { status: 200, statusText: 'OK', headers: {}, data: result, ok: true };

      // ... handle other operations

      default:
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          data: { error: `Unsupported operation: ${operation}` },
          ok: false,
        };
    }
  }

  async disconnect(session: IMAPSession): Promise<void> {
    await myImapLibrary.close();
  }
}

// Use your connector
const { transport } = imap('imap://server.com', new MyImapConnector());
```

### IMAPConnector Interface

```typescript
interface IMAPConnector {
  /** Supported capabilities */
  readonly capabilities: IMAPCapabilities;

  /** Establish connection and return session */
  connect(uri: string): Promise<IMAPSession>;

  /** Execute IMAP operation */
  request(session: IMAPSession, context: RequestContext): Promise<Response>;

  /** Clean up resources */
  disconnect(session: IMAPSession): Promise<void> | void;
}

interface IMAPSession {
  connected: boolean;
  host: string;
  user: string;
  usable: boolean;
  secure: boolean;
}

interface IMAPCapabilities {
  readonly imap: boolean;
  readonly xoauth2: boolean;
  readonly idle: boolean;
  readonly append: boolean;
  readonly search: boolean;
  readonly move: boolean;
  readonly flags: boolean;
  readonly expunge: boolean;
}
```

### Why BYOC?

- **Testing**: Use mock connectors for unit tests without real IMAP servers
- **Enterprise**: Integrate with internal mail libraries that handle auth/logging
- **Edge cases**: Support non-standard IMAP server behaviors
- **Tree-shaking**: Avoid bundling `imapflow` if you use a custom connector

## Connection Lifecycle

- The transport lazily connects on the first request and reuses the session
- Connections are cached per `host:port:user` triplet
- When the connection becomes unusable (network hiccup), the transport attempts reconnection automatically
- Use `connector.disconnect()` in shutdown hooks

## Error Handling & Retries

```typescript
import { client, retry, backoff } from '@unireq/core';
import { imap, imapOperation } from '@unireq/imap';

const retryPredicate = (_result: Response | null, error: Error | null) => error !== null;

const resilientMail = client(
  imap('imap://imap.gmail.com').transport,
  retry(retryPredicate, [backoff({ initial: 1000, max: 10000, jitter: true })], { tries: 3 }),
);
```

- Network/auth errors return `{ ok: false, status: 500, data: { error: message } }`
- Compose with `retry`, circuit breakers, or `either` from `@unireq/core`
- Be mindful of Gmail's `APPENDLIMIT`/`RATE` errors—inspect `data.error` and add `backoff`

---

<p align="center">
  <a href="#/packages/graphql">&larr; GraphQL</a> &middot; <a href="#/packages/ftp">FTP &rarr;</a>
</p>
