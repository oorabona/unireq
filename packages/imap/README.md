# @unireq/imap

[![npm version](https://img.shields.io/npm/v/@unireq/imap.svg)](https://www.npmjs.com/package/@unireq/imap)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

IMAP transport with a pluggable connector architecture. Ships with a default connector powered by `imapflow`, but you can bring your own implementation (BYOC).

## Installation

```bash
pnpm add @unireq/imap

# For the default connector (optional peer dependency)
pnpm add imapflow
```

## Quick Start

```typescript
import { client } from '@unireq/core';
import { imap, imapOperation } from '@unireq/imap';

const { transport } = imap('imap://user:pass@imap.gmail.com');
const mail = client(transport);

// Fetch messages from INBOX
const messages = await mail.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));

// Search for unread messages
const ids = await mail.get('/', imapOperation('search', {
  mailbox: 'INBOX',
  criteria: { seen: false },
}));
```

## Features

| Category | Symbols | Purpose |
| --- | --- | --- |
| Transport | `imap(uri?, connector?)` | IMAP/IMAPS transport factory |
| Default connector | `ImapFlowConnector` | Implementation using `imapflow` |
| Policy | `imapOperation(op, options?)` | Inject operation into context |
| Auth | `xoauth2({ tokenSupplier })` | OAuth2 authentication policy |
| Types | `IMAPMessage`, `SearchCriteria` | Message and search structures |

## Supported Operations

| Operation | Policy | Description |
| --- | --- | --- |
| `fetch` | `imapOperation('fetch', { mailbox })` | Fetch messages |
| `search` | `imapOperation('search', { mailbox, criteria })` | Search messages |
| `append` | `imapOperation('append', { mailbox? })` | Append message |
| `move` | `imapOperation('move', { mailbox, destination })` | Move messages |
| `addFlags` | `imapOperation('addFlags', { mailbox, flags })` | Add flags |
| `removeFlags` | `imapOperation('removeFlags', { mailbox, flags })` | Remove flags |
| `expunge` | `imapOperation('expunge', { mailbox })` | Expunge deleted |

## Search Criteria

```typescript
const criteria = {
  seen: false,
  from: 'boss@work.com',
  since: new Date('2025-01-01'),
  or: [{ from: 'alice@example.com' }, { from: 'bob@example.com' }],
};

const uids = await mail.get('/', imapOperation('search', {
  mailbox: 'INBOX',
  criteria,
}));
```

## XOAUTH2 Integration

```typescript
import { imap, xoauth2 } from '@unireq/imap';
import { client, compose } from '@unireq/core';

const { transport } = imap('imap://user@gmail.com@imap.gmail.com');

const gmail = client(
  compose(transport, xoauth2({ tokenSupplier: () => oauthClient.getAccessToken() })),
);
```

## Bring Your Own Connector

```typescript
import type { IMAPConnector, IMAPSession } from '@unireq/imap';

class MyImapConnector implements IMAPConnector {
  readonly capabilities = { imap: true, xoauth2: true, idle: true, append: true, search: true, move: true, flags: true, expunge: true };

  async connect(uri: string): Promise<IMAPSession> { /* ... */ }
  async request(session, context) { /* ... */ }
  async disconnect(session) { /* ... */ }
}

const { transport } = imap('imap://server.com', new MyImapConnector());
```

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
