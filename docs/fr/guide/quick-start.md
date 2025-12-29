# Démarrage Rapide

```bash
pnpm add @unireq/core @unireq/http
```

## Client HTTP basique

Unireq est fonctionnel et composable. Vous construisez un client en passant un **transport** (HTTP, FTP, IMAP…) et une liste de **policies**. Elles s'exécutent dans l'ordre donné à l'aller, puis reviennent en sens inverse au retour.

```ts
import { client } from '@unireq/core';
import { http, headers, parse } from '@unireq/http';

// Client avec base URL et policies globales
const api = client(
  http('https://api.example.com'),
  headers({ 'user-agent': 'unireq/1.0' }),
  parse.json() // Automatically parse JSON responses
);

const response = await api.get('/users/123');

if (response.ok) {
  console.log(response.data); // Typed response
} else {
  console.error('Request failed:', response.status);
}
```

> **Note :** Contrairement à d'autres bibliothèques, Unireq ne lève **pas** d'erreur pour les réponses non-2xx par défaut. Vérifiez `response.ok` / `response.status`, ou ajoutez une policy comme `throwOnError()` si vous préférez les exceptions.

### Overrides ponctuels

Les policies globales gardent votre client DRY, mais vous pouvez en appendice par requête :

```ts
import { body, parse } from '@unireq/http';

await api.post('/users', { body: body.json(payload) }, parse.json());
//                 ^ init pour headers/méthode/corps ponctuels
//                                            ^ policy additionnelle collée au transport
```

Les policies passées à la requête sont ajoutées après la pile du client, donc elles restent au plus près du transport. Idéal pour du parsing ad hoc, des retries conditionnels ou des en-têtes temporaires.

## Client HTTPS avancé (OAuth, retries, négociation de contenu)

```ts
import { client, compose, either, retry, backoff } from '@unireq/core';
import { http, headers, parse, redirectPolicy, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';
import { parse as xmlParse } from '@unireq/xml';

const smartClient = client(
  http('https://api.example.com'),
  headers({ accept: 'application/json, application/xml' }),
  redirectPolicy({ allow: [307, 308] }),
  retry(
    httpRetryPredicate({ methods: ['GET', 'PUT', 'DELETE'], statusCodes: [429, 503] }),
    [rateLimitDelay(), backoff({ initial: 100, max: 5000 })],
    { tries: 3 }
  ),
  oauthBearer({ tokenSupplier: async () => getAccessToken() }),
  either(
    (ctx) => ctx.headers.accept?.includes('json'),
    parse.json(),
    xmlParse()
  )
);

**Pourquoi cet ordre ?**

- `headers` / `redirectPolicy` enveloppent tout pour préparer la requête avant les couches de résilience.
- `retry` reste **à l'extérieur** d'`oauthBearer` pour que la couche OAuth voie les `401` et rafraîchisse le token avant qu'un retry général ne rejoue l'appel.
- Le parsing (`parse.json` / XML) doit être au plus proche du transport afin de voir la réponse finale, après toutes les tentatives.

const user = await smartClient.get('/users/me');
```

---

## Prochaines étapes

- **[Philosophie](fr/concepts/philosophy.md)** — Pourquoi Unireq diffère d'Axios/Fetch.
- **[Composition](fr/concepts/composition.md)** — Rappel complet sur l'ordre des policies.
- **[Architecture](fr/guide/architecture.md)** — Structure des packages et couches.
- **[Exemples](fr/examples/basic.md)** — Scripts prêts à l'emploi alignés sur ce guide.

<p align="center">
  <a href="#/fr/README">← Accueil</a> · <a href="#/fr/concepts/philosophy">Philosophie →</a>
</p>