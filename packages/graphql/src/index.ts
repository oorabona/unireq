/**
 * @unireq/graphql
 * GraphQL query/mutation builders and transport for unireq
 *
 * @example
 * ```ts
 * import { query, mutation, variable, fragment, graphql } from '@unireq/graphql';
 * import { client } from '@unireq/core';
 * import { http, parse } from '@unireq/http';
 *
 * // Create a GraphQL client
 * const api = client(http('https://api.example.com/graphql'));
 *
 * // Build a query with variables
 * const getUserQuery = query(`
 *   user(id: $id) {
 *     id
 *     name
 *     email
 *   }
 * `, {
 *   variables: [variable('id', 'ID!', '123')]
 * });
 *
 * // Execute the query
 * const response = await api.post('/', graphql(getUserQuery), parse.json());
 * ```
 */

export { graphql, graphqlGet, graphqlRequest } from './body.js';
export { fragment, mutation, query, subscription, toRequest, variable } from './query.js';
export type {
  GraphQLError,
  GraphQLFragment,
  GraphQLOperation,
  GraphQLOperationType,
  GraphQLQueryOptions,
  GraphQLRequest,
  GraphQLResponse,
  GraphQLVariable,
} from './types.js';
