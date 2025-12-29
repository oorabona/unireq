# @unireq/graphql

Helpers GraphQL pour Unireq : builders d'opérations, descriptors de corps POST/GET et types pour des réponses ergonomiques.

## Installation

```bash
pnpm add @unireq/graphql
```

## Exports

| Symbole | Description |
| --- | --- |
| `query(doc, options?)` | Construit une opération query avec variables, fragments et nom d'opération optionnels. |
| `mutation(doc, options?)` | Construit une opération mutation avec les mêmes options que `query`. |
| `subscription(doc, options?)` | Construit une opération subscription pour données temps réel (transport WebSocket requis). |
| `fragment(name, type, fields)` | Crée un fragment GraphQL réutilisable. |
| `variable(name, type, value)` | Déclare une variable typée pour utilisation dans les opérations. |
| `toRequest(operation)` | Convertit une opération en payload `{ query, variables, operationName }`. |
| `graphql(operation)` | Body descriptor JSON pour les requêtes POST. |
| `graphqlRequest(request)` | Body descriptor quand vous avez déjà l'objet `{ query, variables }`. |
| `graphqlGet(operation)` | Policy qui transforme l'appel en GraphQL-over-GET avec paramètres d'URL. |
| `GraphQLResponse<T>`, `GraphQLError`, `GraphQLOperation` | Typage des opérations et réponses. |

## Construire des opérations avec variables

```ts
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { query, variable, graphql } from '@unireq/graphql';

const getUser = query(
  /* GraphQL */ `
    query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
        email
      }
    }
  `,
  {
    operationName: 'GetUser',
    variables: [variable('id', 'ID!', '123')],
  },
);

const api = client(http('https://api.example.com/graphql'), parse.json());
const response = await api.post('/', graphql(getUser));

if (response.data.errors?.length) {
  console.error(response.data.errors);
} else {
  console.log(response.data.data?.user);
}
```

- `variable()` garde le nom, le type et la valeur pour la sérialisation automatique.
- `parse.json()` doit rester au plus près du transport pour récupérer un `GraphQLResponse` après chaque tentative.

## GET ou POST ?

- Utilisez `graphql()` / `graphqlRequest()` avec `POST` pour les mutations ou des variables volumineuses.
- Si votre API supporte GraphQL via GET (CDN, queries persistées), ajoutez `graphqlGet(operation)` en policy ponctuelle :

```ts
await api.request('/search', graphqlGet(getUser), parse.json());
```

La policy encode `query`, `variables`, `operationName` dans l'URL et force `method: GET`.

## Gestion des erreurs

- Les réponses suivent la spec : `{ data?: T; errors?: GraphQLError[] }`.
- Les erreurs transport (timeout, 5xx) se gèrent via `retry(httpRetryPredicate())` en dehors de ces helpers.
- Vérifiez toujours `response.data.errors` avant d'utiliser `response.data.data`.

## Conseils de composition

- `graphql()` est un body descriptor : placez-le après vos policies d'auth (OAuth, cookies) mais avant les parseurs.
- `graphqlGet()` s'ajoute par requête, juste à côté de `parse.*` ou `headers()` ponctuels.
- Combinez avec `either()` pour basculer sur d'autres parseurs si votre backend parle aussi XML.

> Besoin d'un client prêt à l'emploi ? Utilisez `httpsJsonAuthSmart()` de [`@unireq/presets`](fr/packages/presets.md) qui configure HTTP, retry, OAuth et négociation de contenu.

---

<p align="center">
  <a href="#/fr/packages/xml">← XML</a> · <a href="#/fr/packages/imap">IMAP →</a>
</p>
