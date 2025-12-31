/**
 * Navigation Tree Builder
 * Builds a tree structure from OpenAPI paths for filesystem-like navigation
 * @module openapi/navigation/builder
 */

import type { LoadedSpec, OpenAPIOperation, OpenAPIPathItem } from '../types.js';
import type { HttpMethod, NavigationNode, NavigationTree, OperationInfo } from './types.js';
import { HTTP_METHODS } from './types.js';

/**
 * Create an empty navigation node
 */
function createNode(name: string, path: string): NavigationNode {
  return {
    name,
    path,
    isParameter: name.startsWith('{') && name.endsWith('}'),
    methods: [],
    operations: new Map(),
    children: new Map(),
  };
}

/**
 * Extract operation info from an OpenAPI operation
 */
function extractOperationInfo(method: HttpMethod, operation: OpenAPIOperation): OperationInfo {
  return {
    method,
    summary: operation.summary,
    description: operation.description,
    operationId: operation.operationId,
    deprecated: operation.deprecated,
    tags: operation.tags,
  };
}

/**
 * Get HTTP methods from a path item
 */
function getMethodsFromPathItem(pathItem: OpenAPIPathItem): Array<{ method: HttpMethod; operation: OpenAPIOperation }> {
  const result: Array<{ method: HttpMethod; operation: OpenAPIOperation }> = [];

  for (const methodName of HTTP_METHODS) {
    const operation = pathItem[methodName];
    if (operation) {
      result.push({
        method: methodName.toUpperCase() as HttpMethod,
        operation,
      });
    }
  }

  return result;
}

/**
 * Split a path into segments
 * @example '/users/{id}/posts' -> ['users', '{id}', 'posts']
 */
function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '');
}

/**
 * Build a navigation tree from a loaded OpenAPI spec
 * @param spec - Loaded and dereferenced OpenAPI specification
 * @returns Navigation tree for filesystem-like traversal
 */
export function buildNavigationTree(spec: LoadedSpec): NavigationTree {
  const root = createNode('', '/');
  let pathCount = 0;
  let operationCount = 0;

  const paths = spec.document.paths;
  if (!paths) {
    return { root, pathCount: 0, operationCount: 0 };
  }

  for (const [pathString, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    pathCount++;
    const segments = splitPath(pathString);

    // Navigate/create tree structure
    let currentNode = root;
    let currentPath = '';

    for (const segment of segments) {
      currentPath = `${currentPath}/${segment}`;

      let childNode = currentNode.children.get(segment);
      if (!childNode) {
        childNode = createNode(segment, currentPath);
        currentNode.children.set(segment, childNode);
      }

      currentNode = childNode;
    }

    // Add methods to the leaf node
    const methods = getMethodsFromPathItem(pathItem);
    for (const { method, operation } of methods) {
      if (!currentNode.methods.includes(method)) {
        currentNode.methods.push(method);
      }
      currentNode.operations.set(method, extractOperationInfo(method, operation));
      operationCount++;
    }
  }

  // Handle root path '/' operations if present
  const rootPathItem = paths['/'];
  if (rootPathItem) {
    const methods = getMethodsFromPathItem(rootPathItem);
    for (const { method, operation } of methods) {
      if (!root.methods.includes(method)) {
        root.methods.push(method);
      }
      root.operations.set(method, extractOperationInfo(method, operation));
    }
  }

  return { root, pathCount, operationCount };
}
