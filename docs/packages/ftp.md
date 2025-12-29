# @unireq/ftp

FTP/FTPS transport with a pluggable connector architecture. Ships with a default connector powered by [`basic-ftp`](https://github.com/patrickjuchli/basic-ftp), but you can bring your own implementation (BYOC).

## Installation

```bash
pnpm add @unireq/ftp

# For the default connector (optional peer dependency)
pnpm add basic-ftp
```

## Export Overview

| Category | Symbols | Purpose |
| --- | --- | --- |
| Transport | `ftp(uri?, connector?)` | Creates a `TransportWithCapabilities` that knows how to talk to FTP/FTPS servers. |
| Connector interface | `FTPConnector`, `FTPSession`, `FTPCapabilities` | Types for implementing custom connectors. |
| Default connector | `BasicFtpConnector` | Default implementation using `basic-ftp` library. |
| Policy | `ftpOperation(op, extras?)` | Injects operation type and parameters into the request context. |
| Types | `FTPFileEntry` | File listing entry structure. |

## Quick Start

```typescript
import { client } from '@unireq/core';
import { ftp, ftpOperation } from '@unireq/ftp';

// Create transport (uses BasicFtpConnector by default)
const { transport, capabilities } = ftp('ftp://user:pass@ftp.example.com');

// Create client
const ftpClient = client(transport);

// List directory
const listing = await ftpClient.get('/public', ftpOperation('list'));

// Download file
const data = await ftpClient.get('/reports/today.csv', ftpOperation('get'));

// Upload file
await ftpClient.put('/uploads/report.json', { data: 'content' }, ftpOperation('put'));
```

## Transport Factory

```typescript
import { ftp, BasicFtpConnector } from '@unireq/ftp';

// Option 1: Default connector (requires basic-ftp)
const { transport } = ftp('ftp://user:pass@ftp.example.com');

// Option 2: Custom connector options
const connector = new BasicFtpConnector({ timeout: 30000 });
const { transport } = ftp('ftp://ftp.example.com', connector);

// Option 3: Bring Your Own Connector (BYOC)
const { transport } = ftp('ftp://ftp.example.com', myCustomConnector);
```

- Use `ftp://` for plain connections and `ftps://` for TLS (ports 21 and 990 respectively).
- Credentials can be embedded in the URL; if omitted, `anonymous/anonymous` is used.
- The `capabilities` object indicates supported operations.

## Supported Operations

| Operation | Policy | Returned Data |
| --- | --- | --- |
| `list` | `ftpOperation('list')` | `FTPFileEntry[]` with `name`, `type`, `size` |
| `get` | `ftpOperation('get')` | `Buffer` with file contents |
| `put` | `ftpOperation('put')` | `{ uploaded: boolean }` |
| `delete` | `ftpOperation('delete')` | `{ deleted: boolean, path: string }` |
| `rename` | `ftpOperation('rename', { destination })` | `{ renamed: boolean, from, to }` |
| `mkdir` | `ftpOperation('mkdir')` | `{ created: boolean, path }` |
| `rmdir` | `ftpOperation('rmdir')` | `{ removed: boolean, path }` |

## Ergonomic Facade with Presets

For a higher-level API, use the facade from `@unireq/presets`:

```typescript
import { preset } from '@unireq/presets';

const ftp = preset.ftp
  .uri('ftp://user:pass@ftp.example.com')
  .retry
  .build();

// Domain-specific methods
const files = await ftp.list('/public');
const content = await ftp.download('/file.txt');
await ftp.upload('/new-file.txt', 'content');
await ftp.mkdir('/new-folder');
await ftp.rename('/old.txt', '/new.txt');
await ftp.delete('/temp.txt');
await ftp.rmdir('/empty-folder');

// Access raw client for advanced operations
const raw = ftp.raw;
```

## Bring Your Own Connector (BYOC)

When the default `basic-ftp` connector doesn't meet your needs, implement `FTPConnector`:

```typescript
import type { FTPConnector, FTPSession, FTPCapabilities } from '@unireq/ftp';
import type { RequestContext, Response } from '@unireq/core';

class MyFtpConnector implements FTPConnector {
  readonly capabilities: FTPCapabilities = {
    ftp: true,
    ftps: true,
    delete: true,
    rename: true,
    mkdir: true,
    rmdir: true,
  };

  async connect(uri: string): Promise<FTPSession> {
    // Parse URI, establish connection
    const url = new URL(uri);
    const session = await myFtpLibrary.connect({
      host: url.hostname,
      port: Number(url.port) || 21,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      secure: url.protocol === 'ftps:',
    });

    return {
      connected: true,
      host: url.hostname,
      user: url.username,
      secure: url.protocol === 'ftps:',
    };
  }

  async request(session: FTPSession, context: RequestContext): Promise<Response> {
    const operation = context['operation'] as string;

    switch (operation) {
      case 'list':
        const files = await myFtpLibrary.list(context.url);
        return { status: 200, statusText: 'OK', headers: {}, data: files, ok: true };

      case 'get':
        const buffer = await myFtpLibrary.download(context.url);
        return { status: 200, statusText: 'OK', headers: {}, data: buffer, ok: true };

      case 'put':
        await myFtpLibrary.upload(context.url, context.body);
        return { status: 200, statusText: 'OK', headers: {}, data: { uploaded: true }, ok: true };

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

  disconnect(): void {
    myFtpLibrary.close();
  }
}

// Use your connector
const { transport } = ftp('ftp://server.com', new MyFtpConnector());
```

### FTPConnector Interface

```typescript
interface FTPConnector {
  /** Supported capabilities */
  readonly capabilities: FTPCapabilities;

  /** Establish connection and return session */
  connect(uri: string): Promise<FTPSession>;

  /** Execute FTP operation */
  request(session: FTPSession, context: RequestContext): Promise<Response>;

  /** Clean up resources */
  disconnect(): void;
}

interface FTPSession {
  connected: boolean;
  host: string;
  user: string;
  secure: boolean;
}

interface FTPCapabilities {
  readonly ftp: boolean;
  readonly ftps: boolean;
  readonly delete: boolean;
  readonly rename: boolean;
  readonly mkdir: boolean;
  readonly rmdir: boolean;
}
```

### Why BYOC?

- **Testing**: Use mock connectors for unit tests without real FTP servers
- **Enterprise**: Integrate with internal FTP libraries that handle auth/logging
- **Edge cases**: Support non-standard FTP server behaviors
- **Tree-shaking**: Avoid bundling `basic-ftp` if you use a custom connector

## Connection Lifecycle

- The transport lazily connects on the first request and reuses the session
- Connections are cached per `host:port:user` triplet
- The transport never closes connections automatically; tie cleanup to your process lifecycle
- Use `connector.disconnect()` in shutdown hooks

## Error Handling & Retries

```typescript
import { client, retry, backoff } from '@unireq/core';
import { ftp, ftpOperation } from '@unireq/ftp';

const retryPredicate = (_result: Response | null, error: Error | null) => error !== null;

const resilientFtp = client(
  ftp('ftp://ftp.example.com').transport,
  retry(retryPredicate, [backoff({ initial: 1000, max: 10000, jitter: true })], { tries: 3 }),
);
```

- Network/auth errors return `{ ok: false, status: 500, data: { error: message } }`
- Compose with `retry`, circuit breakers, or `either` from `@unireq/core`

---

<p align="center">
  <a href="#/packages/imap">← IMAP</a> · <a href="#/packages/presets">Presets →</a>
</p>
