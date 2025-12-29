# Retry & Backoff

This example shows how to configure robust retry strategies with exponential backoff and rate limiting handling.

## Unireq Code

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    // Predicate: When to retry?
    httpRetryPredicate({
      methods: ['GET', 'PUT', 'DELETE'],
      statusCodes: [408, 429, 500, 502, 503, 504]
    }),
    // Delay strategies: How long to wait?
    [
      // 1. Respect Retry-After header if present (for 429/503)
      rateLimitDelay({ maxWait: 60000 }),
      // 2. Otherwise, use exponential backoff with jitter
      backoff({ initial: 200, max: 2000, jitter: true })
    ],
    // Global options
    { tries: 3 }
  ),
  parse.json()
);

await api.get('/unstable-endpoint');
```

## Comparison with Axios

### Axios

Axios has no native retry support. You need a third-party library like `axios-retry`.

```javascript
const axios = require('axios');
const axiosRetry = require('axios-retry');

const client = axios.create();

axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.response.status === 429;
  }
});
```

### Differences

1.  **Native vs Third-party**: Unireq integrates retry in its core (`@unireq/core`). No extra dependency needed.
2.  **Flexibility**: Unireq separates the *predicate* (when to retry) from the *strategy* (how long to wait). You can combine multiple strategies (e.g., `rateLimitDelay` then `backoff`).
3.  **Agnostic**: Unireq's retry system works for any transport (HTTP, but also FTP, IMAP, etc.), not just HTTP.

---

<p align="center">
  <a href="#/examples/interceptors">← Interceptors</a> · <a href="#/examples/validation">Validation →</a>
</p>
