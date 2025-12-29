# Body & Parsing System

Unireq provides a composable system for handling request bodies and response parsing.

## Body Serializers (`body.*`)

`body.*` helpers serialize data and set `Content-Type` for you. Combine them with validators to guarantee the outbound payload is well-formed.

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

## Response Parsers (`parse.*`)

Install parsers per request (or globally) to negotiate the response format.

```typescript
import { parse } from '@unireq/http';

parse.json();
parse.text();
parse.blob();
parse.stream();
parse.raw();
```

- Each parser sets `Accept` automatically and feeds its result into downstream policies (`validate`, custom transforms, etc.).
- `parse.stream()` exposes a Web `ReadableStream`, while `parse.raw()` keeps the payload untouched for manual handling.

## Marshalling requests ("produce")

Valibot/Zod (or any schema library) can validate inputs *before* serialization. Think of it as producing the final wire representation.

```typescript
import * as v from 'valibot';
import { body } from '@unireq/http';

const CreateUserInput = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
  marketingOptIn: v.optional(v.boolean(), false),
});

// Helper that “produces” a body descriptor from raw input
const produceJson = <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: TSchema) =>
  (input: v.Input<TSchema>) => body.json(v.parse(schema, input));

await api.post('/users', produceJson(CreateUserInput)({
  email: 'jane@example.com',
  name: 'Jane',
}));
```

- There is no dedicated `v.produce` helper—`v.parse` already returns the canonical (output) form of the schema, so wrapping it in a small factory gives you deterministic marshalling with full type inference.
- Add extra transforms (e.g., `toFixed`, slugification) inside the helper before handing the payload to `body.json`.

## Unmarshalling responses (“parse”)

Hook `validate()` after `parse.*` to guarantee response bodies match your expectations.

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

- `validate()` receives already-parsed data; return anything (plain object, class instance) and it becomes the new `response.data`.
- Swap adapters freely (Zod, ArkType, io-ts) because `validate` only requires a `{ validate(schema, data) }` shape.

## Round-trip example

```typescript
const CreateUserOutput = v.object({
  id: v.number(),
  createdAt: v.string(),
});

const api = client(
  http('https://api.example.com'),
  parse.json(),
  validate(CreateUserOutput, valibotAdapter()), // inbound validation
);

export async function createUser(input: v.Input<typeof CreateUserInput>) {
  return api.post('/users', produceJson(CreateUserInput)(input));
}
```

- The outer layer (“produce”) guarantees outgoing payloads are normalized, while the inner layer (“parse”) secures what comes back. Both reuse the same schema family.
- For streaming or NDJSON, pair `parse.stream()` with a custom parser policy that chunks/validates each event as it arrives.

---

<p align="center">
  <a href="#/concepts/composition">← Composition</a> · <a href="#/concepts/http-semantics">HTTP Semantics →</a>
</p>