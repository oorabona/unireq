/**
 * Navigation Tree Query Functions
 * Provides functions to query the navigation tree
 * @module openapi/navigation/queries
 */

import type { HttpMethod, NavigationNode, NavigationTree, OperationInfo } from './types.js';

/**
 * Split a path into segments (reused from builder)
 */
function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '');
}

/**
 * Get a node at the specified path
 * @param tree - Navigation tree
 * @param path - Path to find (e.g., '/users/{id}')
 * @returns Node at path or undefined if not found
 */
export function getNode(tree: NavigationTree, path: string): NavigationNode | undefined {
  const normalizedPath = path === '' ? '/' : path;

  if (normalizedPath === '/') {
    return tree.root;
  }

  const segments = splitPath(normalizedPath);
  let currentNode: NavigationNode | undefined = tree.root;

  for (const segment of segments) {
    if (!currentNode) return undefined;

    // Try exact match first
    if (currentNode.children.has(segment)) {
      currentNode = currentNode.children.get(segment);
      continue;
    }

    // Try parameter match (any {param} node)
    let paramNode: NavigationNode | undefined;
    for (const [_name, child] of currentNode.children) {
      if (child.isParameter) {
        paramNode = child;
        break;
      }
    }

    if (paramNode) {
      currentNode = paramNode;
    } else {
      return undefined;
    }
  }

  return currentNode;
}

/**
 * Check if a path exists in the tree
 * @param tree - Navigation tree
 * @param path - Path to check
 * @returns True if path exists
 */
export function pathExists(tree: NavigationTree, path: string): boolean {
  return getNode(tree, path) !== undefined;
}

/**
 * List children at the specified path
 * @param tree - Navigation tree
 * @param path - Path to list children of
 * @returns Array of child nodes, empty if path not found
 */
export function listChildren(tree: NavigationTree, path: string): NavigationNode[] {
  const node = getNode(tree, path);
  if (!node) return [];

  return Array.from(node.children.values());
}

/**
 * Get HTTP methods available at a path
 * @param tree - Navigation tree
 * @param path - Path to check
 * @returns Array of HTTP methods, empty if path not found
 */
export function getMethods(tree: NavigationTree, path: string): HttpMethod[] {
  const node = getNode(tree, path);
  if (!node) return [];

  return [...node.methods];
}

/**
 * Get operation info for a specific method at a path
 * @param tree - Navigation tree
 * @param path - Path to check
 * @param method - HTTP method
 * @returns Operation info or undefined
 */
export function getOperation(tree: NavigationTree, path: string, method: HttpMethod): OperationInfo | undefined {
  const node = getNode(tree, path);
  if (!node) return undefined;

  return node.operations.get(method);
}

/**
 * Get all operations at a path
 * @param tree - Navigation tree
 * @param path - Path to check
 * @returns Array of operation info
 */
export function getOperations(tree: NavigationTree, path: string): OperationInfo[] {
  const node = getNode(tree, path);
  if (!node) return [];

  return Array.from(node.operations.values());
}
