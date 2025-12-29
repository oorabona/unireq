# Core vs Preset Builder

@unireq offre deux façons de configurer les clients HTTP :

1. **API Core** — Contrôle maximal, composer les policies manuellement
2. **Preset Builder** — API fluide et chaînable avec des valeurs par défaut sensées

Les deux approches produisent le même résultat. Choisissez selon vos besoins :

| Aspect | API Core | Preset Builder |
|--------|----------|----------------|
| **Contrôle** | Contrôle total sur l'ordre des policies | Ordre prédéfini, échappement via `.with()` |
| **Verbosité** | Plus explicite | Plus concis |
| **Valeurs par défaut** | Aucune, vous configurez tout | Valeurs par défaut sensées |
| **Courbe d'apprentissage** | Connaître chaque policy | Chaîner ce dont vous avez besoin |
| **Idéal pour** | Cas avancés, bibliothèques | Code applicatif, configuration rapide |

---

## Tableau de Comparaison

| Fonctionnalité | API Core | Preset Builder |
|----------------|----------|----------------|
| Parsing JSON | `parse.json()` | `.json` |
| Retry | `retry(predicate, strategies, opts)` | `.retry` ou `.withRetry({ tries: 5 })` |
| Timeout | `timeout(ms)` | `.timeout` ou `.withTimeout(5000)` |
| Cache | `cache(options)` | `.cache` ou `.withCache({ defaultTtl: 60000 })` |
| Logging | `log({ logger })` | `.logging` ou `.withLogging(logger)` |
| Redirect | `redirectPolicy({ allow })` | `.redirect` ou `.withRedirect({ allow: [301] })` |
| Circuit Breaker | `circuitBreaker(options)` | `.circuitBreaker` ou `.withCircuitBreaker({ threshold: 10 })` |
| Throttle | `throttle(options)` | `.throttle` ou `.withThrottle({ requestsPerSecond: 5 })` |
| Conditional | `conditional(options)` | `.conditional` ou `.withConditional({ etag: true })` |
| Headers | `headers({ ... })` | `.withHeaders({ ... })` |
| Query params | `query({ ... })` | `.withQuery({ ... })` |
| OAuth | `oauthBearer({ ... })` | `.oauth({ ... })` |
| Validation | `validate(adapter)` | `.withValidation(adapter)` |
| Interceptors | `interceptRequest()`, `interceptResponse()` | `.withInterceptors({ request, response })` |

---

## Exemples

### API JSON Simple

**API Core :**
```typescript
import { client, retry, backoff, log } from '@unireq/core';
import { http, httpRetryPredicate, parse, timeout, rateLimitDelay } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timeout(30000),
  retry(
    httpRetryPredicate({ methods: ['GET', 'PUT', 'DELETE'] }),
    [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 1000, max: 30000, jitter: true })],
    { tries: 3 }
  ),
  log({}),
  parse.json()
);
```

**Preset Builder :**
```typescript
import { preset } from '@unireq/presets';

const api = preset.api.json.retry.timeout.logging.build('https://api.example.com');
```

---

### API avec OAuth et Headers Personnalisés

**API Core :**
```typescript
import { client, retry, backoff, log } from '@unireq/core';
import { http, httpRetryPredicate, parse, timeout, headers, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  headers({ 'X-API-Version': 'v2' }),
  timeout(10000),
  retry(
    httpRetryPredicate({ methods: ['GET'], statusCodes: [429, 500, 502, 503, 504] }),
    [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 500, max: 10000, jitter: true })],
    { tries: 5 }
  ),
  oauthBearer({
    tokenSupplier: () => getAccessToken(),
    jwks: { type: 'url', url: 'https://auth.example.com/.well-known/jwks.json' },
  }),
  log({}),
  parse.json()
);
```

**Preset Builder :**
```typescript
import { preset } from '@unireq/presets';
import { jwksFromUrl } from '@unireq/oauth';

const api = preset.api
  .json
  .withHeaders({ 'X-API-Version': 'v2' })
  .withRetry({ tries: 5, methods: ['GET'] })
  .withTimeout(10000)
  .oauth({
    tokenSupplier: () => getAccessToken(),
    jwks: jwksFromUrl('https://auth.example.com/.well-known/jwks.json'),
  })
  .logging
  .build('https://api.example.com');
```

---

### API Production Complète

**API Core :**
```typescript
import { client, retry, backoff, circuitBreaker, throttle, log, validate } from '@unireq/core';
import {
  http, httpRetryPredicate, parse, timeout, headers, query,
  cache, conditional, redirectPolicy, rateLimitDelay
} from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  headers({ 'X-API-Key': process.env.API_KEY }),
  query({ version: 'v2' }),
  timeout(30000),
  throttle({ requestsPerSecond: 10, burst: 5 }),
  circuitBreaker({ threshold: 5, resetTimeout: 30000, halfOpenRequests: 1 }),
  redirectPolicy({ allow: [307, 308] }),
  retry(
    httpRetryPredicate({ methods: ['GET', 'PUT', 'DELETE'], statusCodes: [408, 429, 500, 502, 503, 504] }),
    [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 1000, max: 30000, jitter: true })],
    { tries: 3 }
  ),
  conditional({ etag: true, lastModified: true }),
  cache({ defaultTtl: 300000 }),
  oauthBearer({ tokenSupplier: () => getToken(), allowUnsafeMode: true }),
  log({}),
  validate(zodAdapter(UserSchema)),
  parse.json()
);
```

**Preset Builder :**
```typescript
import { preset } from '@unireq/presets';

const api = preset.api
  .json
  .withHeaders({ 'X-API-Key': process.env.API_KEY })
  .withQuery({ version: 'v2' })
  .timeout
  .throttle
  .circuitBreaker
  .redirect
  .retry
  .conditional
  .cache
  .oauth({ tokenSupplier: () => getToken(), allowUnsafeMode: true })
  .logging
  .withValidation(zodAdapter(UserSchema))
  .build('https://api.example.com');
```

---

## Quand Utiliser l'API Core

Utilisez l'API Core quand vous avez besoin de :

- **Ordre personnalisé des policies** — Les policies s'exécutent dans l'ordre que vous spécifiez
- **Policies personnalisées** — Écrire vos propres middlewares
- **Transports non-HTTP** — FTP, IMAP, etc.
- **Développement de bibliothèques** — Flexibilité maximale pour les consommateurs

```typescript
// Exemple de policy personnalisée
const customMetrics = (ctx, next) => {
  const start = Date.now();
  try {
    return await next();
  } finally {
    recordMetric('api_latency', Date.now() - start);
  }
};

const api = client(
  http('https://api.example.com'),
  customMetrics,  // Votre policy personnalisée
  retry(...),
  parse.json()
);
```

---

## Quand Utiliser le Preset Builder

Utilisez le Preset Builder quand vous avez besoin de :

- **Configuration rapide** — Démarrer en une ligne
- **Valeurs par défaut sensées** — Ne pas se soucier de la configuration
- **Lisibilité** — Chaîner ce dont vous avez besoin, ignorer le reste
- **Code applicatif** — La plupart des cas d'usage couverts

```typescript
// Configuration en une ligne
const api = preset.api.json.retry.timeout.build('https://api.example.com');

// Toujours composable
const data = await api.get<User[]>('/users');
```

---

## Échappatoire : `.with()`

Le builder fournit `.with()` pour ajouter des policies personnalisées :

```typescript
import { preset } from '@unireq/presets';
import { myCustomPolicy } from './policies';

const api = preset.api
  .json
  .retry
  .with(myCustomPolicy)  // Ajouter une policy personnalisée
  .build('https://api.example.com');
```

---

## Référence des Valeurs par Défaut

| Propriété | Valeur par Défaut |
|-----------|-------------------|
| `.timeout` | 30 000 ms (30s) |
| `.retry` | 3 essais, méthodes: GET/PUT/DELETE, codes: 408/429/500/502/503/504 |
| `.cache` | TTL de 5 minutes |
| `.circuitBreaker` | 5 échecs, reset 30s, 1 requête half-open |
| `.throttle` | 10 requêtes/seconde, burst de 5 |
| `.conditional` | ETag + Last-Modified activés |
| `.redirect` | Autoriser 307/308 uniquement (redirections sûres) |
