# Qu'est-ce qu'Unireq ?

Unireq est un kit I/O pipe-first et tree-shakeable pour Node.js. Chaque comportement — retry, auth, cache, rate-limiting, observabilité — est une **Policy** composable que l'on branche dans un pipeline. Pas d'objet de configuration monolithique, pas de clé magique, pas de file d'intercepteurs cachée.

Si vous connaissez le modèle middleware de Koa ou Express, vous comprenez déjà le fonctionnement.

---

## Le problème

Tous les grands clients HTTP finissent par développer un système d'intercepteurs. Et ça fonctionne — jusqu'au moment où vous en avez six, que trois packages ont ajouté les leurs, que l'état est partagé à travers une instance mutable, et qu'un retry se déclenche *après* votre rafraîchissement de token mais *avant* que votre logger n'ait vu l'erreur.

Déboguer ça, c'est lire le code source de la bibliothèque, pas le vôtre. Le tester, c'est mocker l'instance et espérer que rien d'autre n'y a touché.

---

## La solution

```ts
import { client, retry, backoff, throttle } from '@unireq/core';
import { http, headers, parse, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),          // transport
  headers({ 'user-agent': 'myapp/1.0' }),   // sortant
  throttle({ rps: 50 }),                    // débit
  retry(
    httpRetryPredicate({ statusCodes: [429, 503] }),
    [rateLimitDelay(), backoff({ initial: 100, max: 5000 })],
    { tries: 3 }
  ),
  oauthBearer({ tokenSupplier: getToken }), // auth
  parse.json()                              // entrant
);

const user = await api.get<User>('/users/42');
```

L'ordre est explicite et lisible. Chaque ligne est une fonction pure, indépendante, testable unitairement. Déplacer une ligne, c'est changer le comportement. Sans surprise.

---

## Les concepts clés

### Tout est une Policy

```ts
type Policy = (ctx: RequestContext, next: Next) => Promise<Response>
```

Une Policy intercepte la requête à l'aller, appelle `next()` pour déléguer au reste de la chaîne, et intercepte la réponse au retour. Ce contrat est identique que vous fassiez un retry, que vous injectiez un Bearer token, que vous écriviez une couche de cache ou que vous émettiez un span OpenTelemetry.

Écrire une Policy personnalisée tient en quatre lignes :

```ts
import { policy } from '@unireq/core';

export const requestId = policy(async (ctx, next) => {
  return next({ ...ctx, headers: { ...ctx.headers, 'x-request-id': crypto.randomUUID() } });
}, { name: 'requestId', kind: 'observability' });
```

### Composer, pas configurer

`client()` est une fine couche autour de `compose()`. Les policies s'exécutent **de l'extérieur vers l'intérieur** sur la requête et **de l'intérieur vers l'extérieur** sur la réponse — exactement comme un oignon :

```
requête →
  [headers]
    [throttle]
      [retry]
        [oauthBearer]
          [parse.json]
            [transport]         ← I/O réel
          [parse.json]
        [oauthBearer]
      [retry]
    [throttle]
  [headers]
← réponse
```

Cela signifie que `retry` enveloppe `oauthBearer` : si le token est expiré, auth le rafraîchit, puis retry rejoue la requête avec le token valide — dans le bon ordre, à chaque fois, sans configuration particulière.

### Multi-protocole, une seule API

Le transport est simplement un argument. On le remplace, et les mêmes policies s'appliquent :

```ts
import { client } from '@unireq/core';
import { http }  from '@unireq/http';
import { http2 } from '@unireq/http2';
import { imap }  from '@unireq/imap';
import { ftp }   from '@unireq/ftp';

const rest  = client(http('https://api.example.com'),  parse.json());
const fast  = client(http2('https://grpc.example.com'), parse.json());
const mail  = client(imap({ host: 'imap.example.com', auth }));
const files = client(ftp({ host: 'ftp.example.com', user, password }));
```

Les policies d'auth, la logique de retry, l'observabilité — tout est réutilisable entre les transports.

### Résultats fortement typés

Unireq embarque un type `Result<T, E>` (union Ok | Err) pour ne plus jamais écrire un try/catch pour les erreurs récupérables :

```ts
const result = await api.safe.get<User[]>('/users');

if (result.isOk()) {
  return result.value.data;   // TypeScript sait que c'est User[]
}

// Style fonctionnel
const names = result.map(res => res.data.map(u => u.name));

// Avec une valeur par défaut
const count = result.unwrapOr([]).length;
```

`api.safe.*` reflète chaque méthode du client normal. Pas de classe séparée — juste un namespace.

---

## Performances

Le transport `http()` d'Unireq est construit sur [undici](https://github.com/nodejs/undici) — le même moteur qui alimente le `fetch` natif de Node.js. Connection pooling et pipelining HTTP/1.1 sont actifs par défaut.

| Scénario | Débit |
|----------|-------|
| Requête unique, sans policy | ≈ fetch natif |
| 100 requêtes concurrentes | 26–32 % plus rapide qu'axios / got |
| Stack de 7 policies (retry + auth + parse + otel) | +12 % de surcoût vs zéro policy |

> Méthodologie et chiffres bruts disponibles dans [BENCHMARKS.md](../BENCHMARKS.md).

La surcharge du pipeline de policies est négligeable devant la latence réseau. Le gain vient du fait que l'on ne paie que les fonctionnalités effectivement composées.

---

## Ce qui est inclus

| Package | Rôle |
|---------|------|
| **`@unireq/core`** | `client`, `compose`, `retry`, `backoff`, `throttle`, `circuitBreaker`, `Result` |
| **`@unireq/http`** | Transport `http()` (undici), `parse`, `body`, `headers`, SSE, multipart, range |
| **`@unireq/http2`** | Transport `http2()` avec ALPN + session pooling |
| **`@unireq/oauth`** | Injection Bearer, rafraîchissement automatique, validation JWKS |
| **`@unireq/cookies`** | Cookie jar avec intégration `http-cookie-agent` |
| **`@unireq/xml`** | Parsing / sérialisation XML via `fast-xml-parser` |
| **`@unireq/graphql`** | Requêtes GraphQL typées sur HTTP |
| **`@unireq/imap`** | Transport IMAP via `imapflow` (XOAUTH2 prêt) |
| **`@unireq/ftp`** | Transport FTP/S via `basic-ftp` |
| **`@unireq/smtp`** | Transport SMTP pour l'envoi d'e-mails |
| **`@unireq/otel`** | Traces et métriques OpenTelemetry en tant que policy |
| **`@unireq/config`** | Constantes partagées, valeurs de sécurité par défaut, variables `UNIREQ_*` |
| **`@unireq/presets`** | Builder fluent + clients clés en main (`httpClient`, `preset.api.*`) |
| **`@unireq/cli`** | REPL interactif + mode one-shot — style curl, compatible OpenAPI |

Chaque package est tree-shakeable. On importe uniquement ce que l'on compose.

---

## Prêt ?

```bash
pnpm add @unireq/core @unireq/http @unireq/presets
```

- **[Démarrage Rapide](guide/quick-start.md)** — Premier client en moins de deux minutes.
- **[Architecture](guide/architecture.md)** — Organisation des packages et règles de couches.
- **[Comparaison](guide/comparison.md)** — Comparaison honnête avec axios, got, ky, undici.

---

<p align="center">
  <a href="#/fr/README">← Accueil</a> · <a href="#/fr/guide/quick-start">Démarrage Rapide →</a>
</p>
