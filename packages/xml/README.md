# @unireq/xml

[![npm version](https://img.shields.io/npm/v/@unireq/xml.svg)](https://www.npmjs.com/package/@unireq/xml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

XML parsing and serialization built on top of `fast-xml-parser`. Drop-in policies for SOAP-style or mixed JSON/XML APIs.

## Installation

```bash
pnpm add @unireq/xml
```

## Quick Start

```typescript
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

## Features

| Symbol | Description |
| --- | --- |
| `xml(options?)` | Response policy that parses XML to JS objects |
| `xmlBody(data, options?)` | Body descriptor for XML serialization |
| `XMLParserOptions` | Re-exported parser configuration types |
| `XMLBuilderOptions` | Re-exported builder configuration types |

## Serializing Requests

```typescript
import { xmlBody } from '@unireq/xml';

await api.post('/invoices', xmlBody(
  { invoice: { id: 42, total: 99.9 } },
  { format: true, indentBy: '  ' },
));
```

## JSON/XML Negotiation

```typescript
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

## Tips

- **Error handling**: Wrap with `retry` if malformed XML is possible
- **Streaming**: Policy buffers full body before parsing
- **Namespaces**: Use `ignoreNameSpace`/`removeNSPrefix` for SOAP

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
