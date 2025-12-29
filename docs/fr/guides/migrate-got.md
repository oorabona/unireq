# Migrer depuis got

Ce guide vous aide à migrer de got vers @unireq. Les deux bibliothèques partagent des philosophies similaires autour de l'extensibilité, rendant la migration simple.

## Référence Rapide

| got | @unireq |
|-----|---------|
| `got.extend({ prefixUrl })` | `client(http(prefixUrl))` |
| `got.get(url)` | `api.get(url)` |
| `got.post(url, { json })` | `api.post(url, body)` |
| `response.body` | `response.data` |
| `hooks.beforeRequest` | `interceptRequest()` |
| `hooks.afterResponse` | `interceptResponse()` |
| `retry: { limit: 3 }` | `retry(..., { tries: 3 })` |
| `timeout: { request: 5000 }` | `timeout(5000)` |

## Migration de Base

### got

```typescript
import got from 'got';

const api = got.extend({
  prefixUrl: 'https://api.example.com',
  timeout: { request: 5000 },
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  responseType: 'json',
});

const response = await api.get('users');
console.log(response.body);
```

### @unireq - Équivalent direct

```typescript
import { client } from '@unireq/core';
import { http, parse, timeout, headers } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timeout(5000),
  headers({ 'Authorization': `Bearer ${token}` }),
  parse.json()
);

const response = await api.get('/users');
console.log(response.data);
```

### @unireq - Avec Preset Builder ✨

```typescript
import { preset } from '@unireq/presets';

const api = preset.http
  .uri('https://api.example.com')
  .json
  .timeout
  .withHeaders({ 'Authorization': `Bearer ${token}` })
  .build();

const response = await api.get('/users');
console.log(response.data);
```

> 💡 **Pourquoi utiliser les presets ?** Moins de boilerplate, valeurs par défaut sensées, API fluent.

## Des Hooks aux Policies

### got hooks

```typescript
const api = got.extend({
  hooks: {
    beforeRequest: [
      (options) => {
        options.headers.Authorization = `Bearer ${getToken()}`;
      },
    ],
    afterResponse: [
      (response) => {
        console.log(`Response: ${response.statusCode}`);
        return response;
      },
    ],
    beforeRetry: [
      (error, retryCount) => {
        console.log(`Retrying... (${retryCount})`);
      },
    ],
  },
});
```

### @unireq - Équivalent direct

```typescript
import { client, log } from '@unireq/core';
import { http, interceptRequest, interceptResponse, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  interceptRequest((ctx) => ({
    ...ctx,
    headers: {
      ...ctx.headers,
      Authorization: `Bearer ${getToken()}`,
    },
  })),
  interceptResponse((response) => {
    console.log(`Response: ${response.status}`);
    return response;
  }),
  log({}), // Le logging intégré inclut les événements de retry
  parse.json()
);
```

### @unireq - Solution idiomatique ✨

Pour l'authentification Bearer avec refresh automatique, utilisez la policy dédiée :

```typescript
import { client, log } from '@unireq/core';
import { http, interceptResponse, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  oauthBearer({
    tokenSupplier: () => getToken(),
    onRefresh: async () => refreshToken(),
  }),
  interceptResponse((response) => {
    console.log(`Response: ${response.status}`);
    return response;
  }),
  log({}),
  parse.json()
);
```

> 💡 **Avantages de `oauthBearer()`** : Gestion automatique des 401, token provider async, retry automatique après refresh.

## Configuration du Retry

### got

```typescript
const api = got.extend({
  retry: {
    limit: 3,
    methods: ['GET', 'PUT', 'HEAD', 'DELETE', 'OPTIONS', 'TRACE'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
    maxRetryAfter: 60000,
  },
});
```

### @unireq

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({
      methods: ['GET', 'PUT', 'HEAD', 'DELETE', 'OPTIONS', 'TRACE'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
    }),
    [
      rateLimitDelay({ maxWait: 60000 }), // Respecte l'en-tête Retry-After
      backoff({ initial: 1000, max: 30000, jitter: true }),
    ],
    { tries: 3 }
  ),
  parse.json()
);
```

## Streaming

### got

```typescript
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

await pipeline(
  got.stream('https://example.com/file.zip'),
  createWriteStream('file.zip')
);
```

### @unireq

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { Writable } from 'node:stream';

const api = client(http('https://example.com'), parse.stream());

const response = await api.get('/file.zip');
const stream = response.data as ReadableStream<Uint8Array>;

const writer = Writable.toWeb(createWriteStream('file.zip'));
await stream.pipeTo(writer);
```

## Pagination

### got

```typescript
const api = got.extend({
  pagination: {
    paginate: (response) => {
      const nextPage = response.headers.link?.match(/<([^>]+)>; rel="next"/)?.[1];
      return nextPage ? { url: nextPage } : false;
    },
  },
});

for await (const user of api.paginate('users')) {
  console.log(user);
}
```

### @unireq

```typescript
// @unireq fournit les briques de base ; créez votre propre paginateur :
async function* paginate<T>(api: Client, path: string): AsyncGenerator<T> {
  let url: string | null = path;

  while (url) {
    const response = await api.get<T[]>(url);

    for (const item of response.data) {
      yield item;
    }

    // Parser l'en-tête Link pour la page suivante
    const linkHeader = response.headers.link;
    url = linkHeader?.match(/<([^>]+)>; rel="next"/)?.[1] ?? null;
  }
}

for await (const user of paginate(api, '/users')) {
  console.log(user);
}
```

## HTTP/2

### got

```typescript
import got from 'got';

const response = await got('https://http2.example.com', {
  http2: true,
});
```

### @unireq

```typescript
import { client } from '@unireq/core';
import { http2 } from '@unireq/http2';
import { parse } from '@unireq/http';

const api = client(http2('https://http2.example.com'), parse.json());
const response = await api.get('/');
```

## Comparaison des Fonctionnalités

| Fonctionnalité | got | @unireq |
|----------------|-----|---------|
| **HTTP/2** | ✅ | ✅ via @unireq/http2 |
| **Retry** | ✅ Intégré | ✅ Intégré |
| **Hooks** | ✅ | ✅ Policies |
| **Pagination** | ✅ Intégrée | Manuelle (plus flexible) |
| **Circuit Breaker** | ❌ | ✅ Intégré |
| **Throttle** | ❌ | ✅ Intégré |
| **OAuth** | ❌ | ✅ Intégré |
| **Validation** | ❌ | ✅ Zod/Valibot |
| **GraphQL** | ❌ | ✅ @unireq/graphql |
| **FTP/IMAP** | ❌ | ✅ Multi-protocole |

## Pourquoi Migrer ?

1. **Fonctionnalités enterprise** : Circuit breaker et throttle intégrés
2. **Support OAuth** : Validation JWT et refresh de token automatique
3. **Multi-protocole** : Même API pour HTTP, HTTP/2, FTP, IMAP
4. **Validation** : Intégration Zod/Valibot pour la validation des réponses
5. **GraphQL** : Support GraphQL de première classe
6. **Introspection** : Debugger n'importe quelle requête avec `inspect()`
