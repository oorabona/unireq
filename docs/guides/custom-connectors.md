# Custom Connectors (BYOC)

Unireq's **Bring Your Own Connector** (BYOC) pattern lets you swap the underlying protocol implementation while preserving the unified client API. This guide covers when and how to implement custom connectors for HTTP, FTP, and IMAP transports.

## Why BYOC?

| Use Case | Benefit |
| --- | --- |
| **Testing** | Mock connectors for unit tests without real servers |
| **Enterprise** | Integrate with internal libraries that handle auth/metrics/logging |
| **Edge cases** | Support non-standard server behaviors or legacy protocols |
| **Tree-shaking** | Avoid bundling `undici`, `basic-ftp`, or `imapflow` when unused |
| **Alternative libraries** | Prefer `node-fetch`, `got`, or any HTTP library of your choice |

## Core Connector Interface

All connectors implement the same base interface from `@unireq/core`:

```typescript
interface Connector<TSession> {
  /** Establish connection and return session */
  connect(uri: string): Promise<TSession>;

  /** Execute request using the session */
  request(session: TSession, context: RequestContext): Promise<Response>;

  /** Clean up resources */
  disconnect(session: TSession): Promise<void> | void;

  /** Capabilities metadata */
  readonly capabilities: TransportCapabilities;
}
```

Each protocol extends this interface with protocol-specific session types and capabilities.

## HTTP Connector

### Interface

```typescript
import type { Connector, RequestContext, Response } from '@unireq/core';

interface HTTPSession {
  baseUrl: string;
  connected: boolean;
}

interface HTTPCapabilities {
  readonly http: boolean;
  readonly https: boolean;
  readonly http2: boolean;
  readonly streaming: boolean;
}

interface HTTPConnector extends Connector<HTTPSession> {
  connect(uri: string): Promise<HTTPSession>;
  request(session: HTTPSession, context: RequestContext): Promise<Response>;
  disconnect(session: HTTPSession): Promise<void> | void;
  readonly capabilities: HTTPCapabilities;
}
```

### Implementation Example

```typescript
import type { HTTPConnector, HTTPSession, HTTPCapabilities } from '@unireq/http';
import type { RequestContext, Response } from '@unireq/core';

class NodeFetchConnector implements HTTPConnector {
  readonly capabilities: HTTPCapabilities = {
    http: true,
    https: true,
    http2: false,
    streaming: true,
  };

  async connect(uri: string): Promise<HTTPSession> {
    // Validate and normalize the base URL
    const url = new URL(uri);
    return {
      baseUrl: `${url.protocol}//${url.host}`,
      connected: true,
    };
  }

  async request(session: HTTPSession, ctx: RequestContext): Promise<Response> {
    const url = ctx.url.startsWith('http')
      ? ctx.url
      : `${session.baseUrl}${ctx.url}`;

    const response = await fetch(url, {
      method: ctx.method,
      headers: ctx.headers as HeadersInit,
      body: ctx.body ? JSON.stringify(ctx.body) : undefined,
    });

    const data = await response.json().catch(() => response.text());

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      data,
      ok: response.ok,
    };
  }

  disconnect(): void {
    // No cleanup needed for fetch
  }
}

// Usage
import { http } from '@unireq/http';
import { client } from '@unireq/core';

const { transport } = http('https://api.example.com', new NodeFetchConnector());
const api = client(transport);
```

### Testing with Mock Connector

```typescript
class MockHTTPConnector implements HTTPConnector {
  readonly capabilities = { http: true, https: true, http2: false, streaming: false };

  private responses = new Map<string, Response>();

  // Configure mock responses
  onGet(path: string, response: Response) {
    this.responses.set(`GET:${path}`, response);
    return this;
  }

  onPost(path: string, response: Response) {
    this.responses.set(`POST:${path}`, response);
    return this;
  }

  async connect(uri: string) {
    return { baseUrl: uri, connected: true };
  }

  async request(_session: HTTPSession, ctx: RequestContext): Promise<Response> {
    const key = `${ctx.method}:${ctx.url}`;
    const response = this.responses.get(key);

    if (!response) {
      return { status: 404, statusText: 'Not Found', headers: {}, data: null, ok: false };
    }

    return response;
  }

  disconnect() {}
}

// In tests
const mock = new MockHTTPConnector()
  .onGet('/users', { status: 200, statusText: 'OK', headers: {}, data: [{ id: 1 }], ok: true })
  .onPost('/users', { status: 201, statusText: 'Created', headers: {}, data: { id: 2 }, ok: true });

const { transport } = http('https://api.test', mock);
const api = client(transport);

const users = await api.get('/users'); // Returns mock data
```

## FTP Connector

### Interface

```typescript
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

interface FTPConnector extends Connector<FTPSession> {
  connect(uri: string): Promise<FTPSession>;
  request(session: FTPSession, context: RequestContext): Promise<Response>;
  disconnect(session: FTPSession): Promise<void> | void;
  readonly capabilities: FTPCapabilities;
}
```

### Implementation Example

```typescript
import type { FTPConnector, FTPSession, FTPCapabilities } from '@unireq/ftp';
import type { RequestContext, Response } from '@unireq/core';
import { Client } from 'ssh2-sftp-client'; // Alternative to basic-ftp

class SFTPConnector implements FTPConnector {
  private client = new Client();

  readonly capabilities: FTPCapabilities = {
    ftp: false, // SFTP only
    ftps: true,
    delete: true,
    rename: true,
    mkdir: true,
    rmdir: true,
  };

  async connect(uri: string): Promise<FTPSession> {
    const url = new URL(uri);

    await this.client.connect({
      host: url.hostname,
      port: Number(url.port) || 22,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    });

    return {
      connected: true,
      host: url.hostname,
      user: url.username,
      secure: true,
    };
  }

  async request(_session: FTPSession, ctx: RequestContext): Promise<Response> {
    const operation = ctx['operation'] as string;
    const path = ctx.url;

    try {
      switch (operation) {
        case 'list':
          const files = await this.client.list(path);
          return this.success(files.map(f => ({
            name: f.name,
            type: f.type === 'd' ? 1 : 0,
            size: f.size,
          })));

        case 'get':
          const content = await this.client.get(path);
          return this.success(content);

        case 'put':
          await this.client.put(Buffer.from(ctx.body as string), path);
          return this.success({ uploaded: true });

        case 'delete':
          await this.client.delete(path);
          return this.success({ deleted: true, path });

        case 'mkdir':
          await this.client.mkdir(path, true);
          return this.success({ created: true, path });

        case 'rmdir':
          await this.client.rmdir(path);
          return this.success({ removed: true, path });

        case 'rename':
          const destination = ctx['destination'] as string;
          await this.client.rename(path, destination);
          return this.success({ renamed: true, from: path, to: destination });

        default:
          return this.error(`Unsupported operation: ${operation}`);
      }
    } catch (err) {
      return this.error((err as Error).message);
    }
  }

  disconnect(): void {
    this.client.end();
  }

  private success<T>(data: T): Response {
    return { status: 200, statusText: 'OK', headers: {}, data, ok: true };
  }

  private error(message: string): Response {
    return { status: 500, statusText: 'Error', headers: {}, data: { error: message }, ok: false };
  }
}

// Usage
import { ftp, ftpOperation } from '@unireq/ftp';
import { client } from '@unireq/core';

const { transport } = ftp('sftp://user:pass@server.com', new SFTPConnector());
const api = client(transport);

const files = await api.get('/uploads', ftpOperation('list'));
```

## IMAP Connector

### Interface

```typescript
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

interface IMAPConnector extends Connector<IMAPSession> {
  connect(uri: string): Promise<IMAPSession>;
  request(session: IMAPSession, context: RequestContext): Promise<Response>;
  disconnect(session: IMAPSession): Promise<void> | void;
  readonly capabilities: IMAPCapabilities;
}
```

### Implementation Example

```typescript
import type { IMAPConnector, IMAPSession, IMAPCapabilities } from '@unireq/imap';
import type { RequestContext, Response } from '@unireq/core';
import Imap from 'node-imap'; // Alternative to imapflow

class NodeImapConnector implements IMAPConnector {
  private client: Imap | null = null;

  readonly capabilities: IMAPCapabilities = {
    imap: true,
    xoauth2: false, // node-imap doesn't support XOAUTH2 natively
    idle: true,
    append: true,
    search: true,
    move: false, // MOVE extension not supported
    flags: true,
    expunge: true,
  };

  async connect(uri: string): Promise<IMAPSession> {
    const url = new URL(uri);

    return new Promise((resolve, reject) => {
      this.client = new Imap({
        host: url.hostname,
        port: Number(url.port) || 993,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        tls: url.protocol === 'imaps:',
      });

      this.client.once('ready', () => {
        resolve({
          connected: true,
          host: url.hostname,
          user: url.username,
          usable: true,
          secure: url.protocol === 'imaps:',
        });
      });

      this.client.once('error', reject);
      this.client.connect();
    });
  }

  async request(_session: IMAPSession, ctx: RequestContext): Promise<Response> {
    const operation = ctx['operation'] as string;
    const mailbox = ctx['mailbox'] as string;

    switch (operation) {
      case 'fetch':
        return this.fetchMessages(mailbox, ctx['range'] as string);
      case 'search':
        return this.searchMessages(mailbox, ctx['criteria']);
      // ... implement other operations
      default:
        return { status: 400, statusText: 'Bad Request', headers: {},
                 data: { error: `Unsupported: ${operation}` }, ok: false };
    }
  }

  private async fetchMessages(mailbox: string, range: string): Promise<Response> {
    // Implementation using node-imap API
    // ...
    return { status: 200, statusText: 'OK', headers: {}, data: [], ok: true };
  }

  private async searchMessages(mailbox: string, criteria: unknown): Promise<Response> {
    // Implementation using node-imap API
    // ...
    return { status: 200, statusText: 'OK', headers: {}, data: [], ok: true };
  }

  disconnect(): void {
    this.client?.end();
    this.client = null;
  }
}
```

## Best Practices

### 1. Handle Connection State

```typescript
class ResilientConnector implements HTTPConnector {
  private session: HTTPSession | null = null;

  async ensureConnected(uri: string): Promise<HTTPSession> {
    if (this.session?.connected) {
      return this.session;
    }
    this.session = await this.connect(uri);
    return this.session;
  }

  async request(session: HTTPSession, ctx: RequestContext): Promise<Response> {
    try {
      return await this.doRequest(session, ctx);
    } catch (error) {
      // Reconnect on connection errors
      if (this.isConnectionError(error)) {
        this.session = null;
        throw error; // Let retry policy handle it
      }
      throw error;
    }
  }
}
```

### 2. Declare Accurate Capabilities

```typescript
readonly capabilities = {
  http: true,
  https: true,
  http2: false, // Be honest about what you don't support
  streaming: this.supportsStreaming(), // Dynamic capability check
};
```

### 3. Normalize Response Format

```typescript
// Always return Response shape, even for errors
private errorResponse(error: Error): Response {
  return {
    status: 500,
    statusText: 'Internal Error',
    headers: {},
    data: { error: error.message, stack: error.stack },
    ok: false,
  };
}

async request(session: Session, ctx: RequestContext): Promise<Response> {
  try {
    // ... implementation
  } catch (error) {
    return this.errorResponse(error as Error);
  }
}
```

### 4. Clean Up Resources

```typescript
class ResourceAwareConnector implements HTTPConnector {
  private activeRequests = new Set<AbortController>();

  async request(session: HTTPSession, ctx: RequestContext): Promise<Response> {
    const controller = new AbortController();
    this.activeRequests.add(controller);

    try {
      return await fetch(ctx.url, { signal: controller.signal });
    } finally {
      this.activeRequests.delete(controller);
    }
  }

  disconnect(): void {
    // Cancel all pending requests
    for (const controller of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }
}
```

## Wiring It All Together

### Transport Factory Pattern

All transport factories follow the same signature:

```typescript
// HTTP
const { transport, capabilities } = http(baseUrl?, connector?);

// FTP
const { transport, capabilities } = ftp(uri?, connector?);

// IMAP
const { transport, capabilities } = imap(uri?, connector?);
```

### With Presets

```typescript
import { preset } from '@unireq/presets';

// HTTP with custom connector
const api = preset.http
  .uri('https://api.example.com')
  .connector(new MyHTTPConnector())
  .retry
  .logging
  .build();

// FTP with custom connector
const ftp = preset.ftp
  .uri('ftp://server.com')
  .connector(new MySFTPConnector())
  .retry
  .build();

// IMAP with custom connector
const mail = preset.imap
  .uri('imap://mail.server.com')
  .connector(new MyIMAPConnector())
  .auth({ tokenSupplier: () => token })
  .build();
```

### Composing with Policies

Custom connectors work seamlessly with all unireq policies:

```typescript
import { client, retry, backoff, log, circuitBreaker } from '@unireq/core';
import { http } from '@unireq/http';

const { transport } = http('https://api.example.com', new MyConnector());

const api = client(
  transport,
  retry(shouldRetry, [backoff({ initial: 1000 })], { tries: 3 }),
  circuitBreaker({ threshold: 5, resetAfter: 30000 }),
  log({ level: 'debug' }),
);
```

## TypeScript Support

All connector interfaces are fully typed. Export types for your custom connectors:

```typescript
// my-connector.ts
import type { HTTPConnector, HTTPSession, HTTPCapabilities } from '@unireq/http';

export interface MyConnectorOptions {
  timeout?: number;
  retries?: number;
}

export class MyConnector implements HTTPConnector {
  constructor(private options: MyConnectorOptions = {}) {}
  // ...
}

// Export for consumers
export type { HTTPConnector, HTTPSession, HTTPCapabilities };
```

---

<p align="center">
  <a href="#/guides/testing">&larr; Testing with MSW</a> &middot; <a href="#/guides/performance">Performance Tuning &rarr;</a>
</p>
