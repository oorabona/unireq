/**
 * GraphQL query and mutation builders
 * Uses template literals for elegant query construction
 */

import type {
  GraphQLFragment,
  GraphQLOperation,
  GraphQLQueryOptions,
  GraphQLRequest,
  GraphQLVariable,
} from './types.js';

/**
 * Build GraphQL variables string
 * @param variables - Array of variable definitions
 * @returns Variables string for operation definition
 */
function buildVariablesString(variables: ReadonlyArray<GraphQLVariable>): string {
  if (variables.length === 0) return '';

  const varDefs = variables.map((v) => {
    const defaultVal = v.defaultValue !== undefined ? ` = ${JSON.stringify(v.defaultValue)}` : '';
    return `$${v.name}: ${v.type}${defaultVal}`;
  });

  return `(${varDefs.join(', ')})`;
}

/**
 * Build GraphQL fragments string
 * @param fragments - Array of fragment definitions
 * @returns Fragments string to append to query
 */
function buildFragmentsString(fragments: ReadonlyArray<GraphQLFragment>): string {
  if (fragments.length === 0) return '';

  return fragments.map((f) => `fragment ${f.name} on ${f.on} {\n  ${f.fields}\n}`).join('\n\n');
}

/**
 * Build complete GraphQL query string
 * @param operation - Operation definition
 * @returns Complete GraphQL query string
 */
function buildQueryString(operation: GraphQLOperation): string {
  const { type, name, query, variables = [], fragments = [] } = operation;

  const opName = name ? ` ${name}` : '';
  const varsString = buildVariablesString(variables);
  const fragmentsString = buildFragmentsString(fragments);

  const queryString = `${type}${opName}${varsString} {\n  ${query}\n}`;

  return fragmentsString ? `${queryString}\n\n${fragmentsString}` : queryString;
}

/**
 * Create GraphQL query operation
 * @param queryText - Query fields (can use template literals)
 * @param options - Query options (variables, fragments, operation name)
 * @returns GraphQL operation definition
 *
 * @example
 * ```ts
 * const getUserQuery = query(`
 *   user(id: $id) {
 *     id
 *     name
 *     email
 *   }
 * `, {
 *   variables: [{ name: 'id', type: 'ID!', value: '123' }]
 * });
 * ```
 */
export function query(queryText: string, options?: GraphQLQueryOptions): GraphQLOperation {
  return {
    type: 'query',
    name: options?.operationName,
    query: queryText.trim(),
    variables: options?.variables,
    fragments: options?.fragments,
  };
}

/**
 * Create GraphQL mutation operation
 * @param mutationText - Mutation fields (can use template literals)
 * @param options - Mutation options (variables, fragments, operation name)
 * @returns GraphQL operation definition
 *
 * @example
 * ```ts
 * const createUserMutation = mutation(`
 *   createUser(input: $input) {
 *     user {
 *       id
 *       name
 *       email
 *     }
 *   }
 * `, {
 *   operationName: 'CreateUser',
 *   variables: [{
 *     name: 'input',
 *     type: 'CreateUserInput!',
 *     value: { name: 'John', email: 'john@example.com' }
 *   }]
 * });
 * ```
 */
export function mutation(mutationText: string, options?: GraphQLQueryOptions): GraphQLOperation {
  return {
    type: 'mutation',
    name: options?.operationName,
    query: mutationText.trim(),
    variables: options?.variables,
    fragments: options?.fragments,
  };
}

/**
 * Create GraphQL subscription operation
 * @param subscriptionText - Subscription fields
 * @param options - Subscription options (variables, fragments, operation name)
 * @returns GraphQL operation definition
 *
 * @example
 * ```ts
 * const messageSubscription = subscription(`
 *   messageAdded(roomId: $roomId) {
 *     id
 *     content
 *     user { name }
 *   }
 * `, {
 *   variables: [{ name: 'roomId', type: 'ID!', value: 'room-123' }]
 * });
 * ```
 */
export function subscription(subscriptionText: string, options?: GraphQLQueryOptions): GraphQLOperation {
  return {
    type: 'subscription',
    name: options?.operationName,
    query: subscriptionText.trim(),
    variables: options?.variables,
    fragments: options?.fragments,
  };
}

/**
 * Create GraphQL fragment
 * @param name - Fragment name
 * @param on - Type condition
 * @param fields - Fragment fields
 * @returns GraphQL fragment definition
 *
 * @example
 * ```ts
 * const userFragment = fragment('UserFields', 'User', `
 *   id
 *   name
 *   email
 *   avatar
 * `);
 * ```
 */
export function fragment(name: string, on: string, fields: string): GraphQLFragment {
  return {
    name,
    on,
    fields: fields.trim(),
  };
}

/**
 * Create GraphQL variable
 * @param name - Variable name (without $)
 * @param type - GraphQL type (e.g., 'ID!', 'String', '[Int]')
 * @param value - Variable value
 * @param defaultValue - Optional default value
 * @returns GraphQL variable definition
 *
 * @example
 * ```ts
 * const idVar = variable('id', 'ID!', '123');
 * const limitVar = variable('limit', 'Int', 10, 20); // default: 20
 * ```
 */
export function variable(name: string, type: string, value: unknown, defaultValue?: unknown): GraphQLVariable {
  return {
    name,
    type,
    value,
    defaultValue,
  };
}

/**
 * Convert GraphQL operation to request payload
 * @param operation - GraphQL operation definition
 * @returns GraphQL request payload ready to send
 *
 * @example
 * ```ts
 * const op = query('user(id: $id) { name }', {
 *   variables: [variable('id', 'ID!', '123')]
 * });
 * const payload = toRequest(op);
 * // { query: '...', variables: { id: '123' }, operationName: undefined }
 * ```
 */
export function toRequest(operation: GraphQLOperation): GraphQLRequest {
  const queryString = buildQueryString(operation);

  const variables =
    operation.variables?.reduce(
      (acc, v) => {
        acc[v.name] = v.value;
        return acc;
      },
      {} as Record<string, unknown>,
    ) || undefined;

  return {
    query: queryString,
    variables,
    operationName: operation.name,
  };
}
