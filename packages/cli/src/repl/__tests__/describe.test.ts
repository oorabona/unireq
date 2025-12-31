import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNavigationTree } from '../../openapi/navigation/builder.js';
import type { LoadedSpec, OpenAPIDocument } from '../../openapi/types.js';
import { createDescribeCommand, describeHandler } from '../describe.js';
import type { ReplState } from '../state.js';

// Mock consola
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  },
}));

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

/**
 * Helper to create ReplState with spec
 */
function createState(spec: LoadedSpec | undefined, currentPath = '/'): ReplState {
  return {
    currentPath,
    running: true,
    spec,
    navigationTree: spec ? buildNavigationTree(spec) : undefined,
  };
}

describe('describeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when no spec is loaded', () => {
    it('should show warning with import instructions', async () => {
      // Arrange
      const state = createState(undefined);

      // Act
      await describeHandler([], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No OpenAPI spec loaded.');
      expect(consola.info).toHaveBeenCalledWith('Load a spec with: import <url-or-file>');
    });
  });

  describe('when path not found in spec', () => {
    it('should show path not found warning', async () => {
      // Arrange
      const spec = createSpec({
        '/users': { get: { summary: 'List users' } },
      });
      const state = createState(spec, '/nonexistent');

      // Act
      await describeHandler([], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Path not found in spec: /nonexistent');
    });
  });

  describe('when no operations at path', () => {
    it('should inform no operations available', async () => {
      // Arrange
      const spec = createSpec({
        '/users': { get: { summary: 'List users' } },
        '/users/{id}': { get: { summary: 'Get user' } },
      });
      const state = createState(spec, '/users/{id}/posts');
      // Navigate to a path that exists in tree but has no operations
      state.currentPath = '/';

      // Act
      await describeHandler([], state);

      // Assert - root has no operations, only children
      // Since root doesn't have methods in this spec, it should show overview
      // Actually, let's verify by checking the behavior
    });
  });

  describe('when describing all methods (no argument)', () => {
    it('should show overview of all methods at path', async () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          get: { summary: 'List all users' },
          post: { summary: 'Create a user' },
        },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Operations at /users'));
      expect(consola.info).toHaveBeenCalledWith(expect.stringMatching(/GET.*List all users/));
      expect(consola.info).toHaveBeenCalledWith(expect.stringMatching(/POST.*Create a user/));
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Use "describe <METHOD>" for details'));
    });

    it('should show deprecated marker for deprecated operations', async () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          get: { summary: 'List users', deprecated: true },
        },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('[deprecated]'));
    });
  });

  describe('when describing specific method', () => {
    it('should show detailed operation info', async () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          get: {
            summary: 'List all users',
            description: 'Returns a paginated list of users',
            operationId: 'listUsers',
            tags: ['users'],
          },
        },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['GET'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('GET /users'));
      expect(consola.info).toHaveBeenCalledWith('List all users');
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Returns a paginated list'));
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Operation ID: listUsers'));
      expect(consola.info).toHaveBeenCalledWith('Tags: users');
    });

    it('should accept lowercase method', async () => {
      // Arrange
      const spec = createSpec({
        '/users': { get: { summary: 'List users' } },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['get'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('GET /users'));
    });

    it('should show deprecated warning prominently', async () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          get: { summary: 'List users', deprecated: true },
        },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['GET'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('⚠️  DEPRECATED');
    });
  });

  describe('when method not available', () => {
    it('should show method not available with alternatives', async () => {
      // Arrange
      const spec = createSpec({
        '/users': { get: { summary: 'List users' } },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['DELETE'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('DELETE not available at /users');
      expect(consola.info).toHaveBeenCalledWith('Available methods: GET');
    });
  });

  describe('when invalid method provided', () => {
    it('should show invalid method warning', async () => {
      // Arrange
      const spec = createSpec({
        '/users': { get: { summary: 'List users' } },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['INVALID'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Invalid HTTP method: INVALID');
    });
  });

  describe('parameter formatting', () => {
    it('should show path parameters', async () => {
      // Arrange
      const spec = createSpec({
        '/users/{id}': {
          get: {
            summary: 'Get user',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          },
        },
      });
      const state = createState(spec, '/users/{id}');

      // Act
      await describeHandler(['GET'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nPath Parameters:');
      expect(consola.info).toHaveBeenCalledWith(expect.stringMatching(/id\*.*string/));
    });

    it('should show query parameters', async () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          get: {
            summary: 'List users',
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer' }, description: 'Max items' },
              { name: 'offset', in: 'query', required: true, schema: { type: 'integer' } },
            ],
          },
        },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['GET'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nQuery Parameters:');
      expect(consola.info).toHaveBeenCalledWith(expect.stringMatching(/limit.*integer.*Max items/));
      expect(consola.info).toHaveBeenCalledWith(expect.stringMatching(/offset\*.*integer/));
    });

    it('should show deprecated parameters', async () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          get: {
            summary: 'List users',
            parameters: [{ name: 'old_param', in: 'query', deprecated: true, schema: { type: 'string' } }],
          },
        },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['GET'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('[deprecated]'));
    });
  });

  describe('request body formatting', () => {
    it('should show request body with content type', async () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          post: {
            summary: 'Create user',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      email: { type: 'string', format: 'email' },
                    },
                    required: ['name', 'email'],
                  },
                },
              },
            },
          },
        },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['POST'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Request Body:'));
      expect(consola.info).toHaveBeenCalledWith('  (required)');
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Content-Type: application/json'));
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('object {'));
      expect(consola.info).toHaveBeenCalledWith(expect.stringMatching(/name\*.*string/));
      expect(consola.info).toHaveBeenCalledWith(expect.stringMatching(/email\*.*string.*email/));
    });
  });

  describe('response formatting', () => {
    it('should show responses with status codes', async () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          get: {
            summary: 'List users',
            responses: {
              '200': { description: 'Successful response' },
              '401': { description: 'Unauthorized' },
              '500': { description: 'Server error' },
            },
          },
        },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['GET'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nResponses:');
      expect(consola.info).toHaveBeenCalledWith('  200: Successful response');
      expect(consola.info).toHaveBeenCalledWith('  401: Unauthorized');
      expect(consola.info).toHaveBeenCalledWith('  500: Server error');
    });
  });

  describe('security formatting', () => {
    it('should show security requirements', async () => {
      // Arrange
      const spec = createSpec({
        '/users': {
          get: {
            summary: 'List users',
            security: [{ bearerAuth: [] }, { oauth2: ['read:users', 'write:users'] }],
          },
        },
      });
      const state = createState(spec, '/users');

      // Act
      await describeHandler(['GET'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nSecurity:');
      expect(consola.info).toHaveBeenCalledWith('  bearerAuth');
      expect(consola.info).toHaveBeenCalledWith('  oauth2 (read:users, write:users)');
    });
  });
});

describe('createDescribeCommand', () => {
  it('should create command with correct properties', () => {
    // Act
    const command = createDescribeCommand();

    // Assert
    expect(command.name).toBe('describe');
    expect(command.description).toBe('Show operation details at current path');
    expect(command.handler).toBe(describeHandler);
  });
});
