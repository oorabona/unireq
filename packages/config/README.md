# @unireq/config

[![npm version](https://img.shields.io/npm/v/@unireq/config.svg)](https://www.npmjs.com/package/@unireq/config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Centralized defaults for transports, retries, multipart uploads, OAuth, and security hardening. Override behaviour via environment variables without rewriting code.

## Installation

```bash
pnpm add @unireq/config
```

## Quick Start

```typescript
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
    [rateLimitDelay({ maxWait: HTTP_CONFIG.RATE_LIMIT.MAX_WAIT }), backoff()],
    { tries: HTTP_CONFIG.RETRY.MAX_TRIES },
  ),
);
```

## Configuration Exports

| Export | Description |
| --- | --- |
| `HTTP_CONFIG` | Timeouts, redirect policy, retry codes/methods |
| `MULTIPART_CONFIG` | Max file size, filename sanitization, MIME lists |
| `OAUTH_CONFIG` | JWT clock skew, auto-refresh toggle |
| `SECURITY_CONFIG` | CRLF validation, sanitization rules |
| `CONTENT_CONFIG` | Default Accept lists, content-types |
| `RANGE_CONFIG` | Default chunk size for range downloads |
| `CONFIG` | Aggregate object with all configs |

## Environment Overrides

| Variable | Controls | Default |
| --- | --- | --- |
| `UNIREQ_HTTP_TIMEOUT` | `HTTP_CONFIG.DEFAULT_TIMEOUT` | `30000` |
| `UNIREQ_MULTIPART_MAX_FILE_SIZE` | Max upload size (bytes) | `100000000` |
| `UNIREQ_MULTIPART_SANITIZE_FILENAMES` | Filename sanitization | `true` |
| `UNIREQ_JWT_CLOCK_SKEW` | JWT expiration tolerance (seconds) | `60` |
| `UNIREQ_OAUTH_AUTO_REFRESH` | Auto-refresh on 401 | `true` |

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
