# Références Sémantiques HTTP

## Redirections

- **307 Temporary Redirect** — Préserve la méthode et le corps ([MDN](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/307), [RFC 9110 §15.4.8](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.8))
- **308 Permanent Redirect** — Préserve la méthode et le corps ([MDN](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/308), [RFC 9110 §15.4.9](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.9))
- **303 See Other** — Convertit en GET (opt-in via `follow303`) ([MDN](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/303), [RFC 9110 §15.4.4](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.4))

```ts
redirectPolicy({ allow: [307, 308], follow303: false });
```

## Limitation de Débit (Rate Limiting)

- **429 Too Many Requests** + `Retry-After` ([MDN](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/429), [RFC 6585](https://datatracker.ietf.org/doc/html/rfc6585))
- **503 Service Unavailable** + `Retry-After` ([MDN](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/503), [RFC 9110 §15.6.4](https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.4))

```ts
import { retry } from '@unireq/core';
import { httpRetryPredicate, rateLimitDelay } from '@unireq/http';

retry(
  httpRetryPredicate({ statusCodes: [429, 503] }),
  [rateLimitDelay({ maxWait: 60000 })],
  { tries: 3 }
);
```

## Requêtes de Plage (Range Requests)

- **206 Partial Content** — Le serveur envoie la plage d'octets demandée ([MDN](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/206), [RFC 7233](https://datatracker.ietf.org/doc/html/rfc7233))
- **416 Range Not Satisfiable** — Plage invalide ([MDN](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/416), [RFC 7233 §4.4](https://datatracker.ietf.org/doc/html/rfc7233#section-4.4))
- **`Accept-Ranges: bytes`** — Le serveur supporte les plages ([MDN](https://developer.mozilla.org/fr/docs/Web/HTTP/Headers/Accept-Ranges))

```ts
range({ start: 0, end: 1023 }); // Demande le premier 1KB
resume({ downloaded: 5000 }); // Reprend à l'octet 5000
```

## Multipart Form Data

- **RFC 7578** — `multipart/form-data` ([spec](https://datatracker.ietf.org/doc/html/rfc7578))

```ts
multipart(
  [{ name: 'file', filename: 'doc.pdf', data: blob, contentType: 'application/pdf' }],
  [{ name: 'title', value: 'My Document' }]
);
```

## OAuth 2.0 Bearer

- **RFC 6750** — Utilisation du token Bearer ([spec](https://datatracker.ietf.org/doc/html/rfc6750))

```ts
oauthBearer({
  tokenSupplier: async () => getAccessToken(),
  skew: 60, // Tolérance de décalage d'horloge (secondes)
  autoRefresh: true // Rafraîchit sur 401
});
```

---

<p align="center">
  <a href="#/fr/concepts/body-parsing">← Corps & Parsing</a> · <a href="#/fr/packages/core">Package Core →</a>
</p>