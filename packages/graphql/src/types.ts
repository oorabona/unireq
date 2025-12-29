/**
 * GraphQL types and interfaces
 */

/** GraphQL operation type */
export type GraphQLOperationType = 'query' | 'mutation' | 'subscription';

/** GraphQL variable definition */
export interface GraphQLVariable {
  readonly name: string;
  readonly type: string;
  readonly value: unknown;
  readonly defaultValue?: unknown;
}

/** GraphQL fragment definition */
export interface GraphQLFragment {
  readonly name: string;
  readonly on: string;
  readonly fields: string;
}

/** GraphQL operation definition */
export interface GraphQLOperation {
  readonly type: GraphQLOperationType;
  readonly name?: string;
  readonly query: string;
  readonly variables?: ReadonlyArray<GraphQLVariable>;
  readonly fragments?: ReadonlyArray<GraphQLFragment>;
}

/** GraphQL request payload */
export interface GraphQLRequest {
  readonly query: string;
  readonly variables?: Record<string, unknown>;
  readonly operationName?: string;
}

/** GraphQL response structure */
export interface GraphQLResponse<T = unknown> {
  readonly data?: T;
  readonly errors?: ReadonlyArray<GraphQLError>;
  readonly extensions?: Record<string, unknown>;
}

/** GraphQL error */
export interface GraphQLError {
  readonly message: string;
  readonly locations?: ReadonlyArray<{
    readonly line: number;
    readonly column: number;
  }>;
  readonly path?: ReadonlyArray<string | number>;
  readonly extensions?: Record<string, unknown>;
}

/** GraphQL query builder options */
export interface GraphQLQueryOptions {
  readonly operationName?: string;
  readonly variables?: ReadonlyArray<GraphQLVariable>;
  readonly fragments?: ReadonlyArray<GraphQLFragment>;
}
