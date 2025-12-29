# @unireq/config

Centralized defaults for transports, retries, multipart uploads, OAuth, and security hardening. Every package in the monorepo consumes these constants so you can override behaviour via environment variables without rewriting code.

## Installation

```bash
pnpm add @unireq/config
```

## Export overview

| Export | Description |
| --- | --- |
| `HTTP_CONFIG` | Timeouts, redirect policy, retry status codes/methods, rate-limit handling. |
| `MULTIPART_CONFIG` | Max file size, filename sanitization, allowed MIME lists. |
| `OAUTH_CONFIG` | JWT clock skew, auto-refresh toggle. |
| `SECURITY_CONFIG` | CRLF validation pattern, filename sanitization rules. |
| `CONTENT_CONFIG` | Default `Accept` lists and canonical content-types. |
| `RANGE_CONFIG` | Default chunk size/unit for range downloads. |
| `CONFIG` / `UnireqConfig` | Aggregate object + type if you prefer a single import.

Every constant is tree-shakeable. Import only what your custom policies need.

## Using the defaults

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

Because the defaults are plain objects, you can spread/override them when composing policies or presets.

## Environment overrides

Each section reads from `process.env` at import time. Set these variables to override the defaults without touching code:

| Variable | Controls | Default |
| --- | --- | --- |
| `UNIREQ_HTTP_TIMEOUT` | `HTTP_CONFIG.DEFAULT_TIMEOUT` (ms) | `30000` |
| `UNIREQ_MULTIPART_MAX_FILE_SIZE` | Maximum file size for uploads (bytes) | `100000000` (100 MB) |
| `UNIREQ_MULTIPART_SANITIZE_FILENAMES` | Enable filename sanitization | `true` |
| `UNIREQ_JWT_CLOCK_SKEW` | JWT expiration tolerance (seconds) | `60` |
| `UNIREQ_OAUTH_AUTO_REFRESH` | Auto-refresh tokens on 401 | `true` |

Unset variables fall back to the secure defaults baked into the package.

## Multipart security helper

```ts
import { MULTIPART_CONFIG } from '@unireq/config';
import { createMultipartUpload } from '@unireq/presets';

const upload = createMultipartUpload(files, fields, {
  maxFileSize: MULTIPART_CONFIG.MAX_FILE_SIZE,
  allowedMimeTypes: MULTIPART_CONFIG.DEFAULT_ALLOWED_MIME_TYPES,
  sanitizeFilenames: MULTIPART_CONFIG.SANITIZE_FILENAMES,
});
```

The curated MIME lists map to OWASP recommendations, preventing unrestricted file uploads by default.

## OAuth & security policies

```ts
import { OAUTH_CONFIG, SECURITY_CONFIG } from '@unireq/config';
import { oauthBearer } from '@unireq/oauth';

const auth = oauthBearer({
  tokenSupplier,
  skew: OAUTH_CONFIG.JWT_CLOCK_SKEW,
  autoRefresh: OAUTH_CONFIG.AUTO_REFRESH,
});

SECURITY_CONFIG.CRLF_VALIDATION.PATTERN.test('value'); // reuse in custom policies
```

Sharing the same config constants across cookies, oauth, and multipart ensures all policies enforce the same hardening rules.

## Type-safe bag

```ts
import CONFIG, { type UnireqConfig } from '@unireq/config';

function bootstrap(config: UnireqConfig) {
  console.log('timeouts', config.HTTP.DEFAULT_TIMEOUT);
}

bootstrap(CONFIG);
```

Use the aggregate object if you want to pass defaults around (for example into a preset factory) while retaining static types.

---

<p align="center">
  <a href="#/packages/presets">← Presets</a> · <a href="#/README">Home →</a>
</p>