# Guide d'Optimisation des Performances

Ce guide couvre les stratégies d'optimisation des performances pour les clients HTTP @unireq.

## Gestion des Connexions

### Pool de Connexions

@unireq utilise le pool de connexions natif de Node.js via `undici`. Configurez les paramètres du pool :

```typescript
import { client } from '@unireq/core';
import { http, UndiciConnector, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com', {
    connector: new UndiciConnector({
      connections: 100, // Max connexions par origine
      pipelining: 10,   // Pipelining HTTP (pour HTTP/1.1)
      keepAliveTimeout: 30000, // Timeout keep-alive en ms
      keepAliveMaxTimeout: 600000, // Temps max keep-alive
    }),
  }),
  parse.json()
);
```

### Multiplexage HTTP/2

Pour les scénarios à haut débit, utilisez HTTP/2 :

```typescript
import { client } from '@unireq/core';
import { http2 } from '@unireq/http2';
import { parse } from '@unireq/http';

// HTTP/2 multiplexe les requêtes sur une seule connexion
const api = client(
  http2('https://api.example.com'),
  parse.json()
);

// Toutes les requêtes partagent la même connexion
await Promise.all([
  api.get('/resource1'),
  api.get('/resource2'),
  api.get('/resource3'),
  // Pas de surcharge de connexion pour les requêtes concurrentes
]);
```

## Déduplication des Requêtes

Évitez les requêtes dupliquées pour la même ressource :

```typescript
import { client } from '@unireq/core';
import { http, dedupe, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  dedupe({
    ttl: 100,            // Fenêtre de dédup en ms
    methods: ['GET'],    // Dédupliquer uniquement les méthodes sûres
    maxSize: 1000,       // Max requêtes en attente à traquer
  }),
  parse.json()
);

// Seulement 1 requête réseau, 3 réponses identiques
const [r1, r2, r3] = await Promise.all([
  api.get('/users'),
  api.get('/users'),
  api.get('/users'),
]);
```

## Mise en Cache

### Cache des Réponses

```typescript
import { client } from '@unireq/core';
import { http, cache, MemoryCacheStorage, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  cache({
    storage: new MemoryCacheStorage(),
    defaultTtl: 60000,   // 1 minute
    maxSize: 1000,       // Max entrées en cache
    keyGenerator: (ctx) => `${ctx.method}:${ctx.url}`,
  }),
  parse.json()
);
```

### Requêtes Conditionnelles (ETag/Last-Modified)

Réduisez la bande passante avec les requêtes conditionnelles :

```typescript
import { client } from '@unireq/core';
import { http, conditional, cache, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  conditional({
    etag: true,          // Utiliser l'en-tête ETag
    lastModified: true,  // Utiliser l'en-tête Last-Modified
  }),
  cache({ defaultTtl: 300000 }), // Cache les réponses validées
  parse.json()
);

// Première requête : Réponse complète
// Suivantes : 304 Not Modified (pas de transfert de corps)
```

## Limitation de Débit

### Throttling Côté Client

Évitez de surcharger les serveurs :

```typescript
import { client, throttle } from '@unireq/core';
import { http, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  throttle({
    requestsPerSecond: 10, // Max 10 RPS
    burst: 5,              // Autoriser 5 requêtes en rafale
    queueSize: 100,        // Max requêtes en file d'attente
  }),
  parse.json()
);
```

### Retry Conscient des Rate-Limits

Respectez les limites de débit du serveur :

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({ statusCodes: [429] }),
    [
      rateLimitDelay({ maxWait: 60000 }), // Respecter Retry-After
      backoff({ initial: 1000, max: 30000, jitter: true }),
    ],
    { tries: 5 }
  ),
  parse.json()
);
```

## Configuration des Timeouts

### Timeouts par Phase

Contrôle fin des timeouts :

```typescript
import { client } from '@unireq/core';
import { http, timeout, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timeout({
    connect: 5000,   // Timeout de connexion
    headers: 10000,  // Temps pour recevoir les en-têtes
    body: 60000,     // Temps pour recevoir le corps
    total: 120000,   // Timeout total de la requête
  }),
  parse.json()
);
```

## Gestion du Corps

### Streaming de Gros Fichiers

Évitez de charger les gros fichiers en mémoire :

```typescript
import { client } from '@unireq/core';
import { http, body, parse } from '@unireq/http';

// Upload en streaming
const fileStream = createReadStream('large-file.zip');
await api.post('/upload', body.stream(fileStream, {
  contentType: 'application/zip',
  contentLength: fileSize,
}));

// Download en streaming
const response = await api.get('/download/large-file', parse.stream());
const reader = response.data.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  await writeChunk(value);
}
```

### Compression

Activez la compression pour les réponses texte :

```typescript
import { client } from '@unireq/core';
import { http, headers, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  headers({ 'Accept-Encoding': 'gzip, deflate, br' }),
  parse.json()
);
```

## Monitoring

### Timing des Performances

Suivez les performances des requêtes :

```typescript
import { client } from '@unireq/core';
import { http, timing, parse, type TimingInfo } from '@unireq/http';

const metrics: TimingInfo[] = [];

const api = client(
  http('https://api.example.com'),
  timing({
    onTiming: (info, ctx) => {
      metrics.push(info);

      // Alerte sur les requêtes lentes
      if (info.total > 5000) {
        console.warn(`Requête lente : ${ctx.url} a pris ${info.total}ms`);
      }
    },
  }),
  parse.json()
);
```

### Logging

Logging structuré pour l'analyse :

```typescript
import { client, log } from '@unireq/core';
import { http, parse } from '@unireq/http';
import pino from 'pino';

const logger = pino({ level: 'info' });

const api = client(
  http('https://api.example.com'),
  log({
    logger: {
      debug: (msg, meta) => logger.debug(meta, msg),
      info: (msg, meta) => logger.info(meta, msg),
      warn: (msg, meta) => logger.warn(meta, msg),
      error: (msg, meta) => logger.error(meta, msg),
    },
    includeHeaders: false, // Ne pas logger les en-têtes sensibles
    includeBody: false,    // Ne pas logger le contenu du corps
  }),
  parse.json()
);
```

## Benchmarking

### Tests de Charge

```typescript
import { client } from '@unireq/core';
import { http, timing, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timing(),
  parse.json()
);

async function benchmark(concurrency: number, total: number) {
  const timings: number[] = [];
  const errors = { count: 0 };

  const worker = async () => {
    for (let i = 0; i < total / concurrency; i++) {
      try {
        const response = await api.get('/benchmark');
        timings.push(response.timing.total);
      } catch {
        errors.count++;
      }
    }
  };

  const start = Date.now();
  await Promise.all(Array(concurrency).fill(null).map(worker));
  const elapsed = Date.now() - start;

  const sorted = timings.sort((a, b) => a - b);

  console.log({
    requests: total,
    concurrency,
    elapsed: `${elapsed}ms`,
    rps: Math.round(total / (elapsed / 1000)),
    errors: errors.count,
    latency: {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    },
  });
}

await benchmark(10, 1000);
```

## Checklist d'Optimisation

| Optimisation | Impact | Effort |
|--------------|--------|--------|
| HTTP/2 | Élevé | Faible |
| Pool de connexions | Élevé | Faible |
| Déduplication des requêtes | Moyen | Faible |
| Cache des réponses | Élevé | Moyen |
| Requêtes conditionnelles | Moyen | Faible |
| Streaming des gros fichiers | Élevé | Moyen |
| Compression | Moyen | Faible |
| Throttling | Faible | Faible |
| Timeouts | Faible | Faible |

## Pièges Courants

1. **Ne pas réutiliser les clients** - Créez un client, réutilisez-le pour toutes les requêtes
2. **Ignorer les limites de connexion** - Ajustez la taille du pool pour votre charge
3. **Gros payloads en mémoire** - Utilisez le streaming pour les fichiers > 10MB
4. **Pas de timeouts** - Définissez toujours des timeouts raisonnables
5. **Ignorer Retry-After** - Respectez les limites de débit du serveur
6. **Sur-caching** - Utilisez des TTL appropriés pour vos données
7. **Pas de monitoring** - Ajoutez timing/logging pour détecter les problèmes
