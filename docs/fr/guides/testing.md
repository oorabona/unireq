# Tests avec MSW

Ce guide couvre les tests des clients @unireq en utilisant [Mock Service Worker (MSW)](https://mswjs.io/).

Le projet compte **4285+ tests répartis sur 184 fichiers**, couvrant les scénarios unitaires, d'intégration et de sécurité.

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

## Tests d'Intégration Multi-Packages

Les tests unitaires par package vérifient chaque politique de façon isolée. Ils ne détectent pas les bugs qui émergent des interactions entre politiques, par exemple :

- Un hit de cache renvoyant une réponse périmée alors que l'auth a expiré
- Des identifiants d'authentification transmis lors d'une redirection vers une autre origine
- Une boucle de retry qui n'invalide pas un 503 mis en cache

Les tests d'intégration composent plusieurs packages dans un pipeline réaliste et vérifient le comportement combiné.

### Pourquoi MSW pour les tests d'intégration

MSW intercepte au niveau de la couche réseau (module `http` de Node.js), de sorte que toutes les politiques de la chaîne — auth, retry, cache, redirection — s'exécutent exactement comme en production. Aucun module interne n'est mocké.

### Exemple : Auth + Retry + Cache dans un seul pipeline

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { client, retry, cache } from '@unireq/core';
import { http as httpTransport, httpRetryPredicate, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const server = setupServer(
  http.get('https://api.test/data', ({ request }) => {
    if (!request.headers.get('authorization')) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({ ok: true });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('pipeline auth + retry + cache', () => {
  const api = client(
    httpTransport('https://api.test'),
    oauthBearer({ tokenSupplier: async () => 'test-token', allowUnsafeMode: true }),
    retry(httpRetryPredicate({ statusCodes: [503] }), [], { tries: 3 }),
    cache({ ttl: 5000 }),
    parse.json()
  );

  it('injecte l\'auth, réessaie sur les erreurs transitoires, met en cache les réponses réussies', async () => {
    let callCount = 0;

    server.use(
      http.get('https://api.test/data', ({ request }) => {
        callCount++;
        if (!request.headers.get('authorization')) {
          return new HttpResponse(null, { status: 401 });
        }
        if (callCount === 1) {
          return new HttpResponse(null, { status: 503 });
        }
        return HttpResponse.json({ ok: true });
      })
    );

    const response = await api.get('/data');

    expect(response.data).toEqual({ ok: true });
    expect(callCount).toBe(2); // 1 retry, puis succès

    // La deuxième requête doit être servie depuis le cache (pas de nouvel appel réseau)
    await api.get('/data');
    expect(callCount).toBe(2);
  });
});
```

### Anatomie d'un test multi-packages

| Couche | Ce qui est vérifié |
|--------|-------------------|
| Le handler MSW vérifie `authorization` | La politique auth injecte l'en-tête avant l'envoi |
| Le handler renvoie 503 au premier appel | La politique retry renvoie la requête |
| L'assertion sur `callCount` | Le retry s'est déclenché exactement une fois |
| Second `api.get('/data')` sans incrément | La politique cache a servi la réponse |

---

## Tests de Sécurité

Les propriétés de sécurité doivent être testées aussi explicitement que les propriétés fonctionnelles. Les politiques décrites ci-dessous imposent des contraintes invisibles en fonctionnement normal — elles n'apparaissent que dans des scénarios contrôlés par un attaquant.

### Redirection Cross-Origin : Suppression des en-têtes d'auth

Lorsqu'une redirection mène vers une origine différente, les en-têtes `Authorization` et `Cookie` doivent être supprimés. Transmettre des identifiants vers un hôte inattendu constitue une fuite de credentials.

```typescript
it('supprime Authorization lors d\'une redirection cross-origin', async () => {
  const capturedHeaders: Record<string, string | null> = {};

  server.use(
    http.get('https://api.test/redirect', () => {
      return new HttpResponse(null, {
        status: 302,
        headers: { Location: 'https://other-origin.test/landing' },
      });
    }),
    http.get('https://other-origin.test/landing', ({ request }) => {
      capturedHeaders.authorization = request.headers.get('authorization');
      capturedHeaders.cookie = request.headers.get('cookie');
      return HttpResponse.json({ ok: true });
    })
  );

  const api = client(
    httpTransport('https://api.test'),
    oauthBearer({ tokenSupplier: async () => 'secret', allowUnsafeMode: true }),
    parse.json()
  );

  await api.get('/redirect');

  expect(capturedHeaders.authorization).toBeNull();
  expect(capturedHeaders.cookie).toBeNull();
});
```

### Blocage du Downgrade HTTPS→HTTP

Une redirection de `https://` vers `http://` doit être rejetée. L'autoriser transmettrait silencieusement des identifiants et des données en clair.

```typescript
it('rejette la redirection de HTTPS vers HTTP', async () => {
  server.use(
    http.get('https://api.test/downgrade', () => {
      return new HttpResponse(null, {
        status: 301,
        headers: { Location: 'http://api.test/plaintext' },
      });
    })
  );

  const api = client(httpTransport('https://api.test'), parse.json());

  await expect(api.get('/downgrade')).rejects.toThrow(/downgrade|insecure/i);
});
```

### Isolation du Cache pour les Requêtes Authentifiées

Une réponse en cache pour l'utilisateur A ne doit jamais être servie à l'utilisateur B. La clé de cache doit inclure `Authorization` (via l'en-tête `Vary` ou une dérivation de clé explicite).

```typescript
it('ne sert pas une réponse en cache à une identité différente', async () => {
  let callCount = 0;

  server.use(
    http.get('https://api.test/profile', ({ request }) => {
      callCount++;
      const token = request.headers.get('authorization');
      return HttpResponse.json({ user: token });
    })
  );

  const makeApi = (token: string) =>
    client(
      httpTransport('https://api.test'),
      oauthBearer({ tokenSupplier: async () => token, allowUnsafeMode: true }),
      cache({ ttl: 60_000 }),
      parse.json()
    );

  const r1 = await makeApi('token-alice').get('/profile');
  const r2 = await makeApi('token-bob').get('/profile');

  expect(r1.data.user).toContain('token-alice');
  expect(r2.data.user).toContain('token-bob');
  expect(callCount).toBe(2); // Chaque identité passe par le réseau
});
```

### Isolation des Identifiants de Proxy

Les identifiants proxy (définis via `UNIREQ_PROXY_USER` / `UNIREQ_PROXY_PASS`) ne doivent jamais apparaître dans les en-têtes `Authorization` envoyés au serveur cible, ni dans les logs.

```typescript
it('ne transfère pas les identifiants proxy au serveur cible', async () => {
  let targetAuth: string | null = null;

  server.use(
    http.get('https://api.test/resource', ({ request }) => {
      targetAuth = request.headers.get('authorization');
      return HttpResponse.json({ ok: true });
    })
  );

  vi.stubEnv('UNIREQ_PROXY_USER', 'proxy-user');
  vi.stubEnv('UNIREQ_PROXY_PASS', 'proxy-pass');

  const api = client(httpTransport('https://api.test'), parse.json());
  await api.get('/resource');

  expect(targetAuth).toBeNull();
});
```

### Permissions du Fichier Vault

Le fichier vault des secrets doit être créé avec les permissions `0o600` afin que seul le processus propriétaire puisse le lire.

```typescript
import { stat } from 'node:fs/promises';

it('crée le fichier vault avec les permissions 0o600', async () => {
  const vaultPath = join(tmpdir(), `vault-${Date.now()}.json`);
  const vault = new SecretsVault(vaultPath);

  await vault.set('key', 'value');

  const { mode } = await stat(vaultPath);
  expect(mode & 0o777).toBe(0o600);
});
```

---

## Bonnes Pratiques

1. **Reset les handlers après chaque test** - Évite la pollution entre tests
2. **Utilisez `onUnhandledRequest: 'error'`** - Détecte les requêtes non gérées
3. **Testez les cas limites** - Erreurs réseau, timeouts, réponses malformées
4. **Mockez des réponses réalistes** - Utilisez les vraies formes de réponses API
5. **Testez la logique de retry** - Vérifiez que le backoff exponentiel fonctionne
6. **Testez les états du circuit breaker** - Fermé, ouvert, semi-ouvert
7. **Écrivez des tests d'intégration pour les combinaisons de politiques** - Les tests unitaires seuls manquent les bugs d'interaction
8. **Testez chaque propriété de sécurité explicitement** - Suppression lors des redirections, blocage du downgrade, isolation du cache
