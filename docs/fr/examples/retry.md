# Retry & Backoff

Cet exemple montre comment configurer des stratégies de retry robustes avec backoff exponentiel et gestion du rate limiting.

## Code Unireq

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    // Prédicat : Quand réessayer ?
    httpRetryPredicate({
      methods: ['GET', 'PUT', 'DELETE'],
      statusCodes: [408, 429, 500, 502, 503, 504]
    }),
    // Stratégies de délai : Combien de temps attendre ?
    [
      // 1. Respecter l'en-tête Retry-After si présent (pour 429/503)
      rateLimitDelay({ maxWait: 60000 }),
      // 2. Sinon, utiliser un backoff exponentiel avec jitter
      backoff({ initial: 200, max: 2000, jitter: true })
    ],
    // Options globales
    { tries: 3 }
  ),
  parse.json()
);

await api.get('/unstable-endpoint');
```

## Comparaison avec Axios

### Axios

Axios n'a pas de support natif pour les retries. Vous devez utiliser une librairie tierce comme `axios-retry`.

```javascript
const axios = require('axios');
const axiosRetry = require('axios-retry');

const client = axios.create();

axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.response.status === 429;
  }
});
```

### Différences

1.  **Natif vs Tiers** : Unireq intègre le retry dans son cœur (`@unireq/core`). Pas besoin de dépendance supplémentaire.
2.  **Flexibilité** : Unireq sépare le *prédicat* (quand réessayer) de la *stratégie* (combien de temps attendre). Vous pouvez combiner plusieurs stratégies (ex: `rateLimitDelay` puis `backoff`).
3.  **Agnostique** : Le système de retry d'Unireq fonctionne pour n'importe quel transport (HTTP, mais aussi FTP, IMAP, etc.), pas seulement HTTP.

---

<p align="center">
  <a href="#/fr/examples/interceptors">← Intercepteurs</a> · <a href="#/fr/examples/validation">Validation →</a>
</p>