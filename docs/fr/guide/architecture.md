# Architecture

## Catalogue des packages

| Package | Description |
|---------|-------------|
| **`@unireq/core`** | Factory client, `compose`, `either`, slots, erreurs DX |
| **`@unireq/http`** | Transport `http()` (Undici), policies HTTP, serializers/parsers, multipart, range, SSE |
| **`@unireq/http2`** | Transport `http2()` via `node:http2` avec ALPN |
| **`@unireq/oauth`** | Policy OAuth Bearer avec vérification JWT et refresh automatique |
| **`@unireq/cookies`** | Intégration `tough-cookie` + `http-cookie-agent/undici` |
| **`@unireq/xml`** | Parsing/sérialisation XML (`fast-xml-parser`) |
| **`@unireq/graphql`** | Helpers GraphQL pour requêtes/mutations typées |
| **`@unireq/imap`** | Transport IMAP (`imapflow`, XOAUTH2 prêt) |
| **`@unireq/ftp`** | Transport FTP/S (`basic-ftp`) |
| **`@unireq/presets`** | Clients clés en main (ex : `httpsJsonAuthSmart()`) |

Chaque package reste ciblé : les transports exposent des `capabilities` (`ctx.capabilities.http`, `imap`…), et les policies haut niveau s'appuient dessus pour s'assurer qu'elles ne tournent que lorsque le transport supporte la feature.

> **Envie de code immédiat ?** Revenez au [Démarrage Rapide](fr/guide/quick-start.md) pour un tutoriel guidé, puis consultez [Composition](fr/concepts/composition.md) pour toutes les règles d'ordre des policies.

## Vue en couches

```
┌───────────────────────────────┐
│  Apps / presets (@unireq/presets) │
├───────────────────────────────┤
│  Policies (oauth, cookies, xml) │
├───────────────────────────────┤
│  Pipeline core (@unireq/core)    │
├───────────────────────────────┤
│  Transports (http, http2, imap)  │
└───────────────────────────────┘
```

- **Transports** encapsulent les piles réseau (Undici, `node:http2`, `imapflow`, `basic-ftp`) et exposent des flags de capacité.
- **Core** fournit la composition déterministe, les slots de contexte, les erreurs typées et la résilience (`retry`, `backoff`, `timeout`).
- **Policies** sont pures : elles décrivent des transformations, peuvent court-circuiter, brancher (`either`) ou instrumenter (`interceptRequest`).
- **Presets** appellent juste `client(transport, ...policies)` pour livrer des clients prêts à l'emploi. Inspirez-vous de [packages/presets/src](../packages/presets/src).

## Flux de dépendances

- Les packages haut niveau dépendent de `@unireq/core` plus les transports/policies qu'ils enveloppent. Aucune dépendance circulaire.
- Les intégrations optionnelles (`oauth`, `cookies`, `xml`, `graphql`) sont tree-shakeable car elles exposent des fonctions pures + types.
- La doc et les exemples reflètent la même structure : copier un snippet de `/examples` dans `docs` fonctionne sans adaptation.

## Écrire vos propres policies

```ts
import { policy } from '@unireq/core';

export const trace = policy(async (ctx, next) => {
  const start = performance.now();
  const resp = await next({
    ...ctx,
    headers: { ...ctx.headers, traceparent: ctx.slots.traceId },
  });
  console.log('elapsed', performance.now() - start);
  return resp;
}, { name: 'trace', kind: 'observability' });
```

Bonnes pratiques :

1. **Pureté** – évitez les effets de bord globaux ; tout passe par `ctx` et les slots.
2. **Métadonnées** – renseignez `name/kind` pour l'inspection et les devtools.
3. **Ordre explicite** – observabilité à l'extérieur, résilience ensuite, auth près du transport, parsing en dernier (voir [composition](../fr/concepts/composition.md)).

## Carte du dépôt

- `packages/*/src` → code source de chaque package (TypeScript, bundlé via `tsup`).
- `examples/*.ts` → scripts exécutables démontrant transports/policies.
- `docs/` et `docs/fr/` → site Docsify bilingue.
- `scripts/` → outils (validation sidebar, run d'exemples).

Comprendre cette topologie aide à localiser rapidement les fonctionnalités et harmoniser les contributions.

## Philosophie de Conception

Unireq est construit sur une architecture composable et "pipe-first". Au lieu d'un client monolithique avec de nombreuses options de configuration, la fonctionnalité est construite en composant de petites policies (politiques) ciblées.

Cette approche offre plusieurs avantages :

- **Tree-shakeable** : Vous n'importez et ne bundlez que le code que vous utilisez réellement.
- **Flexible** : Les policies peuvent être réordonnées et combinées de manière puissante.
- **Extensible** : Il est facile d'écrire des policies personnalisées qui s'intègrent parfaitement.
- **Testable** : Les policies individuelles sont plus faciles à tester isolément.

---

<p align="center">
  <a href="#/fr/guide/quick-start">← Démarrage Rapide</a> · <a href="#/fr/tutorials/getting-started">Premiers Pas →</a>
</p>