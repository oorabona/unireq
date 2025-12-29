# Système de Corps & Parsing

Unireq fournit un système composable pour gérer les corps de requête et le parsing des réponses.

## Sérialiseurs de corps (`body.*`)

`body.*` sérialise la charge utile et pose `Content-Type` automatiquement. Combinez-les avec vos validateurs pour garantir un payload conforme avant de partir sur le réseau.

```typescript
import { body } from '@unireq/http';

body.json({ email: 'jane@example.com' });
body.text('plain text', 'text/plain; charset=utf-8');
body.form({ q: 'unireq', page: 2 });
body.binary(fileBuffer, 'application/pdf');
body.multipart(
  { name: 'file', part: body.binary(fileBuffer, 'application/pdf'), filename: 'quote.pdf' },
  { name: 'meta', part: body.json({ customerId: 42 }) },
);
```

## Parseurs de réponse (`parse.*`)

Installez un parser par requête (ou globalement) pour négocier le format reçu.

```typescript
import { parse } from '@unireq/http';

parse.json();
parse.text();
parse.blob();
parse.stream();
parse.raw();
```

- Chaque parser pose `Accept` automatiquement et alimente les policies suivantes (`validate`, métriques, etc.).
- `parse.stream()` expose un `ReadableStream`, tandis que `parse.raw()` laisse le corps intouché.

## Marshalling côté requêtes ("produce")

Valibot/Zod peuvent valider les entrées *avant* la sérialisation. Il suffit d'envelopper `v.parse` dans un petit helper pour « produire » le corps final.

```typescript
import * as v from 'valibot';
import { body } from '@unireq/http';

const CreateUserInput = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
  marketingOptIn: v.optional(v.boolean(), false),
});

const produceJson = <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: TSchema) =>
  (input: v.Input<TSchema>) => body.json(v.parse(schema, input));

await api.post('/users', produceJson(CreateUserInput)({ email: 'jane@example.com', name: 'Jane' }));
```

- Il n'existe pas de `v.produce` natif : `v.parse` renvoie déjà la forme canonique du schéma, il suffit donc de l'entourer pour générer un `body.json` cohérent.
- Profitez-en pour normaliser (arrondis, slugs, dates ISO) juste avant la sérialisation.

## Unmarshalling côté réponses

Chaînez `validate()` après `parse.*` pour garantir que les réponses correspondent à votre contrat.

```typescript
import { client, validate } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { valibotAdapter } from '../../examples/validation-adapters.js';
import * as v from 'valibot';

const UserResponse = v.object({
  id: v.number(),
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
});

const api = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json(),
  validate(UserResponse, valibotAdapter()),
);

const user = await api.get('/users/1');
```

- `validate()` reçoit déjà le corps parsé ; retournez ce que vous voulez (objet, classe) et `response.data` prendra cette valeur.
- Changez de librairie en remplaçant l'adaptateur (`Zod`, `ArkType`, etc.).

## Aller-retour complet

```typescript
const CreateUserOutput = v.object({
  id: v.number(),
  createdAt: v.string(),
});

const api = client(
  http('https://api.example.com'),
  parse.json(),
  validate(CreateUserOutput, valibotAdapter()),
);

export async function createUser(input: v.Input<typeof CreateUserInput>) {
  return api.post('/users', produceJson(CreateUserInput)(input));
}
```

- La couche externe (« produce ») garantit un payload propre ; la couche interne (« parse ») sécurise la réponse.
- Pour les flux (NDJSON/SSE), combinez `parse.stream()` avec une policy maison qui valide chaque événement à la volée.

---

<p align="center">
  <a href="#/fr/concepts/composition">← Composition</a> · <a href="#/fr/concepts/http-semantics">Sémantique HTTP →</a>
</p>