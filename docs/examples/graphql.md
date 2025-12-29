# GraphQL Queries

End-to-end GraphQL walkthrough using the public Countries API. The example demonstrates how Unireq's GraphQL helpers keep operations composable and type-safe.

## Highlights

- ✅ Build operations with `query()`, `fragment()`, and `variable()` helpers
- ✅ Serialize requests with `graphql()` and reuse them with any transport
- ✅ Inspect real responses from https://countries.trevorblades.com
- ✅ Gracefully handle GraphQL errors (partial failures, validation issues)

## Run it locally

```bash
pnpm example:graphql-query
```

The command executes `examples/graphql-query.ts` and prints four scenarios (structural queries, variables, fragments, and real API calls).

## Full example

```typescript
import { client } from '@unireq/core';
import type { GraphQLResponse } from '@unireq/graphql';
import { fragment, graphql, query, variable } from '@unireq/graphql';
import { http, parse } from '@unireq/http';

console.log('🔍 GraphQL Query Examples\n');
console.log('💡 These examples show how to build GraphQL queries with @unireq/graphql\n');
console.log('   For real API calls, use endpoints like:');
console.log('   - https://countries.trevorblades.com/ (Countries API)');
console.log('   - https://api.github.com/graphql (GitHub - requires token)');
console.log('   - Your own GraphQL endpoint\n');

// Define reusable fragments
const userFragment = fragment(
  'UserInfo',
  'User',
  `
  id
  name
  username
  email
  phone
`,
);

const postFragment = fragment(
  'PostInfo',
  'Post',
  `
  id
  title
  body
`,
);

try {
  // Example 1: Simple query
  console.log('📊 Example 1: Simple query structure\n');

  const simpleQuery = query(
    `
  user(id: 1) {
    name
    email
  }
`,
    {
      operationName: 'GetUserSimple',
    },
  );

  console.log('Query structure:', JSON.stringify(simpleQuery, null, 2));

  // Example 2: Query with variables
  console.log('\n\n📊 Example 2: Query with variables\n');

  const postsQuery = query(
    `
  posts(options: { paginate: { page: $page, limit: $limit } }) {
    data {
      ...PostInfo
    }
  }
`,
    {
      operationName: 'GetPosts',
      variables: [variable('page', 'Int', 1), variable('limit', 'Int', 5)],
      fragments: [postFragment],
    },
  );

  console.log('Variables defined:', postsQuery.variables?.map((v) => `${v.name}: ${v.type}`).join(', '));
  console.log('Fragment used:', postsQuery.fragments?.[0]?.name);

  // Example 3: Fragment composition
  console.log('\n\n📊 Example 3: Fragment composition\n');

  const composedQuery = query(
    `
  user(id: $userId) {
    ...UserInfo
    posts {
      data {
        ...PostInfo
      }
    }
  }
`,
    {
      operationName: 'GetUserWithPosts',
      variables: [variable('userId', 'ID!', '1')],
      fragments: [userFragment, postFragment],
    },
  );

  console.log('Operation name:', composedQuery.name);
  console.log('Fragments used:', composedQuery.fragments?.map((f) => f.name).join(', '));

  // Example 4: Real GraphQL API - Countries
  console.log('\n\n📊 Example 4: Real API - Countries (https://countries.trevorblades.com/)\n');

  const countriesApi = client(http('https://countries.trevorblades.com'));

  // Query 1: Get all countries with basic info
  const countriesQuery = query(
    `
  countries {
    code
    name
    emoji
    capital
  }
`,
    { operationName: 'GetCountries' },
  );

  console.log('Fetching countries...');
  const countriesResponse = await countriesApi.post<
    GraphQLResponse<{ countries: Array<{ code: string; name: string; emoji: string; capital: string }> }>
  >('/', graphql(countriesQuery), parse.json());

  if (countriesResponse.data?.data?.countries) {
    const countries = countriesResponse.data.data.countries.slice(0, 5);
    console.log(`Found ${countriesResponse.data.data.countries.length} countries. Showing first 5:\n`);
    for (const country of countries) {
      console.log(`${country.emoji} ${country.name} (${country.code}) - Capital: ${country.capital || 'N/A'}`);
    }
  } else if (countriesResponse.data?.errors) {
    console.error('GraphQL errors:', countriesResponse.data.errors);
  }

  // Query 2: Get specific country with variables
  console.log('\n\nQuerying specific country (France) with variables...');
  const countryQuery = query(
    `
  country(code: $code) {
    name
    native
    capital
    emoji
    currency
    languages {
      code
      name
    }
  }
`,
    {
      operationName: 'GetCountry',
      variables: [variable('code', 'ID!', 'FR')],
    },
  );

  const franceResponse = await countriesApi.post<
    GraphQLResponse<{
      country: {
        name: string;
        native: string;
        capital: string;
        emoji: string;
        currency: string;
        languages: Array<{ code: string; name: string }>;
      };
    }>
  >('/', graphql(countryQuery), parse.json());

  if (franceResponse.data?.data?.country) {
    const country = franceResponse.data.data.country;
    console.log(`\n${country.emoji} ${country.name} (${country.native})`);
    console.log(`Capital: ${country.capital}`);
    console.log(`Currency: ${country.currency}`);
    console.log(`Languages: ${country.languages.map((l) => `${l.name} (${l.code})`).join(', ')}`);
  } else if (franceResponse.data?.errors) {
    console.error('GraphQL errors:', franceResponse.data.errors);
  }

  // Query 3: Continent with countries using fragment
  console.log('\n\nQuerying continent (Europe) with countries fragment...');

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
    const continent = europeResponse.data.data.continent;
    console.log(`\nContinent: ${continent.name}`);
    console.log(`Countries: ${continent.countries.length}`);
    console.log('Sample countries:');
    for (const country of continent.countries.slice(0, 5)) {
      console.log(`  ${country.emoji} ${country.name} (${country.code})`);
    }
  } else if (europeResponse.data?.errors) {
    console.error('GraphQL errors:', europeResponse.data.errors);
  }

  console.log('\n✨ GraphQL query examples completed!');
  console.log('\n💡 Free public GraphQL APIs to try:');
  console.log('- https://countries.trevorblades.com/ (Countries data)');
  console.log('- https://api.spacex.land/graphql/ (SpaceX launches)');
  console.log('- https://rickandmortyapi.com/graphql (Rick & Morty)');
  console.log('- https://swapi-graphql.netlify.app/.netlify/functions/index (Star Wars)');
  console.log('\n💡 @unireq/graphql features:');
  console.log('- Composable query(), mutation(), subscription()');
  console.log('- Type-safe variables with variable()');
  console.log('- Reusable fragments with fragment()');
  console.log('- Seamless integration with body.* pattern');
} catch (error) {
  console.error('❌ GraphQL query failed:', error);
}
```

---

<p align="center">
  <a href="#/examples/uploads">← Uploads</a> · <a href="#/examples/interceptors">Interceptors →</a>
</p>