# @unireq/cookies

[![npm version](https://img.shields.io/npm/v/@unireq/cookies.svg)](https://www.npmjs.com/package/@unireq/cookies)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Cookie jar integration with `tough-cookie` and `http-cookie-agent/undici`. Automatically reads cookies before requests and persists `Set-Cookie` headers, with CRLF injection protection.

## Installation

```bash
pnpm add @unireq/cookies tough-cookie
```

## Quick Start

```typescript
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

## Features

| Symbol | Description |
| --- | --- |
| `cookieJar(jar)` | Policy that syncs the jar with every request/response |
| `CookieJar` | Minimal interface compatible with `tough-cookie` |

## Custom Storage

```typescript
const customJar = {
  async getCookieString(url: string) {
    return redis.get(`cookie:${url}`) ?? '';
  },
  async setCookie(cookie: string, url: string) {
    await redis.set(`cookie:${url}`, cookie);
  },
};

const api = client(http(), cookieJar(customJar));
```

## Security

- Rejects cookies containing CR/LF characters (OWASP A03:2021 mitigation)
- Place `cookieJar()` close to the transport for proper retry handling

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
