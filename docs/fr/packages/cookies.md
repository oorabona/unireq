# @unireq/cookies

Intégration cookie jar avec [`tough-cookie`](https://www.npmjs.com/package/tough-cookie) et `http-cookie-agent/undici`. La policy lit automatiquement les cookies avant la requête et enregistre les `Set-Cookie` après la réponse, avec durcissement anti CRLF.

## Installation

```bash
pnpm add @unireq/cookies tough-cookie
```

## Exports

| Symbole | Description |
| --- | --- |
| `cookieJar(jar: CookieJar)` | Policy qui synchronise le jar fourni sur chaque requête/réponse. |
| `CookieJar` | Interface minimale (`getCookieString`, `setCookie`) compatible `tough-cookie` ou implémentations maison. |

## Exemple de base

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

const profil = await api.get('/me');
```

- `jar.getCookieString(ctx.url)` fournit les cookies à ajouter dans l'en-tête `Cookie`.
- `jar.setCookie(cookie, ctx.url)` est appelé pour chaque `Set-Cookie` reçu.

## Stockages persistants / adaptateurs custom

`CookieJar` reste volontairement léger. Branchez Redis, SQLite ou tout autre backend en implémentant simplement les deux méthodes :

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

> **Astuce :** `tough-cookie` propose déjà des stores fichiers (`FileCookieStore`, …). Enveloppez-les pour obtenir de la persistance sans réécrire le parsing.

## Proxy & intégration Undici

Pour les proxys/agents personnalisés, couplez le même jar avec `http-cookie-agent/undici` afin que le connecteur Undici et la policy partagent l'état :

```ts
import { CookieAgent } from 'http-cookie-agent/undici';
import { setGlobalDispatcher } from 'undici';

const jar = new CookieJar();
const agent = new CookieAgent({ cookies: { jar } });
setGlobalDispatcher(agent);

const api = client(http('https://api.example.com'), cookieJar(jar));
```

## Sécurité & ordre

- La policy rejette tout cookie contenant CR/LF pour éviter les injections d'en-têtes (OWASP A03:2021).
- Placez `cookieJar()` près du transport—après observabilité/retry mais avant le parsing—pour que chaque retry réutilise les cookies courants et capture les nouveaux `Set-Cookie` même en cas de rejouage.
- Combinez librement avec `@unireq/oauth` ou d'autres mécanismes d'authentification.

---

<p align="center">
  <a href="#/fr/packages/oauth">← OAuth</a> · <a href="#/fr/packages/xml">XML →</a>
</p>
