/**
 * Tests for readline-compatible completer
 */

import { describe, expect, it } from 'vitest';
import type { HttpMethod, NavigationNode, NavigationTree } from '../../openapi/navigation/types.js';
import { createDefaultRegistry } from '../commands.js';
import { createCompleter, formatCompletionsForDisplay } from '../completer.js';
import { createReplState } from '../state.js';

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

// Create mock navigation tree for testing
function createMockTree(): NavigationTree {
  const idNode = createNode('{id}', '/users/{id}', ['GET', 'PUT', 'DELETE'], new Map(), true);
  const usersNode = createNode('users', '/users', ['GET', 'POST'], new Map([['{id}', idNode]]));
  const ordersNode = createNode('orders', '/orders', ['GET', 'POST']);

  const rootNode = createNode(
    '',
    '/',
    [],
    new Map([
      ['users', usersNode],
      ['orders', ordersNode],
    ]),
  );

  return {
    root: rootNode,
    pathCount: 3,
    operationCount: 7,
  };
}

describe('createCompleter', () => {
  describe('command completion', () => {
    it('should complete command names', () => {
      // Arrange
      const state = createReplState();
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('hel');

      // Assert
      expect(completions).toContain('help');
      expect(base).toBe('hel');
    });

    it('should complete empty input with all commands', () => {
      // Arrange
      const state = createReplState();
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('');

      // Assert
      expect(completions.length).toBeGreaterThan(0);
      expect(completions).toContain('help');
      expect(completions).toContain('exit');
      expect(base).toBe('');
    });

    it('should handle partial command match', () => {
      // Arrange
      const state = createReplState();
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('ex');

      // Assert
      expect(completions).toContain('exit');
      expect(base).toBe('ex');
    });

    it('should return empty for non-matching input', () => {
      // Arrange
      const state = createReplState();
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('xyz123');

      // Assert
      expect(completions.length).toBe(0);
      expect(base).toBe('xyz123');
    });
  });

  describe('path completion', () => {
    it('should complete paths from navigation tree', () => {
      // Arrange
      const tree = createMockTree();
      const state = createReplState();
      state.navigationTree = tree;
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('/u');

      // Assert
      expect(completions).toContain('/users');
      expect(base).toBe('/u');
    });

    it('should complete child paths', () => {
      // Arrange
      const tree = createMockTree();
      const state = createReplState();
      state.navigationTree = tree;
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('/users/');

      // Assert
      expect(completions.some((c) => c.includes('{id}'))).toBe(true);
      // Base is the last "word" being completed (the full path since no space)
      expect(base).toBe('/users/');
    });

    it('should complete paths after HTTP method', () => {
      // Arrange
      const tree = createMockTree();
      const state = createReplState();
      state.navigationTree = tree;
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('get /u');

      // Assert
      expect(completions).toContain('/users');
      expect(base).toBe('/u');
    });

    it('should complete paths after cd command', () => {
      // Arrange
      const tree = createMockTree();
      const state = createReplState();
      state.navigationTree = tree;
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('cd /o');

      // Assert
      expect(completions).toContain('/orders');
      expect(base).toBe('/o');
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace-only input', () => {
      // Arrange
      const state = createReplState();
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('   ');

      // Assert
      expect(completions.length).toBeGreaterThan(0);
      expect(base).toBe('');
    });

    it('should handle input with leading whitespace', () => {
      // Arrange
      const state = createReplState();
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('  hel');

      // Assert
      expect(completions).toContain('help');
      expect(base).toBe('hel');
    });

    it('should handle multiple spaces between words', () => {
      // Arrange
      const tree = createMockTree();
      const state = createReplState();
      state.navigationTree = tree;
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('get   /u');

      // Assert
      expect(completions).toContain('/users');
      expect(base).toBe('/u');
    });

    it('should return line for no suggestions', () => {
      // Arrange
      const state = createReplState();
      const registry = createDefaultRegistry();
      const completer = createCompleter(state, registry);

      // Act
      const [completions, base] = completer('nonexistent');

      // Assert
      expect(completions.length).toBe(0);
      expect(base).toBe('nonexistent');
    });
  });
});

describe('formatCompletionsForDisplay', () => {
  it('should format completions with hints', () => {
    // Arrange
    const state = createReplState();
    const registry = createDefaultRegistry();

    // Act
    const formatted = formatCompletionsForDisplay(state, registry, '');

    // Assert
    expect(formatted.length).toBeGreaterThan(0);
    // Help command should have description
    const helpLine = formatted.find((f) => f.startsWith('help'));
    expect(helpLine).toBeDefined();
  });

  it('should format path completions with methods', () => {
    // Arrange
    const tree = createMockTree();
    const state = createReplState();
    state.navigationTree = tree;
    const registry = createDefaultRegistry();

    // Act
    const formatted = formatCompletionsForDisplay(state, registry, '/');

    // Assert
    expect(formatted.some((f) => f.includes('users'))).toBe(true);
  });
});
