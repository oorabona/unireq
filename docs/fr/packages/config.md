# @unireq/config

Valeurs par défaut centralisées pour les transports, retries, uploads multipart, OAuth et durcissement sécurité. Tous les packages s'appuient dessus, vous pouvez donc surcharger le comportement via des variables d'environnement partagées.

## Installation

```bash
pnpm add @unireq/config
```

## Panorama des exports

| Export | Description |
| --- | --- |
| `HTTP_CONFIG` | Timeout, redirects, status codes/méthodes éligibles au retry, gestion de rate-limit. |
| `MULTIPART_CONFIG` | Taille max fichier, sanitization des noms, listes MIME sûres. |
| `OAUTH_CONFIG` | Skew JWT et auto-refresh. |
| `SECURITY_CONFIG` | Regex CRLF, patterns anti path traversal. |
| `CONTENT_CONFIG` | Accept par défaut et content-types canoniques. |
| `RANGE_CONFIG` | Chunk size/unit pour downloads partiels. |
| `CONFIG` / `UnireqConfig` | Objet agrégé + type pour tout passer d'un bloc. |

Chaque objet est tree-shakeable : importez seulement ce qu'il vous faut.

## Exploiter les valeurs par défaut

```ts
import { client, retry, backoff } from '@unireq/core';
import { http, redirectPolicy, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { HTTP_CONFIG } from '@unireq/config';

const api = client(
  http('https://api.example.com'),
  redirectPolicy({
    allow: HTTP_CONFIG.REDIRECT.ALLOWED_STATUS_CODES,
    max: HTTP_CONFIG.REDIRECT.MAX_REDIRECTS,
  }),
  retry(
    httpRetryPredicate({
      methods: HTTP_CONFIG.RETRY.RETRY_METHODS,
      statusCodes: HTTP_CONFIG.RETRY.RETRY_STATUS_CODES,
    }),
    [
      rateLimitDelay({ maxWait: HTTP_CONFIG.RATE_LIMIT.MAX_WAIT }),
      backoff({ initial: HTTP_CONFIG.RETRY.INITIAL_BACKOFF, max: HTTP_CONFIG.RETRY.MAX_BACKOFF }),
    ],
    { tries: HTTP_CONFIG.RETRY.MAX_TRIES },
  ),
);
```

Les objets étant immuables, libre à vous de les cloner/étendre avant de les passer à vos policies.

## Surcharger via l'environnement

Les variables sont lues au `require()`/`import`. Les plus courantes :

| Variable | Impact | Défaut |
| --- | --- | --- |
| `UNIREQ_HTTP_TIMEOUT` | Timeout global (ms) | `30000` |
| `UNIREQ_MULTIPART_MAX_FILE_SIZE` | Taille max uploads (octets) | `100000000` (100 Mo) |
| `UNIREQ_MULTIPART_SANITIZE_FILENAMES` | Sanitization des noms de fichiers | `true` |
| `UNIREQ_JWT_CLOCK_SKEW` | Tolérance expiration JWT (secondes) | `60` |
| `UNIREQ_OAUTH_AUTO_REFRESH` | Auto-rafraîchissement des tokens sur 401 | `true` |

Si la variable est absente, la valeur reste celle recommandée par défaut.

## Sécurité Multipart

```ts
import { MULTIPART_CONFIG } from '@unireq/config';
import { createMultipartUpload } from '@unireq/presets';

const upload = createMultipartUpload(files, fields, {
  maxFileSize: MULTIPART_CONFIG.MAX_FILE_SIZE,
  allowedMimeTypes: MULTIPART_CONFIG.DEFAULT_ALLOWED_MIME_TYPES,
  sanitizeFilenames: MULTIPART_CONFIG.SANITIZE_FILENAMES,
});
```

Les listes MIME suivent les recommandations OWASP pour éviter les uploads arbitraires.

## OAuth & règles de sécurité

```ts
import { OAUTH_CONFIG, SECURITY_CONFIG } from '@unireq/config';
import { oauthBearer } from '@unireq/oauth';

const auth = oauthBearer({
  tokenSupplier,
  skew: OAUTH_CONFIG.JWT_CLOCK_SKEW,
  autoRefresh: OAUTH_CONFIG.AUTO_REFRESH,
});

SECURITY_CONFIG.CRLF_VALIDATION.PATTERN.test('value');
```

Réutilisez la même regex CRLF dans vos policies custom (headers, cookies, etc.) pour rester cohérent avec le core.

## Objet agrégé type-safe

```ts
import CONFIG, { type UnireqConfig } from '@unireq/config';

function bootstrap(config: UnireqConfig) {
  console.log(config.HTTP.DEFAULT_TIMEOUT);
}

bootstrap(CONFIG);
```

Pratique pour injecter toute la configuration dans un preset maison ou un container DI tout en gardant l'autocomplétion TypeScript.

---

<p align="center">
  <a href="#/fr/packages/presets">← Presets</a> · <a href="#/fr/README">Accueil →</a>
</p>