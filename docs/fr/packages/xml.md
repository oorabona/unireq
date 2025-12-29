# @unireq/xml

Parsing et sérialisation XML bâtis sur [`fast-xml-parser`](https://www.npmjs.com/package/fast-xml-parser). L'objectif : intégrer du XML dans les mêmes chaînes de policies que vos transports HTTP ou IMAP, sans écrire de glue ad-hoc.

## Installation

```bash
pnpm add @unireq/xml
```

## Panorama des exports

| Symbole | Description |
| --- | --- |
| `xml(options?)` | Policy de réponse qui détecte `content-type: *xml*` et convertit le corps en objets JS via `fast-xml-parser`. |
| `xmlBody(data, builderOptions?)` | Body descriptor `application/xml` (géré automatiquement par `serializationPolicy`). |
| `XMLParserOptions`, `XMLBuilderOptions` | Types ré-exportés pour configurer précisément parser et builder. |

## Parser les réponses

```ts
import { client } from '@unireq/core';
import { http, headers } from '@unireq/http';
import { xml } from '@unireq/xml';

const api = client(
  http('https://api.example.com'),
  headers({ accept: 'application/xml' }),
  xml({ ignoreAttributes: false, attributeNamePrefix: '@_' }),
);

const res = await api.get('/orders/123');
console.log(res.data.order.total);
```

- La policy ne s'exécute que si `content-type` contient `xml` (insensible à la casse). Les autres réponses continuent dans la chaîne (par exemple vers `parse.json()`).
- Toutes les options `fast-xml-parser` sont disponibles : préfixes, gestion des espaces, stratégie pour les tags vides, etc.
- Placez `xml()` juste après l'auth/retry pour que les tentatives rejouées soient parsées une seule fois au plus près du transport.

## Sérialiser les requêtes

```ts
import { xmlBody } from '@unireq/xml';

await api.post(
  '/invoices',
  xmlBody({ invoice: { id: 42, total: 99.9 } }, { format: true, indentBy: '  ' }),
);
```

- `xmlBody()` produit un `BodyDescriptor` standard : `serializationPolicy()` s'occupe d'ajouter `Content-Type` et d'écrire le payload.
- Les options builder reflètent celles de `fast-xml-parser` (`format`, `indentBy`, `attributeNamePrefix`, etc.).

## Négocier JSON ↔ XML

```ts
import { client, either } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { xml } from '@unireq/xml';

const api = client(
  http('https://hybrid.example.com'),
  either(
    (ctx) => ctx.headers.accept?.includes('json') ?? false,
    parse.json(),
    xml(),
  ),
);
```

Même logique que `httpsJsonAuthSmart` : la policy `either()` choisit JSON quand le client le demande, sinon XML.

## Conseils & pièges

- **Erreurs de parsing** : une réponse XML invalide lèvera une exception `fast-xml-parser`; enveloppez le client dans `retry` ou captez l'erreur si vous préférez renvoyer un objet métier.
- **Payloads volumineux** : le parseur charge tout en mémoire. Pour des flux massifs, déportez la conversion côté serveur ou adoptez un parseur SAX.
- **Namespaces SOAP** : configurez `ignoreNameSpace` / `removeNSPrefix` pour aplatir les préfixes (`soapenv:Envelope`).
- **Tests** : utilisez les mêmes options que la prod pour éviter les snapshots divergents.

---

<p align="center">
  <a href="#/fr/packages/cookies">← Cookies</a> · <a href="#/fr/packages/graphql">GraphQL →</a>
</p>
