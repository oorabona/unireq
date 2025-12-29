# Premiers Pas avec Unireq

Unireq est un toolkit client HTTP moderne et composable pour Node.js. Il est conçu pour être tree-shakeable, type-safe et facile à étendre.

## Installation

Pour commencer, installez le package core et le package HTTP :

```bash
pnpm add @unireq/core @unireq/http
```

## Votre Première Requête

Voici comment effectuer une simple requête GET vers une API JSON.

```typescript
import { client } from "@unireq/core";
import { http, parse } from "@unireq/http";

// 1. Create a client instance
// We use the "http" transport and a "parse.json()" policy to automatically parse the response body.
const api = client(
  http("https://jsonplaceholder.typicode.com"),
  parse.json()
);

// 2. Make a request
// The response data is automatically typed if you provide a generic.
interface Post {
  id: number;
  title: string;
  body: string;
}

const response = await api.get<Post>("/posts/1");

console.log(response.data.title);
```

## Ajouter des En-têtes

Vous pouvez ajouter des en-têtes à toutes les requêtes en utilisant la policy `headers`.

```typescript
import { client } from "@unireq/core";
import { http, headers, parse } from "@unireq/http";

const api = client(
  http("https://api.example.com"),
  headers({
    "Authorization": "Bearer my-token",
    "User-Agent": "MyApp/1.0"
  }),
  parse.json()
);
```

## Gestion des Erreurs

Contrairement à de nombreux autres clients HTTP, **Unireq ne lève pas d"erreur pour les réponses non-2xx par défaut**.

Une réponse 404 ou 500 reste une réponse HTTP valide. Unireq ne lève des erreurs que pour les échecs réseau (comme les problèmes DNS) ou les timeouts.

Vous devez vérifier la propriété `ok` ou le code `status` :

```typescript
const response = await api.get("/non-existent");

if (!response.ok) {
  console.error(`Request failed with status ${response.status}`);
  // Handle error...
} else {
  console.log("Success:", response.data);
}
```

Si vous préférez le comportement "throw on error", vous pouvez facilement créer une policy pour cela :

```typescript
import { policy, HttpError } from "@unireq/core";

const throwOnError = policy(async (ctx, next) => {
  const response = await next(ctx);
  if (!response.ok) {
    throw new HttpError(response);
  }
  return response;
});

const api = client(http(), throwOnError);
```

## Prochaines Étapes

- En savoir plus sur la [Composition](fr/concepts/composition.md)
- Explorer la [Sémantique HTTP](fr/concepts/http-semantics.md)
- Consulter l"[Usage Avancé](fr/tutorials/advanced.md)

---

<p align="center">
  <a href="#/fr/README">← Accueil</a> · <a href="#/fr/tutorials/advanced">Usage Avancé →</a>
</p>
