# Requêtes GraphQL

Exemple complet basé sur `examples/graphql-query.ts` qui démontre requêtes, variables, fragments et appels réels à l'API publique Countries.

## Points clés

- ✅ Helpers `query()`, `fragment()`, `variable()` au lieu de chaînes JSON manuelles
- ✅ Serialisation via `graphql()` et parsing via `parse.json()`
- ✅ Interactions réelles avec https://countries.trevorblades.com
- ✅ Gestion des erreurs GraphQL (`errors` vs `data` partiel)

## Lancer l'exemple

```bash
pnpm example:graphql-query
```

## Code (extrait simplifié)

```typescript
import { client } from '@unireq/core';
import type { GraphQLResponse } from '@unireq/graphql';
import { fragment, graphql, query, variable } from '@unireq/graphql';
import { http, parse } from '@unireq/http';

const countriesApi = client(http('https://countries.trevorblades.com'));

const countryInfoFragment = fragment(
  'CountryInfo',
  'Country',
  `
  code
  name
  emoji
  capital
`,
);

const continentQuery = query(
  `
  continent(code: $code) {
    name
    countries {
      ...CountryInfo
    }
  }
`,
  {
    operationName: 'GetContinent',
    variables: [variable('code', 'ID!', 'EU')],
    fragments: [countryInfoFragment],
  },
);

const europeResponse = await countriesApi.post<
  GraphQLResponse<{
    continent: {
      name: string;
      countries: Array<{ code: string; name: string; emoji: string; capital: string }>;
    };
  }>
>('/', graphql(continentQuery), parse.json());

if (europeResponse.data?.data?.continent) {
  console.log('Continent:', europeResponse.data.data.continent.name);
  console.log('Pays:', europeResponse.data.data.continent.countries.length);
}
```

Le fichier `examples/graphql-query.ts` inclut d'autres scénarios : requêtes purement structurelles, variables paginées, fragments imbriqués et gestion des réponses/erreurs.

## Pourquoi Unireq vs Axios ?

| Besoin | Unireq | Axios |
| --- | --- | --- |
| Composition | Helpers dédiés (`query`, `fragment`, `graphql`) | Chaînes de caractères multi-lignes |
| Typage | Variables et fragments typés, retour `GraphQLResponse<T>` | Typage manuel du corps JSON |
| Réutilisation | Fragments partagés et factories d'opérations | Copie/colle de chaînes |

Avec Unireq vous manipulez des objets structurés, ce qui simplifie l'autocomplétion et la factorisation des requêtes complexes.

---

<p align="center">
  <a href="#/fr/examples/uploads">← Uploads</a> · <a href="#/fr/examples/interceptors">Intercepteurs →</a>
</p>