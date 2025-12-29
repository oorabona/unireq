# @unireq/graphql

GraphQL helpers for Unireq: builders for queries/mutations/subscriptions, body descriptors for POST/GET transports, and types for ergonomic responses.

## Installation

```bash
pnpm add @unireq/graphql
```

## Exports

| Symbol | Description |
| --- | --- |
| `query(doc, options?)` | Builds a query operation with optional variables, fragments, and operation name. |
| `mutation(doc, options?)` | Builds a mutation operation with the same options as `query`. |
| `subscription(doc, options?)` | Builds a subscription operation for real-time data (WebSocket transport required). |
| `fragment(name, type, fields)` | Creates a reusable GraphQL fragment. |
| `variable(name, type, value)` | Declares a typed variable for use in operations. |
| `toRequest(operation)` | Converts an operation to `{ query, variables, operationName }` payload. |
| `graphql(operation)` | Body descriptor that serializes the operation as JSON for POST. |
| `graphqlRequest(request)` | Body descriptor when you already have a `{ query, variables }` object. |
| `graphqlGet(operation)` | Policy that rewrites the request into a GraphQL-over-GET call with query params. |
| `GraphQLResponse<T>`, `GraphQLError`, `GraphQLOperation` | Strong typing for results, operations, and variables. |

## Building operations with variables

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

- `variable(name, type, value)` stores GraphQL variables alongside the document so `graphql()` can serialize them.
- `parse.json()` should sit closest to the transport so you get typed `GraphQLResponse` objects after each retry.

## GET vs POST

- Use `graphql(operation)` or `graphqlRequest(request)` with `POST` when you need full request bodies (mutations, large variable payloads).
- When your API supports GraphQL over HTTP GET (CDN caching, persisted queries), compose `graphqlGet(operation)` as a per-request policy:

```ts
await api.request('/search', graphqlGet(getUser), parse.json());
```

The helper converts the operation to URL parameters (`query`, `variables`, `operationName`) and forces `method: GET`.

## Error handling

- Returned payloads follow the GraphQL spec: `{ data?: T; errors?: GraphQLError[] }`.
- Treat HTTP transport errors (timeouts, 500) with `retry(httpRetryPredicate())` outside the GraphQL helpers.
- Application-level GraphQL errors stay inside `response.data.errors`; inspect them before trusting `response.data.data`.

## Composition tips

- `graphql()` is a **body descriptor**, so place it before serialization policies but after headers/auth (e.g., `oauthBearer`).
- `graphqlGet()` is a per-request policy; append it where you would normally pass `parse.*` or conditional logic.
- Combine with `either()` to switch between `parse.json()` and `xml()` if your GraphQL server also returns alternate formats.

> Need a ready-made stack? Use `httpsJsonAuthSmart()` from [`@unireq/presets`](packages/presets.md) which wires HTTP, retry, OAuth, and content negotiation for you.

---

<p align="center">
  <a href="#/packages/xml">← XML</a> · <a href="#/packages/imap">IMAP →</a>
</p>
