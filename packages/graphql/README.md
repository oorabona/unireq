# @unireq/graphql

[![npm version](https://img.shields.io/npm/v/@unireq/graphql.svg)](https://www.npmjs.com/package/@unireq/graphql)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

GraphQL helpers for Unireq: builders for queries/mutations/subscriptions, body descriptors for POST/GET transports, and types for ergonomic responses.

## Installation

```bash
pnpm add @unireq/graphql
```

## Quick Start

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { query, variable, graphql } from '@unireq/graphql';

const getUser = query(
  `query GetUser($id: ID!) {
    user(id: $id) { id name email }
  }`,
  { operationName: 'GetUser', variables: [variable('id', 'ID!', '123')] },
);

const api = client(http('https://api.example.com/graphql'), parse.json());
const response = await api.post('/', graphql(getUser));

if (response.data.errors?.length) {
  console.error(response.data.errors);
} else {
  console.log(response.data.data?.user);
}
```

## Features

| Symbol | Description |
| --- | --- |
| `query(doc, options?)` | Builds a query operation with variables and fragments |
| `mutation(doc, options?)` | Builds a mutation operation |
| `subscription(doc, options?)` | Builds a subscription operation |
| `graphql(operation)` | Body descriptor for POST requests |
| `graphqlGet(operation)` | Policy for GraphQL-over-GET (CDN caching) |
| `GraphQLResponse<T>` | Strong typing for results |

## GraphQL over GET

```typescript
await api.request('/search', graphqlGet(getUser), parse.json());
```

Converts the operation to URL parameters (`query`, `variables`, `operationName`) for CDN caching.

## Error Handling

- HTTP transport errors (timeouts, 500): use `retry(httpRetryPredicate())`
- GraphQL errors: inspect `response.data.errors` before trusting `response.data.data`

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
