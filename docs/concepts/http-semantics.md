# HTTP Semantics References

## Redirects

- **307 Temporary Redirect** — Preserves method and body ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307), [RFC 9110 §15.4.8](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.8))
- **308 Permanent Redirect** — Preserves method and body ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/308), [RFC 9110 §15.4.9](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.9))
- **303 See Other** — Converts to GET (opt-in via `follow303`) ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303), [RFC 9110 §15.4.4](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.4))

```ts
redirectPolicy({ allow: [307, 308], follow303: false });
```

## Rate Limiting

- **429 Too Many Requests** + `Retry-After` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429), [RFC 6585](https://datatracker.ietf.org/doc/html/rfc6585))
- **503 Service Unavailable** + `Retry-After` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503), [RFC 9110 §15.6.4](https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.4))

```ts
import { retry } from '@unireq/core';
import { httpRetryPredicate, rateLimitDelay } from '@unireq/http';

retry(
  httpRetryPredicate({ statusCodes: [429, 503] }),
  [rateLimitDelay({ maxWait: 60000 })],
  { tries: 3 }
);
```

## Range Requests

- **206 Partial Content** — Server sends requested byte range ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206), [RFC 7233](https://datatracker.ietf.org/doc/html/rfc7233))
- **416 Range Not Satisfiable** — Invalid range ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416), [RFC 7233 §4.4](https://datatracker.ietf.org/doc/html/rfc7233#section-4.4))
- **`Accept-Ranges: bytes`** — Server supports ranges ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Ranges))

```ts
range({ start: 0, end: 1023 }); // Request first 1KB
resume({ downloaded: 5000 }); // Resume from byte 5000
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

- **RFC 6750** — Bearer token usage ([spec](https://datatracker.ietf.org/doc/html/rfc6750))

```ts
oauthBearer({
  tokenSupplier: async () => getAccessToken(),
  skew: 60, // Clock skew tolerance (seconds)
  autoRefresh: true // Refresh on 401
});
```

---

<p align="center">
  <a href="#/concepts/body-parsing">← Body & Parsing</a> · <a href="#/packages/core">Core Package →</a>
</p>