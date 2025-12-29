# @unireq/xml

XML parsing and serialization built on top of [`fast-xml-parser`](https://www.npmjs.com/package/fast-xml-parser). Drop-in policies let you consume SOAP-style or mixed JSON/XML APIs without leaving the Unireq composition model.

## Installation

```bash
pnpm add @unireq/xml
```

## Export overview

| Symbol | Description |
| --- | --- |
| `xml(options?)` | Response policy that inspects `content-type` for `xml` and transforms the body into JS structures using `fast-xml-parser`. |
| `xmlBody(data, builderOptions?)` | Body descriptor that serializes plain objects/arrays to `application/xml` (consumed automatically by `serializationPolicy`). |
| `XMLParserOptions`, `XMLBuilderOptions` | Re-exported types so you can pass strongly typed parser/builder configs. |

Everything is tree-shakeable—import only what you need.

## Parsing responses

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

- The policy activates only when the `content-type` header contains `xml` (case-insensitive). All other responses pass through untouched so you can still parse JSON later in the chain.
- Supply any `XMLParserOptions` from `fast-xml-parser` to adjust attribute prefixes, tag values, whitespace, or how empty nodes are represented.
- Keep `xml()` close to the transport (after auth/retry policies) so retried attempts parse the definitive payload.

## Serializing requests

```ts
import { xmlBody } from '@unireq/xml';

await api.post('/invoices', xmlBody({ invoice: { id: 42, total: 99.9 } }, { format: true, indentBy: '  ' }));
```

- `xmlBody()` returns a standard `BodyDescriptor`, so `serializationPolicy()` automatically applies the `Content-Type` header and stringifies before the transport sees the request.
- Builder options mirror `fast-xml-parser` defaults; enable `format: true` for human-readable payloads or tweak attribute casing.

## JSON/XML negotiation

Many enterprise APIs respond with XML when `Accept` prefers XML and JSON otherwise. Use `either()` to swap parsers deterministically:

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

This is the same pattern used inside [`httpsJsonAuthSmart`](packages/presets.md#httpsjsonauthsmart), so your custom clients stay consistent with the presets.

## Tips & gotchas

- **Error handling**: When the server returns malformed XML, `fast-xml-parser` throws; wrap the client with `retry` or add a guard policy if you need to suppress parsing errors.
- **Streaming**: The policy buffers the full body before parsing (as required by `fast-xml-parser`). For very large payloads, consider parsing server-side or using a streaming SAX parser.
- **Namespaces**: Configure `ignoreNameSpace`/`removeNSPrefix` if you need to flatten SOAP responses.
- **Testing**: Reuse the same options in tests to ensure snapshots match production parsing.

---

<p align="center">
  <a href="#/packages/cookies">← Cookies</a> · <a href="#/packages/graphql">GraphQL →</a>
</p>
