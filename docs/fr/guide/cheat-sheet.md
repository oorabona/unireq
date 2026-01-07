# Aide-mémoire

Une référence rapide pour les patterns Unireq les plus courants. Imprimez cette page !

---

## Installation

```bash
pnpm add @unireq/core @unireq/http @unireq/presets
```

---

## Le démarrage le plus rapide

```ts
import { httpClient } from '@unireq/presets';

const api = httpClient('https://api.example.com');

// GET
const user = await api.get('/users/1');

// POST avec body JSON (auto-détecté)
const created = await api.post('/users', { body: { name: 'John' } });
```

---

## Méthodes du client

Tous les clients fournissent ces méthodes HTTP :

| Méthode | Usage | Body |
|---------|-------|------|
| `api.get(url)` | Récupérer des données | Non |
| `api.post(url, options)` | Créer une ressource | Oui |
| `api.put(url, options)` | Remplacer une ressource | Oui |
| `api.patch(url, options)` | Mise à jour partielle | Oui |
| `api.delete(url)` | Supprimer une ressource | Non |
| `api.head(url)` | Headers uniquement | Non |
| `api.options(url)` | Preflight CORS | Non |

### Passer des options

```ts
// Simple : le body est auto-sérialisé en JSON
await api.post('/users', { body: { name: 'John' } });

// Avec signal d'annulation
const controller = new AbortController();
await api.get('/users', { signal: controller.signal });

// Avec policies par requête
await api.get('/users', { policies: [customPolicy] });
```

---

## Sérialiseurs de body (`body.*`)

> **Rappel :** `body.*` est pour les **requêtes sortantes** (ce que vous envoyez)

```ts
import { body } from '@unireq/http';

// Auto-détection (recommandé pour les cas simples)
body.auto({ name: 'John' })     // → JSON
body.auto('texte brut')          // → text/plain
body.auto(new FormData())        // → multipart/form-data
body.auto(new URLSearchParams()) // → application/x-www-form-urlencoded

// Sérialiseurs explicites
body.json({ key: 'value' })      // application/json
body.text('Bonjour monde')       // text/plain
body.form({ user: 'john' })      // application/x-www-form-urlencoded
body.binary(buffer, 'image/png') // Données binaires avec type MIME

// Uploads multipart
body.multipart(
  { name: 'file', part: body.binary(blob, 'application/pdf'), filename: 'doc.pdf' },
  { name: 'meta', part: body.json({ title: 'Doc' }) }
)
```

---

## Parsers de réponse (`parse.*`)

> **Rappel :** `parse.*` est pour les **réponses entrantes** (ce que vous recevez)

```ts
import { parse } from '@unireq/http';

// Ajouter comme policy pour parser automatiquement les réponses
const api = client(http('...'), parse.json());

// Ou utiliser par requête
await api.get('/data', parse.json());
await api.get('/readme', parse.text());
await api.get('/file', parse.stream());
await api.get('/events', parse.sse());
```

---

## Gestion des erreurs

### Vérifier le status de la réponse

```ts
const response = await api.get('/users/1');

if (response.ok) {
  console.log(response.data);
} else {
  console.error(`Erreur : ${response.status}`);
}
```

### Méthodes safe (style fonctionnel, sans try/catch)

```ts
// Retourne Result<Response, Error> au lieu de throw
const result = await api.safe.get('/users/1');

if (result.isOk()) {
  console.log(result.value.data);
} else {
  console.error(result.error.message);
}

// Ou utilisez le pattern matching
result.match({
  ok: (res) => console.log(res.data),
  err: (error) => console.error(error.message),
});
```

---

## Patterns courants

### Ajouter des headers par défaut

```ts
import { httpClient } from '@unireq/presets';

const api = httpClient('https://api.example.com', {
  headers: {
    'Authorization': 'Bearer token',
    'X-API-Key': 'secret',
  },
});
```

### Ajouter des paramètres de requête par défaut

```ts
const api = httpClient('https://api.example.com', {
  query: { api_key: 'secret', format: 'json' },
});

// Toutes les requêtes incluront ?api_key=secret&format=json
await api.get('/users'); // → /users?api_key=secret&format=json
```

### Définir un timeout

```ts
const api = httpClient('https://api.example.com', {
  timeout: 5000, // 5 secondes
});
```

### Client personnalisé avec retry

```ts
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, json } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({ statusCodes: [429, 503] }),
    [rateLimitDelay(), backoff()],
    { tries: 3 }
  ),
  json()
);
```

---

## Comparaison rapide : body vs parse

| Je veux... | Utiliser |
|------------|----------|
| Envoyer des données JSON | `body.json({ ... })` ou `{ body: { ... } }` |
| Envoyer des données de formulaire | `body.form({ ... })` |
| Uploader un fichier | `body.binary(blob, 'type')` |
| Recevoir du JSON | `parse.json()` comme policy |
| Recevoir du texte brut | `parse.text()` comme policy |
| Streamer la réponse | `parse.stream()` comme policy |

---

## Astuces TypeScript

```ts
// Typer vos données de réponse
interface User {
  id: number;
  name: string;
}

const response = await api.get<User>('/users/1');
console.log(response.data.name); // TypeScript sait que c'est une string

// Typer votre body de requête
interface CreateUserRequest {
  name: string;
  email: string;
}

await api.post('/users', { body: { name: 'John', email: 'john@example.com' } satisfies CreateUserRequest });
```

---

<p align="center">
  <a href="#/fr/guide/quick-start">← Démarrage rapide</a> ·
  <a href="#/fr/tutorials/getting-started">Premiers pas →</a>
</p>
