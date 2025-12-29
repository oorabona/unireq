# Migrer depuis ky

Ce guide vous aide à migrer de ky vers @unireq. Les deux bibliothèques partagent une approche moderne basée sur fetch avec des APIs fluent.

## Référence Rapide

| ky | @unireq |
|----|---------|
| `ky.create({ prefixUrl })` | `client(http(prefixUrl))` |
| `ky.get(url)` | `api.get(url)` |
| `ky.post(url, { json })` | `api.post(url, body)` |
| `response.json()` | `response.data` (auto-parsé) |
| `hooks.beforeRequest` | `interceptRequest()` |
| `hooks.afterResponse` | `interceptResponse()` |
| `retry: 3` | `retry(..., { tries: 3 })` |
| `timeout: 5000` | `timeout(5000)` |

## Migration de Base

### ky

```typescript
import ky from 'ky';

const api = ky.create({
  prefixUrl: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  retry: 3,
});

const response = await api.get('users').json();
console.log(response);
```

### @unireq - Équivalent direct

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, parse, timeout, headers, httpRetryPredicate } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timeout(5000),
  headers({ 'Authorization': `Bearer ${token}` }),
  retry(httpRetryPredicate(), [backoff()], { tries: 3 }),
  parse.json()
);

const response = await api.get('/users');
console.log(response.data); // Déjà parsé !
```

### @unireq - Avec Preset Builder ✨

```typescript
import { preset } from '@unireq/presets';

const api = preset.http
  .uri('https://api.example.com')
  .json
  .timeout
  .retry
  .withHeaders({ 'Authorization': `Bearer ${token}` })
  .build();

const response = await api.get('/users');
console.log(response.data);
```

> 💡 **Pourquoi utiliser les presets ?** Moins de boilerplate, valeurs par défaut sensées, API fluent.

## Des Hooks aux Policies

### ky hooks

```typescript
const api = ky.create({
  hooks: {
    beforeRequest: [
      (request) => {
        request.headers.set('Authorization', `Bearer ${getToken()}`);
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          const token = await refreshToken();
          request.headers.set('Authorization', `Bearer ${token}`);
          return ky(request);
        }
        return response;
      },
    ],
  },
});
```

### @unireq - Équivalent direct

```typescript
import { client } from '@unireq/core';
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
  interceptResponse(async (response, ctx) => {
    if (response.status === 401) {
      const token = await refreshToken();
      // Retry avec le nouveau token (implémentation manuelle)
      return fetch(ctx.url, {
        ...ctx,
        headers: { ...ctx.headers, Authorization: `Bearer ${token}` },
      });
    }
    return response;
  }),
  parse.json()
);
```

### @unireq - Solution idiomatique ✨

La policy `oauthBearer()` gère tout cela automatiquement :

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  oauthBearer({
    tokenSupplier: () => getToken(),
    onRefresh: async () => {
      const newToken = await refreshToken();
      return newToken;
    },
  }),
  parse.json()
);
```

> 💡 **Pourquoi utiliser `oauthBearer()` ?**
> - **Gestion automatique des 401** : Refresh et retry de manière transparente
> - **Pas de logique de retry manuelle** : La policy gère tout
> - **Validation JWT** : Validation optionnelle du token avant les requêtes

## Gestion des Erreurs

### ky

```typescript
import ky, { HTTPError } from 'ky';

try {
  await ky.get('https://api.example.com/users');
} catch (error) {
  if (error instanceof HTTPError) {
    console.log(error.response.status);
    const body = await error.response.json();
    console.log(body);
  }
}
```

### @unireq

```typescript
import { isHttpError, HttpError } from '@unireq/core';

try {
  await api.get('/users');
} catch (error) {
  if (isHttpError(error)) {
    console.log(error.response?.status);
    console.log(error.response?.data); // Déjà parsé
  }
}
```

## Paramètres de Recherche

### ky

```typescript
const response = await ky.get('users', {
  searchParams: {
    page: 1,
    limit: 10,
    filter: ['active', 'verified'],
  },
});
```

### @unireq

```typescript
import { query } from '@unireq/http';

const response = await api.get(
  '/users',
  query({
    page: '1',
    limit: '10',
    filter: ['active', 'verified'],
  })
);
```

## Corps JSON

### ky

```typescript
const response = await ky.post('users', {
  json: {
    name: 'John',
    email: 'john@example.com',
  },
});
```

### @unireq

```typescript
import { body } from '@unireq/http';

const response = await api.post(
  '/users',
  body.json({ name: 'John', email: 'john@example.com' })
);

// Ou passez simplement l'objet (auto-sérialisé avec parse.json())
const response = await api.post('/users', {
  name: 'John',
  email: 'john@example.com',
});
```

## Données de Formulaire

### ky

```typescript
const formData = new FormData();
formData.append('name', 'John');
formData.append('avatar', file);

await ky.post('users', { body: formData });
```

### @unireq

```typescript
import { body } from '@unireq/http';

await api.post(
  '/users',
  body.multipart(
    [{ name: 'avatar', data: file }],
    [{ name: 'name', value: 'John' }]
  )
);
```

## Options Étendues

### ky

```typescript
const api = ky.extend({
  prefixUrl: 'https://api.example.com',
  timeout: 10000,
  retry: {
    limit: 3,
    methods: ['get'],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
});
```

### @unireq (Preset Builder)

```typescript
import { preset } from '@unireq/presets';

const api = preset.api
  .json
  .withTimeout(10000)
  .withRetry({ tries: 3, methods: ['GET'] })
  .build('https://api.example.com');
```

## Comparaison des Fonctionnalités

| Fonctionnalité | ky | @unireq |
|----------------|-----|---------|
| **Taille du bundle** | ~2KB | ~8KB |
| **Support navigateur** | ✅ Excellent | ✅ Bon |
| **Node.js** | ✅ | ✅ |
| **Retry** | ✅ | ✅ + Rate-limit aware |
| **Timeout** | ✅ | ✅ + Timeouts par phase |
| **Hooks** | ✅ | ✅ Policies |
| **Circuit Breaker** | ❌ | ✅ Intégré |
| **Throttle** | ❌ | ✅ Intégré |
| **OAuth** | ❌ | ✅ Intégré |
| **Validation** | ❌ | ✅ Zod/Valibot |
| **HTTP/2** | ❌ | ✅ @unireq/http2 |
| **GraphQL** | ❌ | ✅ @unireq/graphql |
| **Introspection** | ❌ | ✅ `inspect()` |

## Quand Rester sur ky

- **Apps browser-only** : Le bundle de 2KB de ky est difficile à battre
- **Cas d'usage simples** : Si vous avez juste besoin d'un wrapper fetch basique
- **Dépendances minimales** : ky n'a aucune dépendance

## Quand Migrer vers @unireq

- **Apps enterprise** : Besoin de circuit breaker, throttle, OAuth
- **Serveurs Node.js** : Besoin du support HTTP/2, FTP, IMAP
- **Type safety** : Besoin de génériques TypeScript robustes
- **Validation** : Besoin de la validation de réponses Zod/Valibot
- **Debugging** : Besoin d'introspection des requêtes

## Comparaison Côte à Côte

### GET Simple

```typescript
// ky
const data = await ky.get('https://api.example.com/users').json();

// @unireq
const response = await api.get('/users');
const data = response.data;
```

### POST avec JSON

```typescript
// ky
await ky.post('https://api.example.com/users', {
  json: { name: 'John' },
});

// @unireq
await api.post('/users', { name: 'John' });
```

### Avec Toutes les Options

```typescript
// ky
const api = ky.create({
  prefixUrl: 'https://api.example.com',
  timeout: 5000,
  retry: 3,
  headers: { 'X-API-Key': key },
});

// @unireq
const api = preset.api
  .json
  .timeout
  .retry
  .withHeaders({ 'X-API-Key': key })
  .build('https://api.example.com');
```
