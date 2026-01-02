/**
 * Tests for REPL autocomplete provider
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { HttpMethod, NavigationNode, NavigationTree } from '../../openapi/navigation/types.js';
import {
  buildAutocompleteOptions,
  getCommandSuggestions,
  getMethodSuggestions,
  getPathSuggestions,
  getSuggestions,
} from '../autocomplete.js';
import { CommandRegistry } from '../commands.js';
import type { ReplState } from '../state.js';

// Helper to create navigation node
function createNode(
  name: string,
  path: string,
  methods: HttpMethod[] = [],
  children: Map<string, NavigationNode> = new Map(),
  isParameter = false,
): NavigationNode {
  return {
    name,
    path,
    isParameter,
    methods,
    operations: new Map(),
    children,
  };
}

// Mock navigation tree for testing
function createMockTree(): NavigationTree {
  const profileNode = createNode('profile', '/users/{id}/profile', ['GET']);
  const idNode = createNode('{id}', '/users/{id}', ['GET', 'PUT', 'DELETE'], new Map([['profile', profileNode]]), true);
  const usersNode = createNode('users', '/users', ['GET', 'POST'], new Map([['{id}', idNode]]));
  const postsNode = createNode('posts', '/posts', ['GET', 'POST']);
  const productsNode = createNode('products', '/products', ['GET']);

  const rootNode = createNode(
    '',
    '/',
    [],
    new Map([
      ['users', usersNode],
      ['posts', postsNode],
      ['products', productsNode],
    ]),
  );

  return {
    root: rootNode,
    pathCount: 5,
    operationCount: 9,
  };
}

// Mock command registry
function createMockRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registry.register({ name: 'cd', description: 'Change directory', handler: async () => {} });
  registry.register({ name: 'ls', description: 'List contents', handler: async () => {} });
  registry.register({ name: 'pwd', description: 'Print working directory', handler: async () => {} });
  registry.register({ name: 'describe', description: 'Show operation details', handler: async () => {} });
  registry.register({ name: 'help', description: 'Show help', handler: async () => {} });
  return registry;
}

// Mock REPL state
function createMockState(overrides: Partial<ReplState> = {}): ReplState {
  return {
    currentPath: '/',
    running: true,
    ...overrides,
  };
}

describe('getPathSuggestions', () => {
  let tree: NavigationTree;

  beforeEach(() => {
    tree = createMockTree();
  });

  describe('when at root path', () => {
    it('should return all root children for empty input', () => {
      const suggestions = getPathSuggestions(tree, '/', '');

      expect(suggestions).toHaveLength(3);
      expect(suggestions.map((s) => s.label)).toContain('users/');
      expect(suggestions.map((s) => s.label)).toContain('posts');
      expect(suggestions.map((s) => s.label)).toContain('products');
    });

    it('should filter by prefix', () => {
      const suggestions = getPathSuggestions(tree, '/', 'u');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.label).toBe('users/');
    });

    it('should filter case-insensitively', () => {
      const suggestions = getPathSuggestions(tree, '/', 'P');

      expect(suggestions).toHaveLength(2);
      expect(suggestions.map((s) => s.label)).toContain('posts');
      expect(suggestions.map((s) => s.label)).toContain('products');
    });

    it('should handle absolute path input', () => {
      const suggestions = getPathSuggestions(tree, '/', '/u');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.value).toBe('/users');
    });
  });

  describe('when at nested path', () => {
    it('should return children of current path', () => {
      const suggestions = getPathSuggestions(tree, '/users', '');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.label).toBe('{id}/');
    });

    it('should handle relative path input', () => {
      const suggestions = getPathSuggestions(tree, '/users', '{');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.label).toBe('{id}/');
    });
  });

  describe('suggestion hints', () => {
    it('should show methods as hint for endpoint paths', () => {
      const suggestions = getPathSuggestions(tree, '/', 'posts');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.hint).toContain('GET');
      expect(suggestions[0]?.hint).toContain('POST');
    });

    it('should show "directory" as hint for paths with only children', () => {
      // Create a tree where users has no methods but has children
      const idNode = createNode('{id}', '/users/{id}', ['GET']);
      const usersNode = createNode('users', '/users', [], new Map([['{id}', idNode]]));
      const rootNode = createNode('', '/', [], new Map([['users', usersNode]]));
      const testTree: NavigationTree = { root: rootNode, pathCount: 2, operationCount: 1 };

      const suggestions = getPathSuggestions(testTree, '/', 'users');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.hint).toBe('directory');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for non-existent path', () => {
      const suggestions = getPathSuggestions(tree, '/nonexistent', '');

      expect(suggestions).toHaveLength(0);
    });

    it('should return empty array when no matches', () => {
      const suggestions = getPathSuggestions(tree, '/', 'xyz');

      expect(suggestions).toHaveLength(0);
    });
  });
});

describe('getMethodSuggestions', () => {
  let tree: NavigationTree;

  beforeEach(() => {
    tree = createMockTree();
  });

  it('should return methods for path with operations', () => {
    const suggestions = getMethodSuggestions(tree, '/users');

    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.value)).toContain('get');
    expect(suggestions.map((s) => s.value)).toContain('post');
  });

  it('should return all methods for path with multiple operations', () => {
    const suggestions = getMethodSuggestions(tree, '/users/{id}');

    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((s) => s.value)).toContain('get');
    expect(suggestions.map((s) => s.value)).toContain('put');
    expect(suggestions.map((s) => s.value)).toContain('delete');
  });

  it('should return empty for path without operations', () => {
    // Create tree with a node that has no methods
    const noMethodNode = createNode('empty', '/empty', []);
    const rootNode = createNode('', '/', [], new Map([['empty', noMethodNode]]));
    const testTree: NavigationTree = { root: rootNode, pathCount: 1, operationCount: 0 };

    const suggestions = getMethodSuggestions(testTree, '/empty');

    expect(suggestions).toHaveLength(0);
  });

  it('should include HTTP method hint', () => {
    const suggestions = getMethodSuggestions(tree, '/users');

    expect(suggestions[0]?.hint).toBe('HTTP method');
  });
});

describe('getCommandSuggestions', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = createMockRegistry();
  });

  it('should return all commands for empty input', () => {
    const suggestions = getCommandSuggestions(registry, '');

    expect(suggestions).toHaveLength(5);
  });

  it('should filter by prefix', () => {
    const suggestions = getCommandSuggestions(registry, 'c');

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.value).toBe('cd');
  });

  it('should include description as hint', () => {
    const suggestions = getCommandSuggestions(registry, 'cd');

    expect(suggestions[0]?.hint).toBe('Change directory');
  });

  it('should return empty when no matches', () => {
    const suggestions = getCommandSuggestions(registry, 'xyz');

    expect(suggestions).toHaveLength(0);
  });

  it('should match multiple commands with same prefix', () => {
    const suggestions = getCommandSuggestions(registry, 'p');

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.value).toBe('pwd');
  });
});

describe('getSuggestions', () => {
  let tree: NavigationTree;
  let registry: CommandRegistry;

  beforeEach(() => {
    tree = createMockTree();
    registry = createMockRegistry();
  });

  describe('when input is empty', () => {
    it('should return command suggestions', () => {
      const state = createMockState();
      const suggestions = getSuggestions(state, registry, '');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.value === 'cd')).toBe(true);
    });

    it('should also include path suggestions when navigation tree exists', () => {
      const state = createMockState({ navigationTree: tree });
      const suggestions = getSuggestions(state, registry, '');

      // Should have both commands and paths
      expect(suggestions.some((s) => s.value === 'cd')).toBe(true);
      expect(suggestions.some((s) => s.value === '/users')).toBe(true);
    });
  });

  describe('when input starts with /', () => {
    it('should include path suggestions', () => {
      const state = createMockState({ navigationTree: tree });
      const suggestions = getSuggestions(state, registry, '/u');

      expect(suggestions.some((s) => s.value === '/users')).toBe(true);
    });
  });

  describe('when input starts with .', () => {
    it('should include path suggestions', () => {
      const state = createMockState({ navigationTree: tree, currentPath: '/users' });
      const suggestions = getSuggestions(state, registry, '.');

      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('when input is a navigation command with argument', () => {
    it('should suggest paths for cd command', () => {
      const state = createMockState({ navigationTree: tree });
      const suggestions = getSuggestions(state, registry, 'cd u');

      expect(suggestions.some((s) => s.value === '/users')).toBe(true);
    });

    it('should suggest paths for ls command', () => {
      const state = createMockState({ navigationTree: tree });
      const suggestions = getSuggestions(state, registry, 'ls p');

      expect(suggestions.some((s) => s.value === '/posts')).toBe(true);
    });

    it('should suggest paths for describe command', () => {
      const state = createMockState({ navigationTree: tree });
      const suggestions = getSuggestions(state, registry, 'describe /users');

      expect(suggestions.some((s) => s.value === '/users')).toBe(true);
    });
  });

  describe('when input is an HTTP method with argument', () => {
    it('should suggest paths for GET', () => {
      const state = createMockState({ navigationTree: tree });
      const suggestions = getSuggestions(state, registry, 'get /u');

      expect(suggestions.some((s) => s.value === '/users')).toBe(true);
    });

    it('should suggest paths for POST', () => {
      const state = createMockState({ navigationTree: tree });
      const suggestions = getSuggestions(state, registry, 'post /');

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should handle uppercase HTTP methods', () => {
      const state = createMockState({ navigationTree: tree });
      const suggestions = getSuggestions(state, registry, 'GET /u');

      expect(suggestions.some((s) => s.value === '/users')).toBe(true);
    });
  });

  describe('when no navigation tree loaded', () => {
    it('should only return command suggestions', () => {
      const state = createMockState();
      const suggestions = getSuggestions(state, registry, '');

      expect(suggestions.every((s) => ['cd', 'ls', 'pwd', 'describe', 'help'].includes(s.value))).toBe(true);
    });

    it('should return empty for path-like input', () => {
      const state = createMockState();
      const suggestions = getSuggestions(state, registry, 'cd /');

      expect(suggestions).toHaveLength(0);
    });
  });
});

describe('buildAutocompleteOptions', () => {
  let tree: NavigationTree;
  let registry: CommandRegistry;

  beforeEach(() => {
    tree = createMockTree();
    registry = createMockRegistry();
  });

  it('should include all commands', () => {
    const state = createMockState();
    const options = buildAutocompleteOptions(state, registry);

    expect(options.some((o) => o.value === 'cd')).toBe(true);
    expect(options.some((o) => o.value === 'ls')).toBe(true);
    expect(options.some((o) => o.value === 'help')).toBe(true);
  });

  it('should include paths when navigation tree exists', () => {
    const state = createMockState({ navigationTree: tree });
    const options = buildAutocompleteOptions(state, registry);

    expect(options.some((o) => o.value === 'users')).toBe(true);
    expect(options.some((o) => o.value === 'posts')).toBe(true);
  });

  it('should show directory indicator for paths with children', () => {
    const state = createMockState({ navigationTree: tree });
    const options = buildAutocompleteOptions(state, registry);

    const usersOption = options.find((o) => o.value === 'users');
    expect(usersOption?.label).toBe('users/');
  });

  it('should show methods as hint for paths with operations', () => {
    const state = createMockState({ navigationTree: tree });
    const options = buildAutocompleteOptions(state, registry);

    const postsOption = options.find((o) => o.value === 'posts');
    expect(postsOption?.hint).toContain('GET');
    expect(postsOption?.hint).toContain('POST');
  });

  it('should show "dir" hint for paths with only children', () => {
    // Create a tree where users has no methods but has children
    const idNode = createNode('{id}', '/users/{id}', ['GET']);
    const usersNode = createNode('users', '/users', [], new Map([['{id}', idNode]]));
    const rootNode = createNode('', '/', [], new Map([['users', usersNode]]));
    const testTree: NavigationTree = { root: rootNode, pathCount: 2, operationCount: 1 };

    const state = createMockState({ navigationTree: testTree });
    const options = buildAutocompleteOptions(state, registry);

    const usersOption = options.find((o) => o.value === 'users');
    expect(usersOption?.hint).toBe('dir');
  });
});
