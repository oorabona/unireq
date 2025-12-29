# @unireq/oauth

[![npm version](https://img.shields.io/npm/v/@unireq/oauth.svg)](https://www.npmjs.com/package/@unireq/oauth)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OAuth 2.0 Bearer authentication with JWT verification, proactive expiry checks, and automatic refresh on `401`.

## Installation

```bash
pnpm add @unireq/oauth
```

## Quick Start

```typescript
import { client, retry } from '@unireq/core';
import { http, parse, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  retry(httpRetryPredicate(), [rateLimitDelay({ maxWait: 60_000 })]),
  oauthBearer({
    tokenSupplier: async () => getAccessTokenFromVault(),
    jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
    skew: 60,
    onRefresh: () => trace('refreshing token'),
  }),
  parse.json(),
);
```

## Features

| Symbol | Description |
| --- | --- |
| `oauthBearer(options)` | Injects `Authorization: Bearer` and handles refresh |
| `OAuthBearerOptions` | Token supplier, JWKS, skew, autoRefresh, hooks |
| `TokenSupplier` | `() => string \| Promise<string>` |
| `JWKSSource` | URL or static key for JWT verification |

## JWT Verification

```typescript
// JWKS URL (recommended)
oauthBearer({
  tokenSupplier: getToken,
  jwks: { type: 'url', url: 'https://idp.example.com/.well-known/jwks.json' },
});

// Static public key
oauthBearer({
  tokenSupplier: getToken,
  jwks: { type: 'key', key: process.env.OAUTH_PUBLIC_KEY },
});
```

## Auto-Refresh

- Inspects `WWW-Authenticate` on `401` responses
- Invokes `tokenSupplier` (single-flight) and replays the request
- Concurrent requests share a single refresh lock

## Policy Ordering

```typescript
// Correct - retry outside auth
const api = client(
  http('...'),
  retry(httpRetryPredicate(), [backoff()]),  // outer
  oauthBearer({ tokenSupplier }),            // inner
  parse.json(),
);
```

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
