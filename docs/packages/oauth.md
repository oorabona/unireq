# @unireq/oauth

OAuth 2.0 Bearer authentication with JWT verification, proactive expiry checks, and automatic refresh on `401`.

## Installation

```bash
pnpm add @unireq/oauth
```

## Exports

| Symbol | Description |
| --- | --- |
| `oauthBearer(options)` | Policy that injects `Authorization: Bearer <token>` and handles refresh cycles. |
| `OAuthBearerOptions` | Options bag (token supplier, JWKS, skew, autoRefresh, hooks). |
| `TokenSupplier` | `() => string | Promise<string>` used lazily for tokens. |
| `JWKSSource` | `{ type: 'url'; url }` or `{ type: 'key'; key }` for JWT signature verification. |

## Basic usage

```ts
import { client, retry } from '@unireq/core';
import { http, parse, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  retry(httpRetryPredicate(), [rateLimitDelay({ maxWait: 60_000 })]), // resilience stays outside auth
  oauthBearer({
    tokenSupplier: async () => getAccessTokenFromVault(),
    jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
    skew: 60,
    onRefresh: () => trace('refreshing token'),
  }),
  parse.json(),
);
```

Because the policy chain is an onion, **retry/metrics policies should wrap `oauthBearer`**, so the OAuth layer can inspect every response (including `401`) before the retry predicate decides whether to replay. This prevents a retry loop with stale tokens and guarantees that refreshed attempts stay authenticated.

## Token supplier and caching

- `tokenSupplier` runs lazily and only when needed; the value is cached in the policy closure.
- Concurrent requests share a single-flight refresh lock, so multiple inflight calls wait for the same token.
- You can return raw strings, `Promise<string>`, or integrate with any secrets manager.

## JWT expiry & verification

- `jwks` is **strongly recommended** for signature verification. Provide either a JWKS URL (fetched and cached with `jose`) or a static PEM public key.
- `skew` (default `60` seconds) adds a safety buffer so tokens are refreshed slightly before they expire.
- If you cannot provide JWKS (development only), set `allowUnsafeMode: true`. The policy will warn loudly because the token signature is not verified; do **not** ship this mode to production.

```ts
const secureAuth = oauthBearer({
  tokenSupplier: () => idp.issue(),
  jwks: { type: 'key', key: process.env.OAUTH_PUBLIC_KEY! },
});

const unsafeDevAuth = oauthBearer({
  tokenSupplier: getLocalToken,
  allowUnsafeMode: true, // logs warning, no signature verification
});
```

## Auto-refresh and replay logic

- The policy inspects `WWW-Authenticate` when a response returns `401` and contains `Bearer`.
- When `autoRefresh` is true (default), it invokes `tokenSupplier` (single-flight), updates the cache, and replays the request **once**.
- Hook into `onRefresh` to emit metrics or trace spans whenever a refresh occurs.

```ts
const auth = oauthBearer({
  tokenSupplier: rotate,
  autoRefresh: true,
  onRefresh: () => metrics.increment('oauth.refresh'),
});
```

### Ordering reminders

- Place observability/logging outside both `retry` and `oauthBearer` to see the entire attempt history.
- Keep serialization/parsing policies (e.g., `body.json`, `parse.json`) inside OAuth so each replay reuses the latest headers/payload processing.

## Troubleshooting

### "Token verification failed" or JWT errors

**Cause:** JWKS not configured or token signature mismatch.

**Fix:** Verify JWKS configuration matches your identity provider:

```typescript
// Option 1: JWKS URL (recommended)
oauthBearer({
  tokenSupplier: getToken,
  jwks: { type: 'url', url: 'https://your-idp.com/.well-known/jwks.json' },
})

// Option 2: Static public key
oauthBearer({
  tokenSupplier: getToken,
  jwks: { type: 'key', key: process.env.OAUTH_PUBLIC_KEY },
})
```

### Token refresh loop (infinite 401s)

**Cause:** Token supplier returns the same stale token after refresh.

**Fix:** Ensure `tokenSupplier` returns a fresh token:

```typescript
let cachedToken: string | null = null;

oauthBearer({
  tokenSupplier: async () => {
    if (!cachedToken || isExpired(cachedToken)) {
      cachedToken = await fetchNewToken();
    }
    return cachedToken;
  },
  onRefresh: () => {
    cachedToken = null; // Clear cache on 401
  },
})
```

### "allowUnsafeMode is required" warning

**Cause:** No JWKS configured in production.

**Fix:** Always configure JWKS for production. Only use `allowUnsafeMode` in development:

```typescript
oauthBearer({
  tokenSupplier: getToken,
  // Development only - never in production!
  allowUnsafeMode: process.env.NODE_ENV === 'development',
})
```

### Token expires mid-request

**Cause:** Token TTL is too short or `skew` is too small.

**Fix:** Increase the skew buffer:

```typescript
oauthBearer({
  tokenSupplier: getToken,
  skew: 120, // Refresh 2 minutes before expiry (default: 60)
})
```

### Concurrent requests fail during refresh

**Cause:** Multiple requests hitting 401 simultaneously without proper locking.

**Fix:** The policy handles this automatically with single-flight refresh. Ensure you're using a single client instance:

```typescript
// Good - single client, shared refresh lock
const api = client(http('...'), oauthBearer({ tokenSupplier }));

// Bad - multiple clients, separate refresh locks
const api1 = client(http('...'), oauthBearer({ tokenSupplier }));
const api2 = client(http('...'), oauthBearer({ tokenSupplier }));
```

### "UnsupportedAuthForTransport" error

**Cause:** Using OAuth with a transport that doesn't support it (e.g., FTP without OAuth).

**Fix:** Check transport capabilities or use appropriate auth:

```typescript
// OAuth works with HTTP/HTTP2
const httpApi = client(http('...'), oauthBearer({ tokenSupplier }));

// For FTP, use credentials in URI instead
const ftpApi = client(ftp('ftp://user:pass@server.com'));
```

---

<p align="center">
  <a href="#/packages/http2">&larr; HTTP/2</a> &middot; <a href="#/packages/cookies">Cookies &rarr;</a>
</p>
