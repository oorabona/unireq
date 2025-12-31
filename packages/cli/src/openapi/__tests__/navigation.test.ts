import { describe, expect, it } from 'vitest';
import { buildNavigationTree } from '../navigation/builder';
import { getMethods, getNode, getOperation, getOperations, listChildren, pathExists } from '../navigation/queries';
import type { LoadedSpec, OpenAPIDocument } from '../types';

/**
 * Helper to create a LoadedSpec for testing
 */
function createSpec(paths: OpenAPIDocument['paths']): LoadedSpec {
  return {
    version: '3.1',
    versionFull: '3.1.0',
    source: 'test.yaml',
    document: {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths,
    },
  };
}

describe('buildNavigationTree', () => {
  describe('basic tree building', () => {
    it('should build tree from simple paths', () => {
      // Arrange
      const spec = createSpec({
        '/users': { get: { summary: 'List users' } },
        '/users/{id}': { get: { summary: 'Get user' } },
      });

      // Act
      const tree = buildNavigationTree(spec);

      // Assert
      expect(tree.root.children.has('users')).toBe(true);
      const usersNode = tree.root.children.get('users');
      expect(usersNode).toBeDefined();
      expect(usersNode?.children.has('{id}')).toBe(true);
    });

    it('should handle empty spec', () => {
      // Arrange
      const spec = createSpec({});

      // Act
      const tree = buildNavigationTree(spec);

      // Assert
      expect(tree.root.children.size).toBe(0);
      expect(tree.pathCount).toBe(0);
      expect(tree.operationCount).toBe(0);
    });

    it('should handle spec without paths', () => {
      // Arrange
      const spec: LoadedSpec = {
        version: '3.1',
        versionFull: '3.1.0',
        source: 'test.yaml',
        document: {
          openapi: '3.1.0',
          info: { title: 'Test API', version: '1.0.0' },
        },
      };

      // Act
      const tree = buildNavigationTree(spec);

      // Assert
      expect(tree.pathCount).toBe(0);
    });
  });

  describe('path parameter handling', () => {
    it('should mark path parameters with isParameter: true', () => {
      // Arrange
      const spec = createSpec({
        '/users/{id}': { get: { summary: 'Get user' } },
      });

      // Act
      const tree = buildNavigationTree(spec);

      // Assert
      const usersNode = tree.root.children.get('users');
      const idNode = usersNode?.children.get('{id}');
      expect(idNode).toBeDefined();
      expect(idNode?.isParameter).toBe(true);
      expect(idNode?.name).toBe('{id}');
    });

    it('should handle nested parameters', () => {
      // Arrange
      const spec = createSpec({
        '/orgs/{orgId}/members/{memberId}': { get: { summary: 'Get member' } },
      });

      // Act
      const tree = buildNavigationTree(spec);

      // Assert
      const orgsNode = tree.root.children.get('orgs');
      expect(orgsNode).toBeDefined();
      const orgIdNode = orgsNode?.children.get('{orgId}');
      expect(orgIdNode).toBeDefined();
      const membersNode = orgIdNode?.children.get('members');
      expect(membersNode).toBeDefined();
      const memberIdNode = membersNode?.children.get('{memberId}');
      expect(memberIdNode).toBeDefined();

      expect(orgIdNode?.isParameter).toBe(true);
      expect(membersNode?.isParameter).toBe(false);
      expect(memberIdNode?.isParameter).toBe(true);
    });
  });

  describe('method detection', () => {
    it('should detect all HTTP methods', () => {
      // Arrange
      const spec = createSpec({
        '/resource': {
          get: { summary: 'Get' },
          post: { summary: 'Create' },
          put: { summary: 'Update' },
          patch: { summary: 'Partial update' },
          delete: { summary: 'Delete' },
        },
      });

      // Act
      const tree = buildNavigationTree(spec);

      // Assert
      const node = tree.root.children.get('resource');
      expect(node).toBeDefined();
      expect(node?.methods).toContain('GET');
      expect(node?.methods).toContain('POST');
      expect(node?.methods).toContain('PUT');
      expect(node?.methods).toContain('PATCH');
      expect(node?.methods).toContain('DELETE');
    });

    it('should count operations correctly', () => {
      // Arrange
      const spec = createSpec({
        '/users': { get: {}, post: {} },
        '/users/{id}': { get: {}, put: {}, delete: {} },
      });

      // Act
      const tree = buildNavigationTree(spec);

      // Assert
      expect(tree.operationCount).toBe(5);
      expect(tree.pathCount).toBe(2);
    });
  });

  describe('operation info extraction', () => {
    it('should extract operation metadata', () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          get: {
            summary: 'List all users',
            description: 'Returns a list of users',
            operationId: 'listUsers',
            deprecated: false,
            tags: ['users'],
          },
        },
      });

      // Act
      const tree = buildNavigationTree(spec);

      // Assert
      const node = tree.root.children.get('users');
      expect(node).toBeDefined();
      const opInfo = node?.operations.get('GET');
      expect(opInfo).toBeDefined();
      expect(opInfo?.summary).toBe('List all users');
      expect(opInfo?.description).toBe('Returns a list of users');
      expect(opInfo?.operationId).toBe('listUsers');
      expect(opInfo?.deprecated).toBe(false);
      expect(opInfo?.tags).toEqual(['users']);
    });
  });

  describe('root path operations', () => {
    it('should handle operations at root path', () => {
      // Arrange
      const spec = createSpec({
        '/': { get: { summary: 'Root' } },
        '/users': { get: { summary: 'Users' } },
      });

      // Act
      const tree = buildNavigationTree(spec);

      // Assert
      expect(tree.root.methods).toContain('GET');
    });
  });
});

describe('query functions', () => {
  // Setup a tree for query tests
  const spec = createSpec({
    '/': { get: { summary: 'Root' } },
    '/users': { get: { summary: 'List users' }, post: { summary: 'Create user' } },
    '/users/{id}': {
      get: { summary: 'Get user' },
      put: { summary: 'Update user' },
      delete: { summary: 'Delete user' },
    },
    '/users/{id}/posts': { get: { summary: 'List user posts' } },
  });
  const tree = buildNavigationTree(spec);

  describe('getNode', () => {
    it('should get root node', () => {
      // Act
      const node = getNode(tree, '/');

      // Assert
      expect(node).toBe(tree.root);
    });

    it('should get node at path', () => {
      // Act
      const node = getNode(tree, '/users');

      // Assert
      expect(node?.name).toBe('users');
      expect(node?.path).toBe('/users');
    });

    it('should get nested node', () => {
      // Act
      const node = getNode(tree, '/users/{id}');

      // Assert
      expect(node?.name).toBe('{id}');
      expect(node?.isParameter).toBe(true);
    });

    it('should return undefined for non-existent path', () => {
      // Act
      const node = getNode(tree, '/nonexistent');

      // Assert
      expect(node).toBeUndefined();
    });

    it('should handle empty path as root', () => {
      // Act
      const node = getNode(tree, '');

      // Assert
      expect(node).toBe(tree.root);
    });
  });

  describe('pathExists', () => {
    it('should return true for existing path', () => {
      expect(pathExists(tree, '/users')).toBe(true);
      expect(pathExists(tree, '/users/{id}')).toBe(true);
    });

    it('should return false for non-existing path', () => {
      expect(pathExists(tree, '/nonexistent')).toBe(false);
    });
  });

  describe('listChildren', () => {
    it('should list children at root', () => {
      // Act
      const children = listChildren(tree, '/');

      // Assert
      expect(children.length).toBe(1);
      expect(children[0]?.name).toBe('users');
    });

    it('should list children at path', () => {
      // Act
      const children = listChildren(tree, '/users');

      // Assert
      expect(children.length).toBe(1);
      expect(children[0]?.name).toBe('{id}');
    });

    it('should list multiple children', () => {
      // Arrange
      const multiSpec = createSpec({
        '/users': { get: {} },
        '/posts': { get: {} },
        '/comments': { get: {} },
      });
      const multiTree = buildNavigationTree(multiSpec);

      // Act
      const children = listChildren(multiTree, '/');

      // Assert
      expect(children.length).toBe(3);
      const names = children.map((c) => c.name).sort();
      expect(names).toEqual(['comments', 'posts', 'users']);
    });

    it('should return empty array for non-existent path', () => {
      // Act
      const children = listChildren(tree, '/nonexistent');

      // Assert
      expect(children).toEqual([]);
    });
  });

  describe('getMethods', () => {
    it('should get methods at path', () => {
      // Act
      const methods = getMethods(tree, '/users');

      // Assert
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
    });

    it('should get methods at nested path', () => {
      // Act
      const methods = getMethods(tree, '/users/{id}');

      // Assert
      expect(methods).toContain('GET');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
    });

    it('should return empty array for non-existent path', () => {
      // Act
      const methods = getMethods(tree, '/nonexistent');

      // Assert
      expect(methods).toEqual([]);
    });

    it('should get methods at root', () => {
      // Act
      const methods = getMethods(tree, '/');

      // Assert
      expect(methods).toContain('GET');
    });
  });

  describe('getOperation', () => {
    it('should get operation info', () => {
      // Act
      const op = getOperation(tree, '/users', 'GET');

      // Assert
      expect(op?.method).toBe('GET');
      expect(op?.summary).toBe('List users');
    });

    it('should return undefined for non-existent method', () => {
      // Act
      const op = getOperation(tree, '/users', 'DELETE');

      // Assert
      expect(op).toBeUndefined();
    });
  });

  describe('getOperations', () => {
    it('should get all operations at path', () => {
      // Act
      const ops = getOperations(tree, '/users/{id}');

      // Assert
      expect(ops.length).toBe(3);
      const methods = ops.map((o) => o.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
    });
  });
});
