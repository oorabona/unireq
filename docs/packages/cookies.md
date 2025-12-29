# @unireq/cookies

Cookie jar integration with [`tough-cookie`](https://www.npmjs.com/package/tough-cookie) and `http-cookie-agent/undici`. The policy automatically reads cookies before the request and persists new `Set-Cookie` headers afterward, with CRLF hardening baked in.

## Installation

```bash
pnpm add @unireq/cookies tough-cookie
```

## Exports

| Symbol | Description |
| --- | --- |
| `cookieJar(jar: CookieJar)` | Policy that syncs the provided jar with every request/response. |
| `CookieJar` | Minimal interface (`getCookieString`, `setCookie`) compatible with `tough-cookie` or custom stores. |

## Basic usage

```ts
import { client } from '@unireq/core';
import { http, headers, parse } from '@unireq/http';
import { CookieJar } from 'tough-cookie';
import { cookieJar } from '@unireq/cookies';

const jar = new CookieJar();

const api = client(
  http('https://api.example.com'),
  headers({ 'user-agent': 'unireq/1.0' }),
  cookieJar(jar),
  parse.json(),
);

const profile = await api.get('/me');
```

- The policy fetches cookies via `jar.getCookieString(ctx.url)` and injects them as the `Cookie` header.
- After the response settles, it stores any `Set-Cookie` header with `jar.setCookie(cookie, ctx.url)`.

## Persistent storage / custom adapters

`CookieJar` is intentionally tiny. To plug in Redis, SQLite, or encrypted storage, implement the two methods:

```ts
const customJar = {
  async getCookieString(url: string) {
    return redis.get(`cookie:${url}`) ?? '';
  },
  async setCookie(cookie: string, url: string) {
    await redis.set(`cookie:${url}`, merge(cookie));
  },
};

const api = client(http(), cookieJar(customJar));
```

> **Tip:** `tough-cookie` already ships filesystem stores (`FileCookieStore`, etc.). Wrap those if you need persistence without re-inventing parsing logic.

## Proxy & Undici integration

If you rely on custom agents or corporate proxies, pair the same jar with `http-cookie-agent/undici` so both the policy and the underlying connector stay in sync:

```ts
import { CookieAgent } from 'http-cookie-agent/undici';
import { setGlobalDispatcher } from 'undici';

const jar = new CookieJar();
const agent = new CookieAgent({ cookies: { jar } });
setGlobalDispatcher(agent);

const api = client(http('https://api.example.com'), cookieJar(jar));
```

## Security & ordering

- The policy rejects any cookie or `Set-Cookie` value that contains CR/LF characters to mitigate header injection (OWASP A03:2021).
- Place `cookieJar()` close to the transport—after observability/retry policies but before parsing—so every replayed attempt reuses the latest jar contents and newly issued cookies are captured even when retries occur.
- Combine with `@unireq/oauth` or other auth policies as needed; cookies complement token-based auth for hybrid flows.

---

<p align="center">
  <a href="#/packages/oauth">← OAuth</a> · <a href="#/packages/xml">XML →</a>
</p>
