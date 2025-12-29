# Connecteurs Personnalisés (BYOC)

Le pattern **Bring Your Own Connector** (BYOC) d'Unireq vous permet d'échanger l'implémentation du protocole sous-jacent tout en préservant l'API client unifiée. Ce guide couvre quand et comment implémenter des connecteurs personnalisés pour les transports HTTP, FTP et IMAP.

## Pourquoi BYOC ?

| Cas d'usage | Bénéfice |
| --- | --- |
| **Tests** | Connecteurs mock pour les tests unitaires sans vrais serveurs |
| **Enterprise** | Intégration avec des bibliothèques internes qui gèrent auth/métriques/logging |
| **Cas particuliers** | Support de comportements serveur non-standard ou protocoles legacy |
| **Tree-shaking** | Éviter de bundler `undici`, `basic-ftp`, ou `imapflow` quand non utilisés |
| **Bibliothèques alternatives** | Préférer `node-fetch`, `got`, ou toute autre bibliothèque HTTP |

## Interface Connector de base

Tous les connecteurs implémentent la même interface de base de `@unireq/core`:

```typescript
interface Connector<TSession> {
  /** Établir la connexion et retourner la session */
  connect(uri: string): Promise<TSession>;

  /** Exécuter la requête en utilisant la session */
  request(session: TSession, context: RequestContext): Promise<Response>;

  /** Libérer les ressources */
  disconnect(session: TSession): Promise<void> | void;

  /** Métadonnées de capacités */
  readonly capabilities: TransportCapabilities;
}
```

Chaque protocole étend cette interface avec des types de session et capacités spécifiques.

## Connecteur HTTP

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

### Exemple d'implémentation

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
    // Pas de nettoyage nécessaire pour fetch
  }
}

// Utilisation
import { http } from '@unireq/http';
import { client } from '@unireq/core';

const { transport } = http('https://api.example.com', new NodeFetchConnector());
const api = client(transport);
```

### Tests avec Mock Connector

```typescript
class MockHTTPConnector implements HTTPConnector {
  readonly capabilities = { http: true, https: true, http2: false, streaming: false };

  private responses = new Map<string, Response>();

  // Configurer les réponses mock
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

// Dans les tests
const mock = new MockHTTPConnector()
  .onGet('/users', { status: 200, statusText: 'OK', headers: {}, data: [{ id: 1 }], ok: true })
  .onPost('/users', { status: 201, statusText: 'Created', headers: {}, data: { id: 2 }, ok: true });

const { transport } = http('https://api.test', mock);
const api = client(transport);

const users = await api.get('/users'); // Retourne les données mock
```

## Connecteur FTP

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

### Exemple d'implémentation

```typescript
import type { FTPConnector, FTPSession, FTPCapabilities } from '@unireq/ftp';
import type { RequestContext, Response } from '@unireq/core';
import { Client } from 'ssh2-sftp-client'; // Alternative à basic-ftp

class SFTPConnector implements FTPConnector {
  private client = new Client();

  readonly capabilities: FTPCapabilities = {
    ftp: false, // SFTP uniquement
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

        // ... gérer les autres opérations

        default:
          return this.error(`Opération non supportée: ${operation}`);
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

// Utilisation
import { ftp, ftpOperation } from '@unireq/ftp';
import { client } from '@unireq/core';

const { transport } = ftp('sftp://user:pass@server.com', new SFTPConnector());
const api = client(transport);

const files = await api.get('/uploads', ftpOperation('list'));
```

## Connecteur IMAP

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

## Bonnes pratiques

### 1. Gérer l'état de connexion

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
      // Reconnexion sur erreurs de connexion
      if (this.isConnectionError(error)) {
        this.session = null;
        throw error; // Laisser la policy retry gérer
      }
      throw error;
    }
  }
}
```

### 2. Déclarer des capacités précises

```typescript
readonly capabilities = {
  http: true,
  https: true,
  http2: false, // Être honnête sur ce qui n'est pas supporté
  streaming: this.supportsStreaming(), // Vérification dynamique
};
```

### 3. Normaliser le format de réponse

```typescript
// Toujours retourner le format Response, même pour les erreurs
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
    // ... implémentation
  } catch (error) {
    return this.errorResponse(error as Error);
  }
}
```

### 4. Libérer les ressources

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
    // Annuler toutes les requêtes en cours
    for (const controller of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }
}
```

## Assembler le tout

### Pattern Transport Factory

Toutes les factory de transport suivent la même signature:

```typescript
// HTTP
const { transport, capabilities } = http(baseUrl?, connector?);

// FTP
const { transport, capabilities } = ftp(uri?, connector?);

// IMAP
const { transport, capabilities } = imap(uri?, connector?);
```

### Avec Presets

```typescript
import { preset } from '@unireq/presets';

// HTTP avec connecteur personnalisé
const api = preset.http
  .uri('https://api.example.com')
  .connector(new MyHTTPConnector())
  .retry
  .logging
  .build();

// FTP avec connecteur personnalisé
const ftp = preset.ftp
  .uri('ftp://server.com')
  .connector(new MySFTPConnector())
  .retry
  .build();

// IMAP avec connecteur personnalisé
const mail = preset.imap
  .uri('imap://mail.server.com')
  .connector(new MyIMAPConnector())
  .auth({ tokenSupplier: () => token })
  .build();
```

### Composition avec Policies

Les connecteurs personnalisés fonctionnent parfaitement avec toutes les policies unireq:

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

## Support TypeScript

Toutes les interfaces de connecteur sont entièrement typées. Exportez les types pour vos connecteurs personnalisés:

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

// Exporter pour les consommateurs
export type { HTTPConnector, HTTPSession, HTTPCapabilities };
```

---

<p align="center">
  <a href="#/fr/guides/testing">&larr; Tests avec MSW</a> &middot; <a href="#/fr/guides/performance">Optimisation Performance &rarr;</a>
</p>
