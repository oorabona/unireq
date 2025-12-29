# @unireq/core

Le package core fournit toutes les briques de base de l'écosystème Unireq : création de clients, composition de policies, primitives de résilience, introspection DX et catalogue d'erreurs.

## Installation

```bash
pnpm add @unireq/core
```

## Panorama des exports

| Catégorie | Symbols | Rôle |
| --- | --- | --- |
| Factory client | `client`, `Policy`, `Transport` | Composer transports + policies, avec overrides par requête. |
| Composition | `compose`, `either`, `match`, `policy`, `slot`, `validatePolicyChain` | Construire des piles middleware réutilisables en toute sécurité. |
| Résilience | `retry`, `backoff`, `circuitBreaker`, `throttle` | Gérer retries, backoff, circuit breaking et limitation du débit. |
| Introspection | `inspect`, `inspectable`, `getHandlerGraph`, `log`, `assertHas` | Visualiser la chaîne, produire des logs structurés, garantir la DX. |
| Validation & sérialisation | `serializationPolicy`, `isBodyDescriptor`, `validate`, `ValidationAdapter` | Gérer les corps automatiquement et valider les réponses typées. |
| Erreurs & utilitaires | `HttpError`, `TimeoutError`, `appendQueryParams`, etc. | Surface d'erreurs cohérente + helpers URL/headers. |

## Factory client & policies par requête

`client(transport, ...policies)` relie un transport (HTTP, FTP, IMAP…) à une chaîne de policies déterministe. Les policies passées au factory sont **globales** ; vous pouvez ajouter des policies ponctuelles par appel :

```typescript
import { client } from '@unireq/core';
import { http, headers, timeout, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  headers({ 'x-api-key': 'secret' }),
  timeout(10_000),
);

// Parser JSON uniquement pour cette requête
const user = await api.get('/users/42', parse.json());
```

Le factory injecte automatiquement `serializationPolicy()` (pour que `body.*`/`parse.*` fonctionnent sans friction) et valide la chaîne via `validatePolicyChain` (slots, capacités du transport, ordre auth/parser/transport).

## Composition & slots

- `compose(...policies)` regroupe des policies en bundles (ex. `authPolicy`).
- `policy(fn, meta)` tague une policy avec des métadonnées (`name`, `kind`, `options`).
- `slot({ type, name, requiredCapabilities })` réserve une place (transport/auth/parser) afin d'éviter les doublons et d'exiger les bonnes capacités.
- `either` / `match` décrivent du branching middleware (négociation de contenu, routage protocolaire, feature flags…).

```typescript
import { compose, either } from '@unireq/core';
import { parse } from '@unireq/http';
import { parse as parseXml } from '@unireq/xml';

const smartParser = compose(
  either(
    (ctx) => ctx.headers.accept?.includes('application/json') ?? false,
    parse.json(),
    parseXml(),
  ),
);
```

## Résilience & flow-control

### `retry(predicate, strategies, options)`

- Boucle de retry agnostique du transport. Le prédicat reçoit `(result, error, attempt, ctx)`.
- Plusieurs stratégies de délai peuvent être combinées ; la première qui renvoie une valeur est utilisée.
- `tries` vaut `3` par défaut ; `onRetry` permet d'émettre des métriques.

```typescript
import { retry, backoff } from '@unireq/core';
import { httpRetryPredicate } from '@unireq/http';

const resilient = retry(
  httpRetryPredicate({ statusCodes: [408, 429, 500, 502, 503, 504] }),
  [backoff({ initial: 200, max: 2_000, jitter: true })],
  { tries: 4 },
);
```

### `backoff({ initial = 1000, max = 30000, multiplier = 2, jitter = true })`

Crée une stratégie de délai inspectable avec croissance exponentielle plafonnée et jitter optionnel.

### `circuitBreaker` & `throttle`

Policies prêtes à l'emploi pour protéger vos dépendances : fenêtres configurables, seuils d'ouverture/fermeture et métadonnées prêtes pour l'observabilité.

## Introspection, logging & DX

- `inspect(handler, options)` traverse le graphe issu des métadonnées `policy` et renvoie une structure sérialisable (docs, tests, CLI de debug).
- `log(options)` émet des événements structurés (`start`, `success`, `error`) avec durée, requête et secrets masqués.
- `inspectable` / `getInspectableMeta` vous permettent d'intégrer vos prédicats/stratégies custom dans le graphe.
- `assertHas(handler, kind)` vérifie qu'un client contient bien la policy attendue (utile en tests end-to-end).

## Validation & sérialisation

- `serializationPolicy()` détecte les `body.*` (et définit les bons headers). `isBodyDescriptor` facilite les sérialiseurs custom.
- `validate(schema, adapter)` transforme n'importe quelle librairie de schéma en policy grâce au contrat `ValidationAdapter`.

### Adaptateur Zod directement dans le client

```typescript
import { client, validate } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { z } from 'zod';

const UserResponse = z.object({
  id: z.number(),
  email: z.string().email(),
  username: z.string(),
});

const zodAdapter = {
  validate: (schema: typeof UserResponse, data: unknown) => schema.parse(data),
};

const api = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json(),
  validate(UserResponse, zodAdapter),
);

const user = await api.get('/users/1');
```

- L'adaptateur n'a qu'une méthode `validate(schema, data)`. Vous pouvez l'inliner comme ci-dessus ou exposer un helper réutilisable comme dans [examples/validation-adapters.ts](examples/validation-adapters.ts).
- La validation s'exécute après le parseur : `data` contient donc déjà l'objet JSON/ XML, et vous pouvez retourner un type enrichi (`schema.parse` / `schema.parseAsync`).

### Valibot pour protéger requêtes et réponses

```typescript
import { client, validate } from '@unireq/core';
import { body, http, parse } from '@unireq/http';
import * as v from 'valibot';

const CreateUserInput = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
});

const CreateUserResponse = v.object({
  id: v.number(),
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
  createdAt: v.string(),
});

const valibotAdapter = {
  async validate(schema: typeof CreateUserResponse, data: unknown) {
    return v.parseAsync(schema, data);
  },
};

const api = client(
  http('https://api.example.com'),
  parse.json(),
  validate(CreateUserResponse, valibotAdapter),
);

export async function createUser(input: v.Input<typeof CreateUserInput>) {
  // Valide la charge utile sortante avant sérialisation
  const payload = v.parse(CreateUserInput, input);
  return api.post('/users', body.json(payload));
}
```

- La policy globale valide les réponses tandis que les mêmes schémas contrôlent les payloads sortants juste avant `body.json`. Vous gardez sérialisation et validation dans un seul module.
- Pour une démo exécutable (Zod vs Valibot, y compris les cas d'échec), consultez [examples/validation-demo.ts](examples/validation-demo.ts).
- Pour éviter de répéter `v.parse` dans chaque handler, encapsulez le pattern dans un helper/policy réutilisable :

```typescript
// Helper qui valide l'entrée et renvoie directement un body descriptor
const validatedJson = <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: TSchema) =>
  (input: v.Input<TSchema>) => body.json(v.parse(schema, input));

await api.post('/users', validatedJson(CreateUserInput)(input));
```

- La même logique peut vivre dans une policy `compose()` qui inspecte `ctx.body` avant `serializationPolicy()`. L'idée reste la même : centraliser la validation côté requêtes tout en gardant des appels `.post()` concis.
- Combinez ce helper avec la policy de réponse pour obtenir une pile "oignon" : la couche externe (helper) protège l'entrée, la couche interne (`validate`) protège la sortie.

```typescript
const apiSécurisé = client(
  http('https://api.example.com'),
  parse.json(),
  validate(CreateUserResponse, valibotAdapter), // couche interne : réponses
);

export async function createUser(input: v.Input<typeof CreateUserInput>) {
  const response = await apiSécurisé.post('/users', validatedJson(CreateUserInput)(input));
  return response.data; // déjà typé par Valibot
}
```

- Les appelants ne passent que des objets bruts ; le helper produit un body descriptor validé et la policy garantit que la réponse respecte `CreateUserResponse`. Même schéma pour entrée/sortie, zéro `v.parse` dispersé.

## Catalogue d'erreurs

Toutes les erreurs héritent de `UnireqError` (avec un `code` stable) :

- `NetworkError` – Échecs réseau (DNS, TLS, refus de connexion).
- `TimeoutError` – Expiration configurée (expose `timeoutMs`).
- `HttpError` – Utilisez-le avec une policy "throw-on-error".
- `SerializationError` – Problèmes d'encodage/décodage.
- `DuplicatePolicyError` – Deux policies occupent le même slot.
- `MissingCapabilityError` – Le transport ne supporte pas la capacité requise.
- `InvalidSlotError` – Mauvais ordre des slots (parser avant auth, transport hors fin de chaîne…).
- `NotAcceptableError` / `UnsupportedMediaTypeError` – Échec de négociation.
- `UnsupportedAuthForTransport` – Auth non supportée par le transport choisi.
- `URLNormalizationError` – URL invalides.

Servez-vous de ces classes pour piloter les toasts, la télémétrie ou du feature-gating fiable.

## Utilitaires pratiques

- Helpers URL/headers : `appendQueryParams`, `normalizeURL`, `getHeader`, `setHeader`.
- Types (`Client`, `RequestContext`, `Response`, …) pour typer vos transports/policies custom.
- Slots & capabilities : garantissent qu'un package tiers déclare clairement ses besoins.

---

<p align="center">
  <a href="#/fr/README">← Accueil</a> · <a href="#/fr/packages/http">HTTP →</a>
</p>