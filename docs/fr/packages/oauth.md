# @unireq/oauth

Policies d'authentification OAuth 2.0 pour Unireq.

# @unireq/oauth

Authentification OAuth 2.0 Bearer avec vérification JWT, contrôle d'expiration proactif et refresh automatique sur `401`.

## Installation

```bash
pnpm add @unireq/oauth
```

## Exports

| Symbole | Description |
| --- | --- |
| `oauthBearer(options)` | Policy qui ajoute `Authorization: Bearer <token>` et gère le refresh. |
| `OAuthBearerOptions` | Options (tokenSupplier, jwks, skew, autoRefresh, hooks). |
| `TokenSupplier` | `() => string | Promise<string>` invoqué à la demande. |
| `JWKSSource` | `{ type: 'url'; url }` ou `{ type: 'key'; key }` pour vérifier la signature JWT. |

## Exemple complet

```ts
import { client, retry } from '@unireq/core';
import { http, parse, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  retry(httpRetryPredicate(), [rateLimitDelay({ maxWait: 60_000 })]), // la résilience entoure l'auth
  oauthBearer({
    tokenSupplier: async () => getAccessToken(),
    jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
    skew: 60,
    onRefresh: () => console.log('refresh token'),
  }),
  parse.json(),
);
```

**Ordre important :** si `retry` était placé *à l'intérieur* d'`oauthBearer`, les tentatives seraient rejouées avec un token périmé avant que la couche OAuth ne voie le `401`. En gardant `retry` à l'extérieur, OAuth rafraîchit d'abord, puis la résilience décide de relancer ou non.

## Token supplier & cache

- `tokenSupplier` est invoqué uniquement quand nécessaire puis mis en cache.
- Les requêtes concurrentes partagent un mécanisme single-flight pour éviter plusieurs refresh simultanés.
- Retournez une chaîne ou une promesse—intégrable avec n'importe quel coffre-fort/IDP.

## Vérification JWT & sécurité

- Fournissez `jwks` (URL ou clé PEM) pour vérifier cryptographiquement la signature via `jose`.
- `skew` (60s par défaut) rafraîchit légèrement avant l'expiration réelle.
- `allowUnsafeMode: true` n'est destiné qu'au développement : aucune vérification de signature, un avertissement s'affiche et les tokens peuvent être forgés.

### Vérificateur JWKS instancié une seule fois

Quand une URL JWKS est fournie, l'objet vérificateur `jose` est créé **une seule fois par instance de policy** à la construction, puis réutilisé pour chaque appel de vérification. `jose` maintient son propre cache interne de clés JWKS sur le vérificateur : en gardant l'instance en vie, ce cache est préservé entre les requêtes, ce qui évite des appels inutiles à l'endpoint JWKS.

```typescript
// Correct : une instance oauthBearer → un vérificateur → JWKS mis en cache pour toutes les requêtes
const api = client(
  http('https://api.example.com'),
  oauthBearer({
    tokenSupplier: getToken,
    jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
  }),
);

// Incorrect : créer un nouvel oauthBearer par requête détruit le cache JWKS
// ❌ Ne pas faire ça dans des handlers de requêtes
const parRequete = client(http('...'), oauthBearer({ ... }));
```

Le vérificateur n'est intentionnellement pas recréé lors d'un refresh de token — seule la valeur du token change, pas les clés de signature.

```ts
const authSecurise = oauthBearer({
  tokenSupplier: () => idp.issue(),
  jwks: { type: 'key', key: process.env.OAUTH_PUBLIC_KEY! },
});

const authDev = oauthBearer({
  tokenSupplier: getLocalToken,
  allowUnsafeMode: true, // AVERTISSEMENT en console
});
```

## Auto-refresh & hook

- Sur `401` avec `WWW-Authenticate: Bearer`, la policy rafraîchit le token (single-flight) et rejoue **une seule fois** quand `autoRefresh` vaut `true`.
- Utilisez `onRefresh` pour journaliser, tracer ou compter les rafraîchissements.

### Rappels de composition

- Placez logs/traces à l'extérieur pour observer toutes les tentatives.
- Laissez les policies de sérialisation/parsing (`body.*`, `parse.*`) à l'intérieur afin que chaque replay hérite des bons en-têtes et du parsing final.

---

<p align="center">
  <a href="#/fr/packages/http2">← HTTP/2</a> · <a href="#/fr/packages/cookies">Cookies →</a>
</p>
