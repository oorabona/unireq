# @unireq/http2

Transport HTTP/2 dédié basé sur le module `node:http2`. À utiliser lorsque vous avez besoin d'un vrai multiplexage, d'un contrôle explicite d'ALPN ou de tests de server push, plutôt que du transport HTTP/1.1 par défaut (Undici).

## Installation

```bash
pnpm add @unireq/http2
```

## Panorama des exports

| Export | Description |
| --- | --- |
| `http2(uri?, connector?)` | Retourne un `TransportWithCapabilities` (`streams`, `http2`, `serverPush`). Le `uri` optionnel sert de base pour les chemins relatifs. |
| `Http2Connector` | Connecteur par défaut utilisant `node:http2` (ALPN, cache de sessions, arrêt propre). |
| `Http2ConnectorOptions` | `{ enablePush?: boolean; sessionTimeout?: number }`. `enablePush` est réservé, `sessionTimeout` définit l'inactivité avant fermeture. |

## Client minimal

```ts
import { client, retry, backoff } from '@unireq/core';
import { http2, Http2Connector } from '@unireq/http2';

const h2 = client(
  http2('https://h2.exemple.com', new Http2Connector({ sessionTimeout: 45_000 })),
  retry(undefined, [backoff()], { tries: 3 })
);

const resp = await h2.get('/produits');
```

- Sans base `uri`, vous devez appeler le client avec des URLs absolues.
- La première requête ouvre la session HTTP/2, les suivantes la réutilisent jusqu'à `GOAWAY` ou expiration.

## Résolution d'URL

- `http2('https://api.exemple.com')` + requête `/foo` ⇒ la base est préfixée. Une URL absolue (`https://cdn.exemple.com/bar`) contourne la base et crée une session pour ce nouvel origin.
- Sans base, aucune supposition possible : fournissez des URLs complètes.

## Connecteurs personnalisés

```ts
class InstrumentedConnector extends Http2Connector {
  async request(client, ctx) {
    const start = performance.now();
    try {
      return await super.request(client, ctx);
    } finally {
      metrics.timing('http2.duree', performance.now() - start, { method: ctx.method });
    }
  }
}

const api = client(http2('https://api.interne', new InstrumentedConnector()));
```

Tout connecteur doit respecter l'interface `Connector` (`connect`, `request`, `disconnect?`). Cela permet d'envelopper `nghttp2`, un proxy ou d'instrumenter les sessions.

## Server push & streaming

- La capability `streams: true` informe vos policies que les flux chunkés sont autorisés.
- Le connecteur par défaut ignore encore les `PUSH_PROMISE`. Étendez-le et écoutez `session.on('stream')` si vous devez exploiter le push.

## Gestion des erreurs

- Échecs réseau, `GOAWAY` ou timeouts rejettent la promesse : entourez le transport de `retry`/`backoff` si nécessaire.
- Les sessions défaillantes sont retirées du cache automatiquement ; appelez `connector.disconnect()` lors du shutdown pour tout fermer proprement.
- Les réponses incluent `status`, `ok`, `headers` et `data` décodé intelligemment : JSON pour `application/json`, string pour `text/*`, sinon un `ArrayBuffer` pour conserver les binaires.

---

<p align="center">
  <a href="#/fr/packages/http">← HTTP</a> · <a href="#/fr/packages/oauth">OAuth →</a>
</p>