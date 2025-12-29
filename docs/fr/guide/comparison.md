# Comparaison avec les Alternatives npm

Cette page fournit une comparaison honnête de @unireq avec les bibliothèques HTTP populaires de l'écosystème npm.

---

## Paysage Concurrentiel

| Bibliothèque | Downloads/semaine | Positionnement |
|--------------|-------------------|----------------|
| **axios** | ~72M | Standard de facto, omniprésent |
| **undici** | ~28M | Client officiel Node.js, performance brute |
| **got** | ~25M | Riche en fonctionnalités, orienté Node.js |
| **node-fetch** | ~22M | Polyfill fetch, legacy |
| **ky** | ~3.5M | Wrapper fetch minimaliste, moderne |
| **ofetch** | ~2M | Écosystème Nuxt, isomorphique |
| **wretch** | ~100K | API fluide, composition |
| **@unireq** | Nouveau | Composition de policies, multi-transport |

---

## Comparaison d'Architecture

| Critère | axios | got | ky | undici | @unireq |
|---------|-------|-----|----|--------|---------|
| **Pattern** | Monolithique | Plugins | Wrapper | Bas niveau | **Composition de Policies** |
| **Extensibilité** | Interceptors | Hooks | Hooks | Dispatcher | **Middleware Onion** |
| **Transport** | XHR/fetch | http/https | fetch | Custom | **Abstraction multi-transport** |
| **TypeScript** | Partiel | Complet | Complet | Complet | **Complet + Generics** |

### Ce qui Rend @unireq Différent

@unireq utilise une architecture de **composition de policies**, similaire au modèle middleware de Koa. Chaque préoccupation (retry, circuit breaker, logging) est une fonction policy isolée et testable :

```typescript
// @unireq : Chaque policy est une fonction pure
const api = client(
  http(uri),
  retry(predicate, strategies, options),
  circuitBreaker(options),
  log({}),
  parse.json()
);

// vs axios : Objet de configuration monolithique
const api = axios.create({
  baseURL: uri,
  timeout: 5000,
  // Pas de retry, circuit breaker, etc. intégrés
});
```

---

## Comparaison des Fonctionnalités

| Fonctionnalité | axios | got | ky | undici | @unireq |
|----------------|-------|-----|----|--------|---------|
| **Retry automatique** | Plugin | ✅ Intégré | ✅ | ❌ | ✅ **+ Rate-limit aware** |
| **Circuit Breaker** | ❌ | ❌ | ❌ | ❌ | ✅ **Intégré** |
| **Throttle/Rate limit** | ❌ | ❌ | ❌ | ❌ | ✅ **Intégré** |
| **Conditionnel (ETag)** | ❌ | ❌ | ❌ | ❌ | ✅ **Intégré** |
| **Refresh token OAuth** | ❌ | ❌ | ❌ | ❌ | ✅ **@unireq/oauth** |
| **Validation réponse** | ❌ | ❌ | ❌ | ❌ | ✅ **Adaptateurs Zod/Valibot** |
| **GraphQL** | ❌ | ❌ | ❌ | ❌ | ✅ **@unireq/graphql** |
| **HTTP/2** | ❌ | ✅ | ❌ | ❌ | ✅ **@unireq/http2** |
| **Streaming** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **SSE (Server-Sent Events)** | ❌ | ❌ | ❌ | ❌ | ✅ **Intégré** |
| **FTP/IMAP** | ❌ | ❌ | ❌ | ❌ | ✅ **Packages dédiés** |
| **API d'Introspection** | ❌ | ❌ | ❌ | ❌ | ✅ **`inspect()` pour debug** |

---

## Comparaison de l'Expérience Développeur

| Critère | axios | got | ky | @unireq Core | @unireq Presets |
|---------|-------|-----|----|--------------|-----------------|
| **Verbosité** | Moyenne | Haute | Basse | Haute | **Très Basse** |
| **Courbe d'apprentissage** | Facile | Moyenne | Facile | Moyenne | **Facile** |
| **Valeurs par défaut** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Setup en une ligne** | ❌ | ❌ | ✅ | ❌ | ✅ |

### Comparaison One-liner

```typescript
// ky
const api = ky.create({ prefixUrl: 'https://api.example.com', retry: 3 });

// @unireq/presets (comparable !)
const api = preset.api.json.retry.timeout.build('https://api.example.com');
```

---

## Fonctionnalités Enterprise

### Circuit Breaker

@unireq est le seul client HTTP avec un circuit breaker intégré :

```typescript
import { client, circuitBreaker } from '@unireq/core';
import { http } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  circuitBreaker({
    threshold: 5,        // Ouvre après 5 échecs
    resetTimeout: 30000, // Réessaie après 30s
    halfOpenRequests: 1, // Autorise 1 requête de test
  })
);
```

Avec les autres bibliothèques, vous avez besoin de packages externes comme `opossum` ou `cockatiel`.

### Retry Conscient des Rate-Limits

Le système de retry de @unireq comprend les headers `Retry-After` :

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({ statusCodes: [429, 503] }),
    [
      rateLimitDelay({ maxWait: 60000 }), // Respecte le header Retry-After
      backoff({ initial: 1000, max: 30000, jitter: true }),
    ],
    { tries: 5 }
  )
);
```

### Requêtes Conditionnelles (ETag/Last-Modified)

Support intégré pour la sémantique de cache HTTP :

```typescript
import { conditional } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  conditional({ etag: true, lastModified: true })
);

// Envoie automatiquement les headers If-None-Match / If-Modified-Since
// Retourne la réponse cachée sur 304 Not Modified
```

---

## Quand Choisir @unireq

### Choisissez @unireq si vous avez besoin de :

- **Composition de policies** — Middleware isolé et testable
- **Fonctionnalités enterprise** — Circuit breaker, throttle, gestion rate-limit
- **Multi-transport** — HTTP, HTTP/2, FTP, IMAP dans une seule API
- **Type safety** — Generics TypeScript complets pour request/response
- **Validation des réponses** — Intégration Zod/Valibot
- **Refresh OAuth** — Refresh automatique des tokens avec validation JWKS

### Choisissez axios si vous avez besoin de :

- **Support écosystème maximum** — La plupart des tutoriels utilisent axios
- **Compatibilité navigateur** — Fonctionne partout
- **Cas d'usage simples** — Appels API REST basiques

### Choisissez got si vous avez besoin de :

- **Node.js uniquement** — Optimisé pour le serveur
- **HTTP/2 maintenant** — Support HTTP/2 mature
- **Pagination** — Helpers de pagination intégrés

### Choisissez ky si vous avez besoin de :

- **Bundle minimal** — ~2KB gzippé
- **Browser-first** — Construit sur fetch
- **API simple** — Juste un wrapper fetch

### Choisissez undici si vous avez besoin de :

- **Performance brute** — Client Node.js le plus rapide
- **Contrôle bas niveau** — Accès direct aux sockets
- **Support officiel** — Maintenu par l'équipe Node.js

---

## Migration depuis d'Autres Bibliothèques

Voir nos guides de migration :
- [Migration depuis axios](guides/migrate-axios.md)
- [Migration depuis got](guides/migrate-got.md)
- [Migration depuis ky](guides/migrate-ky.md)

---

## Considérations sur les Benchmarks

Les benchmarks de performance varient significativement selon :
- Les conditions réseau
- La taille des payloads
- Les niveaux de concurrence
- L'utilisation des fonctionnalités (retry, logging, etc.)

@unireq priorise la **correctness et la composabilité** plutôt que la vitesse brute. Pour la plupart des applications, la différence est négligeable. Si vous avez besoin du débit maximum avec un minimum de fonctionnalités, considérez `undici` directement.

Le transport `http()` de @unireq utilise `undici` sous le capot, donc vous obtenez d'excellentes performances avec la composition de policies en plus.
