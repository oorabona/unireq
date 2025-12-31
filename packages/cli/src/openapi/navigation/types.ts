/**
 * OpenAPI Navigation Tree Types
 * @module openapi/navigation/types
 */

/**
 * HTTP methods supported in OpenAPI
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE';

/**
 * All HTTP methods in lowercase for parsing
 */
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;

/**
 * Operation metadata for display
 */
export interface OperationInfo {
  method: HttpMethod;
  summary?: string;
  description?: string;
  operationId?: string;
  deprecated?: boolean;
  tags?: string[];
}

/**
 * A node in the navigation tree representing a path segment
 */
export interface NavigationNode {
  /** Segment name (e.g., 'users', '{id}') */
  name: string;
  /** Full path from root (e.g., '/users/{id}') */
  path: string;
  /** True if this segment is a path parameter */
  isParameter: boolean;
  /** HTTP methods available at this exact path */
  methods: HttpMethod[];
  /** Operation details for each method */
  operations: Map<HttpMethod, OperationInfo>;
  /** Child nodes */
  children: Map<string, NavigationNode>;
}

/**
 * Navigation tree built from an OpenAPI spec
 */
export interface NavigationTree {
  /** Root node representing '/' */
  root: NavigationNode;
  /** Total number of paths in the spec */
  pathCount: number;
  /** Total number of operations */
  operationCount: number;
}
