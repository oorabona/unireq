/**
 * GraphQL body serializer
 * Integrates GraphQL operations with unireq's body.* namespace
 */

import type { BodyDescriptor, Policy, RequestContext } from '@unireq/core';
import { toRequest } from './query.js';
import type { GraphQLOperation, GraphQLRequest } from './types.js';

/**
 * Create a GraphQL body descriptor from an operation
 * Automatically converts the operation to a GraphQL request payload
 *
 * @param operation - GraphQL operation (query, mutation, or subscription)
 * @returns BodyDescriptor for GraphQL content
 *
 * @example
 * ```ts
 * import { query, variable, graphql } from '@unireq/graphql';
 * import { client } from '@unireq/core';
 * import { http, parse } from '@unireq/http';
 *
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
 * const api = client(http('https://api.example.com/graphql'));
 * const response = await api.post('/', graphql(getUserQuery), parse.json());
 * ```
 */
export function graphql(operation: GraphQLOperation): BodyDescriptor {
  const request = toRequest(operation);

  return {
    __brand: 'BodyDescriptor',
    data: request,
    contentType: 'application/json',
    serialize: () => JSON.stringify(request),
  };
}

/**
 * Create a GraphQL body descriptor from a raw request payload
 * Use this when you already have a formatted GraphQL request
 *
 * @param request - GraphQL request payload
 * @returns BodyDescriptor for GraphQL content
 *
 * @example
 * ```ts
 * const request: GraphQLRequest = {
 *   query: 'query { user(id: "123") { name } }',
 *   variables: { id: '123' },
 *   operationName: 'GetUser'
 * };
 *
 * const api = client(http('https://api.example.com/graphql'));
 * const response = await api.post('/', graphqlRequest(request), parse.json());
 * ```
 */
export function graphqlRequest(request: GraphQLRequest): BodyDescriptor {
  return {
    __brand: 'BodyDescriptor',
    data: request,
    contentType: 'application/json',
    serialize: () => JSON.stringify(request),
  };
}

/**
 * Create a GraphQL GET request policy
 * Transforms a GraphQL operation into a GET request with query parameters
 *
 * @param operation - GraphQL operation (query, mutation, or subscription)
 * @returns Policy that modifies the request to use GET with URL parameters
 *
 * @example
 * ```ts
 * import { query, variable, graphqlGet } from '@unireq/graphql';
 * import { client } from '@unireq/core';
 * import { http, parse } from '@unireq/http';
 *
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
 * const api = client(http('https://api.example.com/graphql'));
 * const response = await api.request('/', graphqlGet(getUserQuery), parse.json());
 * ```
 */
export function graphqlGet(operation: GraphQLOperation): Policy {
  return async (ctx: RequestContext, next) => {
    const request = toRequest(operation);

    // Parse existing URL to append query parameters
    const url = new URL(ctx.url, 'http://dummy.base');

    // Add query parameter
    url.searchParams.set('query', request.query);

    // Add variables if present
    if (request.variables && Object.keys(request.variables).length > 0) {
      url.searchParams.set('variables', JSON.stringify(request.variables));
    }

    // Add operationName if present
    if (request.operationName) {
      url.searchParams.set('operationName', request.operationName);
    }

    // Reconstruct the URL (remove dummy base if it was added)
    const newUrl = ctx.url.startsWith('http') ? url.toString() : url.toString().replace('http://dummy.base', '');

    // Modify context to use GET method and updated URL
    const modifiedCtx: RequestContext = {
      ...ctx,
      method: 'GET',
      url: newUrl,
      body: undefined, // GET requests don't have a body
    };

    return next(modifiedCtx);
  };
}
