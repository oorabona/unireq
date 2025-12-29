# Migrer depuis axios

Ce guide vous aide à migrer d'axios vers @unireq. Bien que les APIs soient différentes, la plupart des patterns axios ont des équivalents directs dans @unireq.

## Référence Rapide

| axios | @unireq |
|-------|---------|
| `axios.create({ baseURL })` | `client(http(baseURL))` |
| `axios.get(url)` | `api.get(url)` |
| `axios.post(url, data)` | `api.post(url, data)` |
| `response.data` | `response.data` |
| `response.status` | `response.status` |
| `interceptors.request.use` | `interceptRequest()` |
| `interceptors.response.use` | `interceptResponse()` |
| `timeout: 5000` | `timeout(5000)` |

## Migration de Base

### axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
});

const response = await api.get('/users');
console.log(response.data);
```

### @unireq - Équivalent direct

```typescript
import { client } from '@unireq/core';
import { http, parse, timeout, headers } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timeout(5000),
  headers({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }),
  parse.json()
);

const response = await api.get('/users');
console.log(response.data);
```

### @unireq - Avec Preset Builder ✨

Pour les configurations courantes, le preset builder offre une API fluent :

```typescript
import { preset } from '@unireq/presets';

const api = preset.http
  .uri('https://api.example.com')
  .json                           // Parsing JSON automatique
  .timeout                        // Timeout par défaut
  .withHeaders({ 'Authorization': `Bearer ${token}` })
  .build();

const response = await api.get('/users');
console.log(response.data);
```

> 💡 **Pourquoi utiliser les presets ?** Moins de boilerplate, valeurs par défaut sensées, API fluent.

## Intercepteurs de Requête

### axios

```typescript
axios.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${getToken()}`;
  return config;
});
```

### @unireq - Équivalent direct

```typescript
import { interceptRequest } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  interceptRequest((ctx) => ({
    ...ctx,
    headers: {
      ...ctx.headers,
      Authorization: `Bearer ${getToken()}`,
    },
  })),
  parse.json()
);
```

### @unireq - Solution idiomatique ✨

Pour l'authentification Bearer, unireq fournit une policy dédiée qui gère bien plus que l'injection de header :

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  oauthBearer({
    tokenSupplier: () => getToken(),     // Token provider asynchrone
    onRefresh: async () => refreshToken(), // Refresh auto sur 401
  }),
  parse.json()
);
```

> 💡 **Pourquoi utiliser `oauthBearer()` ?**
> - **Refresh automatique** : Gère les réponses 401 et retry avec un nouveau token
> - **Token provider async** : Récupère le token depuis un stockage sécurisé
> - **Auth centralisée** : Un seul endroit pour toute la logique d'authentification
> - **Testable** : Facile à mocker dans les tests

## Intercepteurs de Réponse

### axios

```typescript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      logout();
    }
    return Promise.reject(error);
  }
);
```

### @unireq

```typescript
import { interceptResponse, interceptError } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  interceptResponse((response) => {
    // Transformer les réponses réussies
    return response;
  }),
  interceptError((error, ctx) => {
    if (error.status === 401) {
      logout();
    }
    throw error;
  }),
  parse.json()
);
```

## Gestion des Erreurs

### axios

```typescript
try {
  await axios.get('/users');
} catch (error) {
  if (axios.isAxiosError(error)) {
    console.log(error.response?.status);
    console.log(error.response?.data);
  }
}
```

### @unireq

```typescript
import { isHttpError } from '@unireq/core';

try {
  await api.get('/users');
} catch (error) {
  if (isHttpError(error)) {
    console.log(error.response?.status);
    console.log(error.response?.data);
  }
}
```

## Logique de Retry

### axios (avec axios-retry)

```typescript
import axios from 'axios';
import axiosRetry from 'axios-retry';

const api = axios.create({ baseURL: 'https://api.example.com' });
axiosRetry(api, { retries: 3 });
```

### @unireq - Équivalent direct

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({ statusCodes: [429, 500, 502, 503, 504] }),
    [rateLimitDelay(), backoff({ initial: 1000, max: 30000, jitter: true })],
    { tries: 3 }
  ),
  parse.json()
);
```

### @unireq - Avec Preset Builder ✨

```typescript
import { preset } from '@unireq/presets';

const api = preset.http
  .uri('https://api.example.com')
  .json
  .retry  // Retry intégré avec valeurs par défaut sensées
  .build();
```

> 💡 **Avantages de unireq sur axios-retry :**
> - **Pas de package supplémentaire** : Intégré, tree-shakeable
> - **Gestion du rate-limit** : Respecte l'en-tête `Retry-After` automatiquement
> - **Backoff exponentiel** : Avec jitter pour éviter le thundering herd
> - **Circuit breaker** : Ajoutez `.circuitBreaker` pour une résilience complète

## Upload de Fichiers

### axios

```typescript
const formData = new FormData();
formData.append('file', file);

await axios.post('/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (e) => console.log(e.loaded / e.total * 100),
});
```

### @unireq

```typescript
import { body, progress } from '@unireq/http';

await api.post(
  '/upload',
  body.multipart([{ name: 'file', data: file }]),
  progress({
    onUploadProgress: ({ percent }) => console.log(percent),
  })
);
```

## Annulation

### axios

```typescript
const controller = new AbortController();

axios.get('/users', { signal: controller.signal });

// Annuler la requête
controller.abort();
```

### @unireq

```typescript
const controller = new AbortController();

api.get('/users', { signal: controller.signal });

// Annuler la requête
controller.abort();
```

## Pourquoi Migrer ?

1. **Fonctionnalités intégrées** : Circuit breaker, throttle, gestion du rate-limit sans packages supplémentaires
2. **Type safety** : Génériques TypeScript complets pour les types requête/réponse
3. **Composable** : Architecture basée sur les policies pour un code propre et testable
4. **Support OAuth** : Validation JWT et refresh de token intégrés
5. **Multi-protocole** : HTTP, HTTP/2, FTP, IMAP avec la même API
6. **Bundle plus petit** : Tree-shakeable, importez uniquement ce dont vous avez besoin

## Migration Progressive

Vous n'avez pas besoin de tout migrer d'un coup. Les deux bibliothèques peuvent coexister :

```typescript
// Continuer à utiliser axios pour le code legacy
import axios from 'axios';

// Utiliser @unireq pour le nouveau code
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

// Endpoint legacy
const legacyResponse = await axios.get('/v1/users');

// Nouvel endpoint avec les fonctionnalités @unireq
const newApi = client(http('/v2'), circuitBreaker(), parse.json());
const newResponse = await newApi.get('/users');
```
