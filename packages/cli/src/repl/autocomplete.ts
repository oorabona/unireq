/**
 * REPL autocomplete provider
 * Provides suggestions from OpenAPI navigation tree and command registry
 */

import { getMethods, listChildren } from '../openapi/navigation/queries.js';
import type { NavigationTree } from '../openapi/navigation/types.js';
import type { CommandRegistry } from './commands.js';
import { resolvePath } from './path-utils.js';
import type { ReplState } from './state.js';

/**
 * Autocomplete suggestion option
 */
export interface Suggestion {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Get path suggestions from navigation tree
 * Returns child paths relative to current input
 */
export function getPathSuggestions(tree: NavigationTree, currentPath: string, input: string): Suggestion[] {
  const inputPath = input.trim();

  // When input is empty, list children of current path
  if (inputPath === '') {
    const children = listChildren(tree, currentPath);
    return children.map((child) => {
      const segment = child.name;
      const methods = child.methods.length > 0 ? child.methods.join(', ') : undefined;
      const hasChildren = child.children.size > 0;
      const fullPath = currentPath === '/' ? `/${segment}` : `${currentPath}/${segment}`;

      return {
        value: fullPath,
        label: segment + (hasChildren ? '/' : ''),
        hint: methods || (hasChildren ? 'directory' : undefined),
      };
    });
  }

  // Resolve the input relative to current path
  const resolvedPath = inputPath.startsWith('/') ? inputPath : resolvePath(currentPath, inputPath);

  // Get the parent directory for partial input
  const lastSlashIndex = resolvedPath.lastIndexOf('/');
  const parentPath = lastSlashIndex <= 0 ? '/' : resolvedPath.slice(0, lastSlashIndex);
  const partial = resolvedPath.slice(lastSlashIndex + 1);

  // List children of parent path
  const children = listChildren(tree, parentPath);

  // Filter by partial match
  const filtered = children.filter((child) => {
    return child.name.toLowerCase().startsWith(partial.toLowerCase());
  });

  // Build suggestions
  return filtered.map((child) => {
    const segment = child.name;
    const methods = child.methods.length > 0 ? child.methods.join(', ') : undefined;
    const hasChildren = child.children.size > 0;

    // Build full path for the suggestion value
    const fullPath = parentPath === '/' ? `/${segment}` : `${parentPath}/${segment}`;

    return {
      value: fullPath,
      label: segment + (hasChildren ? '/' : ''),
      hint: methods || (hasChildren ? 'directory' : undefined),
    };
  });
}

/**
 * Get method suggestions for a path
 */
export function getMethodSuggestions(tree: NavigationTree, path: string): Suggestion[] {
  const methods = getMethods(tree, path);

  return methods.map((method) => ({
    value: method.toLowerCase(),
    label: method,
    hint: 'HTTP method',
  }));
}

/**
 * Get command suggestions from registry
 */
export function getCommandSuggestions(registry: CommandRegistry, input: string): Suggestion[] {
  const commands = registry.getAll();
  const partial = input.toLowerCase();

  return commands
    .filter((cmd) => cmd.name.startsWith(partial))
    .map((cmd) => ({
      value: cmd.name,
      label: cmd.name,
      hint: cmd.description,
    }));
}

/**
 * Determine input type and get appropriate suggestions
 */
export function getSuggestions(state: ReplState, registry: CommandRegistry, input: string): Suggestion[] {
  const trimmed = input.trim();

  // If input is empty or single word, suggest commands
  if (!trimmed || !trimmed.includes(' ')) {
    const commandSuggestions = getCommandSuggestions(registry, trimmed);

    // Also suggest paths if navigational context
    if (state.navigationTree && (trimmed.startsWith('/') || trimmed.startsWith('.') || trimmed === '')) {
      const pathSuggestions = getPathSuggestions(state.navigationTree, state.currentPath, trimmed);
      // Combine: commands first, then paths
      return [...commandSuggestions, ...pathSuggestions];
    }

    return commandSuggestions;
  }

  // Parse command and argument
  const spaceIndex = trimmed.indexOf(' ');
  const command = trimmed.slice(0, spaceIndex);
  const arg = trimmed.slice(spaceIndex + 1);

  // For navigation commands (cd, ls, describe), suggest paths
  if (['cd', 'ls', 'describe'].includes(command) && state.navigationTree) {
    return getPathSuggestions(state.navigationTree, state.currentPath, arg);
  }

  // For HTTP methods, suggest paths
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  if (httpMethods.includes(command.toLowerCase()) && state.navigationTree) {
    return getPathSuggestions(state.navigationTree, state.currentPath, arg);
  }

  return [];
}

/**
 * Build autocomplete options for @clack/prompts
 */
export function buildAutocompleteOptions(state: ReplState, registry: CommandRegistry): Suggestion[] {
  // Build a flat list of all possible suggestions for initial display
  const suggestions: Suggestion[] = [];

  // Add all commands
  const commands = registry.getAll();
  for (const cmd of commands) {
    suggestions.push({
      value: cmd.name,
      label: cmd.name,
      hint: cmd.description,
    });
  }

  // Add paths from navigation tree if available
  if (state.navigationTree) {
    const children = listChildren(state.navigationTree, state.currentPath);
    for (const child of children) {
      const segment = child.name;
      const methods = child.methods.length > 0 ? child.methods.join(', ') : undefined;
      const hasChildren = child.children.size > 0;

      suggestions.push({
        value: segment,
        label: segment + (hasChildren ? '/' : ''),
        hint: methods || (hasChildren ? 'dir' : undefined),
      });
    }
  }

  return suggestions;
}
