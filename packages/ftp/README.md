# @unireq/ftp

[![npm version](https://img.shields.io/npm/v/@unireq/ftp.svg)](https://www.npmjs.com/package/@unireq/ftp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

FTP/FTPS transport with a pluggable connector architecture. Ships with a default connector powered by `basic-ftp`, but you can bring your own implementation (BYOC).

## Installation

```bash
pnpm add @unireq/ftp

# For the default connector (optional peer dependency)
pnpm add basic-ftp
```

## Quick Start

```typescript
import { client } from '@unireq/core';
import { ftp, ftpOperation } from '@unireq/ftp';

const { transport } = ftp('ftp://user:pass@ftp.example.com');
const ftpClient = client(transport);

// List directory
const listing = await ftpClient.get('/public', ftpOperation('list'));

// Download file
const data = await ftpClient.get('/reports/today.csv', ftpOperation('get'));

// Upload file
await ftpClient.put('/uploads/report.json', { data: 'content' }, ftpOperation('put'));
```

## Features

| Category | Symbols | Purpose |
| --- | --- | --- |
| Transport | `ftp(uri?, connector?)` | FTP/FTPS transport factory |
| Default connector | `BasicFtpConnector` | Implementation using `basic-ftp` |
| Policy | `ftpOperation(op, extras?)` | Inject operation type into context |
| Types | `FTPConnector`, `FTPSession`, `FTPFileEntry` | Connector interface and types |

## Supported Operations

| Operation | Policy | Returns |
| --- | --- | --- |
| `list` | `ftpOperation('list')` | `FTPFileEntry[]` |
| `get` | `ftpOperation('get')` | `Buffer` |
| `put` | `ftpOperation('put')` | `{ uploaded: boolean }` |
| `delete` | `ftpOperation('delete')` | `{ deleted: boolean }` |
| `rename` | `ftpOperation('rename', { destination })` | `{ renamed: boolean }` |
| `mkdir` | `ftpOperation('mkdir')` | `{ created: boolean }` |
| `rmdir` | `ftpOperation('rmdir')` | `{ removed: boolean }` |

## Bring Your Own Connector

```typescript
import type { FTPConnector, FTPSession } from '@unireq/ftp';

class MyFtpConnector implements FTPConnector {
  readonly capabilities = { ftp: true, ftps: true, delete: true, rename: true, mkdir: true, rmdir: true };

  async connect(uri: string): Promise<FTPSession> { /* ... */ }
  async request(session, context) { /* ... */ }
  disconnect() { /* ... */ }
}

const { transport } = ftp('ftp://server.com', new MyFtpConnector());
```

## Error Handling

```typescript
import { client, retry, backoff } from '@unireq/core';
import { ftp } from '@unireq/ftp';

const resilientFtp = client(
  ftp('ftp://ftp.example.com').transport,
  retry((_, err) => err !== null, [backoff({ jitter: true })], { tries: 3 }),
);
```

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
