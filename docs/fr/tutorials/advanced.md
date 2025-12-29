# Usage Avancé

## Composition et Middleware

Unireq utilise un modèle de composition "pipe-first". Vous pouvez composer plusieurs policies pour créer des comportements complexes.

```typescript
import { client, compose } from '@unireq/core';
import { http, headers, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const secureClient = client(
  http('https://secure-api.example.com'),
  compose(
    // Ajoute la gestion du token OAuth
    oauthBearer({ tokenSupplier: getToken }),
    // Ajoute des en-têtes communs
    headers({ 'X-Custom': 'value' }),
    // Parse les réponses JSON
    parse.json()
  )
);
```

## Intercepteurs

Vous pouvez écrire des intercepteurs personnalisés pour logger les requêtes, mesurer des métriques, ou modifier les requêtes/réponses.

```typescript
import { Policy } from '@unireq/core';

const logger: Policy = (next) => async (req) => {
  console.log(`Démarrage ${req.method} ${req.url}`);
  const start = Date.now();
  
  const res = await next(req);
  
  console.log(`Terminé en ${Date.now() - start}ms`);
  return res;
};

const api = client(http('...'), logger);
```

## Retries et Limitation de Débit

Unireq a un support intégré pour les retries et la limitation de débit.

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay } from '@unireq/http';

const robustClient = client(
  http('...'),
  retry(
    httpRetryPredicate({ statusCodes: [429, 503] }),
    [rateLimitDelay(), backoff({ max: 5000 })]
  )
);
```

---

<p align="center">
  <a href="#/fr/tutorials/getting-started">← Premiers Pas</a> · <a href="#/fr/concepts/composition">Composition →</a>
</p>
