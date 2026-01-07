# @unireq/* — Toolkit d'E/S multi-protocole, composable et tree-shakeable

[![CI](https://github.com/oorabona/unireq/workflows/CI/badge.svg)](https://github.com/oorabona/unireq/actions)
[![codecov](https://codecov.io/gh/oorabona/unireq/branch/main/graph/badge.svg)](https://codecov.io/gh/oorabona/unireq)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Un toolkit client HTTP(S)/HTTP/2/IMAP/FTP moderne et composable pour Node.js ≥18, construit sur **undici** (le fetch natif de Node) avec un support de premier ordre pour :

- 🔗 **Composition pipe-first** — `compose(...policies)` pour un middleware propre en modèle "oignon"
- 🌳 **Tree-shakeable** — Importez uniquement ce dont vous avez besoin, taille de bundle minimale
- 🔐 **Smart OAuth Bearer** — Validation JWT, rafraîchissement automatique sur 401, rafraîchissement de token unique
- 🚦 **Rate limiting** — Lit les en-têtes `Retry-After` (429/503) et réessaie automatiquement
- 🔄 **Redirections sûres** — Préfère 307/308 (RFC 9110), 303 opt-in
- 📤 **Uploads multipart** — Conforme RFC 7578
- ⏸️ **Reprise de téléchargements** — Requêtes Range (RFC 7233, 206/416)
- 🎯 **Négociation de contenu** — Branchement `either(json|xml)`
- 🛠️ **Multi-protocole** — HTTP/2 (ALPN), IMAP (XOAUTH2), FTP/FTPS
- ✨ **Type Result** — Gestion fonctionnelle des erreurs avec les méthodes `safe.*`
- 🚀 **httpClient()** — Client zéro-config avec des valeurs par défaut sensées

---

## Pourquoi @unireq ? — Batteries Incluses

La plupart des clients HTTP résolvent bien les bases. @unireq va plus loin en intégrant les besoins courants de production directement :

| Fonctionnalité | @unireq | axios | ky | got | node-fetch |
|----------------|:-------:|:-----:|:--:|:---:|:----------:|
| **Taille bundle (min+gz)** | ~8 KB | ~40 KB | ~12 KB | ~46 KB | ~4 KB |
| **Tree-shakeable** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **TypeScript-first** | ✅ | ⚠️ | ✅ | ✅ | ⚠️ |
| **Middleware composable** | ✅ Modèle oignon | ✅ Interceptors | ✅ Hooks | ✅ Hooks | ❌ |
| **OAuth + validation JWT** | ✅ Intégré | ❌ Manuel | ❌ Manuel | ❌ Manuel | ❌ Manuel |
| **Rate limit (Retry-After)** | ✅ Automatique | ❌ Manuel | ⚠️ Partiel | ⚠️ Partiel | ❌ |
| **Circuit breaker** | ✅ Intégré | ❌ | ❌ | ❌ | ❌ |
| **Multi-protocole** | ✅ HTTP/HTTP2/FTP/IMAP | ❌ HTTP seul | ❌ HTTP seul | ❌ HTTP seul | ❌ HTTP seul |
| **API d'introspection** | ✅ Debug toute requête | ❌ | ❌ | ❌ | ❌ |
| **Reprise téléchargements** | ✅ Range requests | ❌ | ❌ | ⚠️ | ❌ |
| **Redirections sûres (307/308)** | ✅ Par défaut | ⚠️ Toutes permises | ⚠️ Toutes permises | ⚠️ Toutes permises | ⚠️ Toutes permises |
| **Type Result (méthodes safe)** | ✅ Intégré | ❌ | ❌ | ❌ | ❌ |
| **100% couverture tests** | ✅ | ❌ | ❌ | ✅ | ❌ |

### Ce qui distingue @unireq

1. **Composition pipe-first** — Construisez vos clients de manière déclarative avec `compose(...policies)`. Pas de magie, juste des fonctions.

2. **Auth prête pour la prod** — OAuth Bearer avec introspection JWT, rafraîchissement automatique sur 401, tolérance au décalage d'horloge. Pas de boilerplate.

3. **Retries intelligents** — Combine plusieurs stratégies : `rateLimitDelay()` lit les en-têtes `Retry-After`, `backoff()` gère les erreurs transitoires. Fonctionne ensemble naturellement.

4. **Multi-protocole** — Même API pour HTTP, HTTP/2, IMAP, FTP. Changez de transport sans réécrire la logique métier.

5. **Introspection** — Debuggez n'importe quelle requête avec `introspect()` : voyez les en-têtes exacts, le timing, les retries, et l'ordre d'exécution des policies.

6. **Empreinte minimale** — Importez uniquement ce que vous utilisez. Le core fait ~8 KB, et le tree-shaking supprime les policies inutilisées.

### Quand utiliser autre chose

- **Scripts rapides** : `node-fetch` ou `fetch` natif si vous avez juste besoin de GET/POST simples
- **Navigateur uniquement** : `ky` offre un excellent support navigateur avec une empreinte plus légère
- **Legacy Node.js** : `axios` si vous devez supporter Node < 18

---

## Pourquoi undici (le fetch natif de Node) ?

Depuis Node.js 18, l'API globale `fetch` est propulsée par [**undici**](https://undici.nodejs.org), un client HTTP/1.1 rapide et conforme aux spécifications. Avantages :

- ✅ **Aucune dépendance externe** pour HTTP/1.1
- ✅ **Streams, AbortController, FormData** intégrés
- ✅ **Support HTTP/2** via ALPN (nécessite un opt-in explicite ou `@unireq/http2`)
- ✅ **Maintenu par l'équipe core de Node.js**

> **Note** : `fetch` utilise HTTP/1.1 par défaut. Pour HTTP/2, utilisez `@unireq/http2` (voir [Pourquoi le transport HTTP/2 ?](#pourquoi-le-transport-http2)).

---

## Pourquoi le transport HTTP/2 ?

Le `fetch` de Node (undici) utilise HTTP/1.1 par défaut, même lorsque les serveurs supportent HTTP/2. Bien qu'undici *puisse* négocier HTTP/2 via ALPN, cela nécessite une configuration explicite non disponible dans l'API globale `fetch`.

`@unireq/http2` fournit :

- ✅ **HTTP/2 explicite** via `node:http2`
- ✅ **Négociation ALPN**
- ✅ **Multiplexing** sur une seule connexion
- ✅ **Server push** (opt-in)

```typescript
import { client } from '@unireq/core';
import { http2 } from '@unireq/http2';

const h2Client = client(http2(), {
  base: 'https://http2.example.com'
});
```

<br/>

---

## Écosystème

Unireq est modulaire par conception. Vous n'installez que ce dont vous avez besoin.

### Packages Core

| Package | Description |
| :--- | :--- |
| [`@unireq/core`](fr/packages/core.md) | Factory client, composition, contrôle de flux et gestion des erreurs. |
| [`@unireq/http`](fr/packages/http.md) | Transport HTTP/1.1 standard basé sur `undici`. |
| [`@unireq/http2`](fr/packages/http2.md) | Transport HTTP/2 avec support du multiplexing. |

### Middleware & Utilitaires

| Package | Description |
| :--- | :--- |
| [`@unireq/oauth`](fr/packages/oauth.md) | Gestion des tokens OAuth 2.0 Bearer avec auto-refresh. |
| [`@unireq/cookies`](fr/packages/cookies.md) | Support de cookie jar pour les sessions avec état. |
| [`@unireq/xml`](fr/packages/xml.md) | Parsing et sérialisation XML. |
| [`@unireq/graphql`](fr/packages/graphql.md) | Support des requêtes et mutations GraphQL. |

### Adaptateurs de Protocole

| Package | Description |
| :--- | :--- |
| [`@unireq/imap`](fr/packages/imap.md) | Client IMAP pour la récupération d'emails. |
| [`@unireq/ftp`](fr/packages/ftp.md) | Client FTP/FTPS pour le transfert de fichiers. |

---

## Prochaines Étapes

- **[Démarrage Rapide](fr/guide/quick-start.md)** : Lancez-vous en quelques minutes.
- **[Tutoriels](fr/tutorials/getting-started.md)** : Guides étape par étape pour les scénarios courants.
- **[Exemples](fr/examples/basic.md)** : Snippets de code prêts à l'emploi.

---

<p align="center">
  <a href="#/fr/guide/quick-start">🚀 Commencer</a> · <a href="#/fr/packages/core">📦 Explorer les Packages</a> · <a href="#/fr/examples/basic">💻 Voir les Exemples</a>
</p>