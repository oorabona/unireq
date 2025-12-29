# Tests avec MSW

Ce guide couvre les tests des clients @unireq en utilisant [Mock Service Worker (MSW)](https://mswjs.io/).

## Configuration

### Installer MSW

```bash
pnpm add -D msw
```

### Créer les Handlers

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://api.example.com/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  }),

  http.post('https://api.example.com/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.get('https://api.example.com/error', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),
];
```

### Configurer le Serveur

```typescript
// mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Configuration Vitest

```typescript
// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Tests Basiques

### Tester les Requêtes GET

```typescript
import { describe, it, expect } from 'vitest';
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

describe('UserAPI', () => {
  const api = client(
    http('https://api.example.com'),
    parse.json()
  );

  it('récupère les utilisateurs', async () => {
    const response = await api.get<{ id: number; name: string }[]>('/users');

    expect(response.status).toBe(200);
    expect(response.data).toHaveLength(2);
    expect(response.data[0].name).toBe('Alice');
  });

  it('crée un utilisateur', async () => {
    const response = await api.post<{ id: number; name: string }>('/users', {
      name: 'Charlie',
    });

    expect(response.status).toBe(201);
    expect(response.data.id).toBe(3);
    expect(response.data.name).toBe('Charlie');
  });
});
```

## Tester la Logique de Retry

```typescript
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client, retry, backoff } from '@unireq/core';
import { http as httpTransport, httpRetryPredicate, parse } from '@unireq/http';

describe('Retry', () => {
  it('réessaie sur 503', async () => {
    let attempts = 0;

    server.use(
      http.get('https://api.example.com/flaky', () => {
        attempts++;
        if (attempts < 3) {
          return HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 });
        }
        return HttpResponse.json({ success: true });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      retry(
        httpRetryPredicate({ statusCodes: [503] }),
        [backoff({ initial: 10, max: 100 })],
        { tries: 5 }
      ),
      parse.json()
    );

    const response = await api.get('/flaky');

    expect(attempts).toBe(3);
    expect(response.data).toEqual({ success: true });
  });

  it('respecte l\'en-tête Retry-After', async () => {
    let attempts = 0;

    server.use(
      http.get('https://api.example.com/rate-limited', () => {
        attempts++;
        if (attempts === 1) {
          return HttpResponse.json(
            { error: 'Too Many Requests' },
            {
              status: 429,
              headers: { 'Retry-After': '1' },
            }
          );
        }
        return HttpResponse.json({ success: true });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      retry(
        httpRetryPredicate({ statusCodes: [429] }),
        [rateLimitDelay({ maxWait: 5000 })],
        { tries: 3 }
      ),
      parse.json()
    );

    const start = Date.now();
    await api.get('/rate-limited');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });
});
```

## Tester le Circuit Breaker

```typescript
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client, circuitBreaker, CircuitOpenError } from '@unireq/core';
import { http as httpTransport, parse } from '@unireq/http';

describe('Circuit Breaker', () => {
  it('s\'ouvre après le seuil d\'échecs', async () => {
    server.use(
      http.get('https://api.example.com/failing', () => {
        return HttpResponse.json({ error: 'Error' }, { status: 500 });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      circuitBreaker({
        threshold: 3,
        resetTimeout: 1000,
        halfOpenRequests: 1,
      }),
      parse.json()
    );

    // Échouer 3 fois pour ouvrir le circuit
    for (let i = 0; i < 3; i++) {
      await expect(api.get('/failing')).rejects.toThrow();
    }

    // La prochaine requête doit échouer rapidement avec CircuitOpenError
    await expect(api.get('/failing')).rejects.toThrow(CircuitOpenError);
  });

  it('passe en semi-ouvert après le timeout de reset', async () => {
    let shouldFail = true;

    server.use(
      http.get('https://api.example.com/recovering', () => {
        if (shouldFail) {
          return HttpResponse.json({ error: 'Error' }, { status: 500 });
        }
        return HttpResponse.json({ success: true });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      circuitBreaker({
        threshold: 2,
        resetTimeout: 100, // Timeout court pour les tests
        halfOpenRequests: 1,
      }),
      parse.json()
    );

    // Ouvrir le circuit
    await expect(api.get('/recovering')).rejects.toThrow();
    await expect(api.get('/recovering')).rejects.toThrow();

    // Attendre le timeout de reset
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Réparer le service
    shouldFail = false;

    // Devrait réussir et fermer le circuit
    const response = await api.get('/recovering');
    expect(response.data).toEqual({ success: true });
  });
});
```

## Tester OAuth

```typescript
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client } from '@unireq/core';
import { http as httpTransport, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

describe('OAuth', () => {
  it('ajoute le token bearer aux requêtes', async () => {
    let capturedAuth: string | null = null;

    server.use(
      http.get('https://api.example.com/protected', ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ secret: 'data' });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      oauthBearer({
        tokenSupplier: () => 'test-token',
        allowUnsafeMode: true, // Skip la validation JWT dans les tests
      }),
      parse.json()
    );

    await api.get('/protected');

    expect(capturedAuth).toBe('Bearer test-token');
  });

  it('rafraîchit le token sur 401', async () => {
    let callCount = 0;
    const refreshToken = vi.fn().mockResolvedValue('new-token');

    server.use(
      http.get('https://api.example.com/protected', ({ request }) => {
        callCount++;
        const auth = request.headers.get('Authorization');

        if (auth === 'Bearer old-token') {
          return HttpResponse.json({ error: 'Unauthorized' }, {
            status: 401,
            headers: { 'WWW-Authenticate': 'Bearer' },
          });
        }

        return HttpResponse.json({ success: true });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      oauthBearer({
        tokenSupplier: () => callCount === 1 ? 'old-token' : 'new-token',
        onRefresh: refreshToken,
        allowUnsafeMode: true,
      }),
      parse.json()
    );

    const response = await api.get('/protected');

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(response.data).toEqual({ success: true });
  });
});
```

## Tester la Gestion des Erreurs

```typescript
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client, isHttpError, HttpError } from '@unireq/core';
import { http as httpTransport, parse } from '@unireq/http';

describe('Gestion des Erreurs', () => {
  it('gère les erreurs 404', async () => {
    server.use(
      http.get('https://api.example.com/not-found', () => {
        return HttpResponse.json(
          { error: 'Not Found' },
          { status: 404 }
        );
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      parse.json()
    );

    try {
      await api.get('/not-found');
      expect.fail('Aurait dû lancer une exception');
    } catch (error) {
      expect(isHttpError(error)).toBe(true);
      expect((error as HttpError).response?.status).toBe(404);
    }
  });

  it('gère les erreurs réseau', async () => {
    server.use(
      http.get('https://api.example.com/network-error', () => {
        return HttpResponse.error();
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      parse.json()
    );

    await expect(api.get('/network-error')).rejects.toThrow();
  });
});
```

## Tester le Streaming

```typescript
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client } from '@unireq/core';
import { http as httpTransport, parse } from '@unireq/http';

describe('Streaming', () => {
  it('parse les événements SSE', async () => {
    const sseData = `event: message
data: {"id": 1}

event: message
data: {"id": 2}

`;

    server.use(
      http.get('https://api.example.com/events', () => {
        return new HttpResponse(sseData, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      parse.sse()
    );

    const response = await api.get('/events');
    const events = [];

    for await (const event of response.data) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0].data).toBe('{"id": 1}');
  });
});
```

## Bonnes Pratiques

1. **Reset les handlers après chaque test** - Évite la pollution entre tests
2. **Utilisez `onUnhandledRequest: 'error'`** - Détecte les requêtes non gérées
3. **Testez les cas limites** - Erreurs réseau, timeouts, réponses malformées
4. **Mockez des réponses réalistes** - Utilisez les vraies formes de réponses API
5. **Testez la logique de retry** - Vérifiez que le backoff exponentiel fonctionne
6. **Testez les états du circuit breaker** - Fermé, ouvert, semi-ouvert
