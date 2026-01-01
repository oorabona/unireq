import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplState } from '../../repl/state.js';
import { createReplState } from '../../repl/state.js';
import {
  createExtractCommand,
  createRunCommand,
  createSaveCommand,
  createVarsCommand,
  extractHandler,
  runHandler,
  varsHandler,
} from '../commands.js';

// Mock the executor
vi.mock('../../executor.js', () => ({
  executeRequest: vi.fn().mockResolvedValue(undefined),
}));

// Mock consola
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import mocked consola for assertions in extract/vars tests
import { consola as consolaMock } from 'consola';

describe('runHandler', () => {
  let testDir: string;
  let workspacePath: string;
  let consola: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let executeRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Create temp workspace
    testDir = join(tmpdir(), `unireq-commands-test-${Date.now()}`);
    workspacePath = join(testDir, '.unireq');
    await mkdir(workspacePath, { recursive: true });

    // Get mock references
    const consolaModule = await import('consola');
    consola = consolaModule.consola as unknown as typeof consola;
    const executorModule = await import('../../executor.js');
    executeRequest = executorModule.executeRequest as ReturnType<typeof vi.fn>;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  const createState = (workspace?: string): ReplState => ({
    currentPath: '/',
    running: true,
    workspace,
  });

  describe('Given no workspace loaded', () => {
    describe('When run is called', () => {
      it('Then shows no workspace error', async () => {
        // Arrange
        const state = createState(undefined);

        // Act
        await runHandler(['smoke/health'], state);

        // Assert
        expect(consola.warn).toHaveBeenCalledWith('No workspace loaded.');
        expect(consola.info).toHaveBeenCalledWith('Run from a directory with .unireq/ or use a global workspace.');
        expect(executeRequest).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given workspace with collections', () => {
    beforeEach(async () => {
      const collectionsYaml = `
version: 1
collections:
  - id: smoke
    name: Smoke Tests
    items:
      - id: health
        name: Health Check
        request:
          method: GET
          path: /health
      - id: status
        name: Status Check
        request:
          method: GET
          path: /status
  - id: api
    name: API Tests
    items:
      - id: users
        name: List Users
        request:
          method: GET
          path: /api/users
          headers:
            - "Authorization: Bearer token"
          query:
            - "limit=10"
      - id: create-user
        name: Create User
        request:
          method: POST
          path: /api/users
          body: '{"name": "Alice"}'
`;
      await writeFile(join(workspacePath, 'collections.yaml'), collectionsYaml);
    });

    describe('When run smoke/health is called', () => {
      it('Then executes the request', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Act
        await runHandler(['smoke/health'], state);

        // Assert
        expect(executeRequest).toHaveBeenCalledWith({
          method: 'GET',
          url: '/health',
          headers: [],
          query: [],
          body: undefined,
        });
      });
    });

    describe('When run api/users is called', () => {
      it('Then includes headers and query params', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Act
        await runHandler(['api/users'], state);

        // Assert
        expect(executeRequest).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/users',
          headers: ['Authorization: Bearer token'],
          query: ['limit=10'],
          body: undefined,
        });
      });
    });

    describe('When run api/create-user is called', () => {
      it('Then includes body', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Act
        await runHandler(['api/create-user'], state);

        // Assert
        expect(executeRequest).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/users',
          headers: [],
          query: [],
          body: '{"name": "Alice"}',
        });
      });
    });

    describe('When collection does not exist', () => {
      it('Then shows collection not found error', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Act
        await runHandler(['nonexistent/health'], state);

        // Assert
        expect(consola.error).toHaveBeenCalledWith(expect.stringContaining('Collection not found: nonexistent'));
        expect(executeRequest).not.toHaveBeenCalled();
      });
    });

    describe('When item does not exist', () => {
      it('Then shows item not found error', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Act
        await runHandler(['smoke/nonexistent'], state);

        // Assert
        expect(consola.error).toHaveBeenCalledWith(
          expect.stringContaining('Item not found: nonexistent in collection: smoke'),
        );
        expect(executeRequest).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given invalid arguments', () => {
    describe('When no arguments provided', () => {
      it('Then shows usage help', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Act
        await runHandler([], state);

        // Assert
        expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining('Usage: run'));
        expect(executeRequest).not.toHaveBeenCalled();
      });
    });

    describe('When missing slash separator', () => {
      it('Then shows usage help with hint', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Act
        await runHandler(['smoke'], state);

        // Assert
        expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining('run smoke/<item>'));
        expect(executeRequest).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given empty collections', () => {
    beforeEach(async () => {
      // No collections.yaml file = empty collections
      await rm(join(workspacePath, 'collections.yaml'), { force: true });
    });

    describe('When run is called', () => {
      it('Then shows no collections message', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Act
        await runHandler(['smoke/health'], state);

        // Assert
        expect(consola.error).toHaveBeenCalledWith(expect.stringContaining('No collections defined'));
      });
    });
  });

  describe('Given workspace with active profile', () => {
    beforeEach(async () => {
      const collectionsYaml = `
version: 1
collections:
  - id: smoke
    name: Smoke Tests
    items:
      - id: health
        name: Health Check
        request:
          method: GET
          path: /health
`;
      await writeFile(join(workspacePath, 'collections.yaml'), collectionsYaml);
    });

    describe('When profile has baseUrl', () => {
      it('Then prepends baseUrl to request path', async () => {
        // Arrange
        const state = createState(workspacePath);
        state.activeProfile = 'dev';
        state.workspaceConfig = {
          version: 1,
          profiles: {
            dev: {
              baseUrl: 'https://dev.api.example.com',
            },
          },
          openapi: { cache: { enabled: false, ttlMs: 0 } },
          auth: { providers: {} },
          vars: {},
        };

        // Act
        await runHandler(['smoke/health'], state);

        // Assert
        expect(executeRequest).toHaveBeenCalledWith({
          method: 'GET',
          url: 'https://dev.api.example.com/health',
          headers: [],
          query: [],
          body: undefined,
        });
      });
    });
  });

  describe('Given workspace with extract config', () => {
    beforeEach(async () => {
      const collectionsYaml = `
version: 1
collections:
  - id: auth
    name: Auth
    items:
      - id: login
        name: Login
        request:
          method: POST
          path: /login
          body: '{"username": "test"}'
        extract:
          vars:
            token: "$.access_token"
            userId: "$.user.id"
`;
      await writeFile(join(workspacePath, 'collections.yaml'), collectionsYaml);
    });

    describe('When run is called and response has extractable data', () => {
      it('Then extracts variables into state', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Mock executeRequest to return a response body
        executeRequest.mockResolvedValueOnce({
          status: 200,
          body: '{"access_token":"jwt.token.here","user":{"id":"user-42"}}',
        });

        // Act
        await runHandler(['auth/login'], state);

        // Assert
        expect(state.extractedVars).toBeDefined();
        expect(state.extractedVars?.['token']).toBe('jwt.token.here');
        expect(state.extractedVars?.['userId']).toBe('user-42');
      });

      it('Then stores lastResponseBody for manual extraction', async () => {
        // Arrange
        const state = createState(workspacePath);

        // Mock executeRequest to return a response body
        executeRequest.mockResolvedValueOnce({
          status: 200,
          body: '{"data":"test"}',
        });

        // Act
        await runHandler(['auth/login'], state);

        // Assert
        expect(state.lastResponseBody).toBe('{"data":"test"}');
      });
    });

    describe('When run is called with extracted vars in state', () => {
      it('Then interpolates vars in subsequent requests', async () => {
        // Arrange
        const collectionsWithVar = `
version: 1
collections:
  - id: api
    name: API
    items:
      - id: profile
        name: Get Profile
        request:
          method: GET
          path: /users/\${var:userId}
          headers:
            - "Authorization: Bearer \${var:token}"
`;
        await writeFile(join(workspacePath, 'collections.yaml'), collectionsWithVar);

        const state = createState(workspacePath);
        state.extractedVars = {
          userId: 'user-123',
          token: 'secret-jwt-token',
        };

        // Act
        await runHandler(['api/profile'], state);

        // Assert
        expect(executeRequest).toHaveBeenCalledWith({
          method: 'GET',
          url: '/users/user-123',
          headers: ['Authorization: Bearer secret-jwt-token'],
          query: [],
          body: undefined,
        });
      });
    });
  });
});

describe('createRunCommand', () => {
  it('should create command with correct name', () => {
    // Act
    const command = createRunCommand();

    // Assert
    expect(command.name).toBe('run');
    expect(command.description).toBe('Execute a saved request from collections');
    expect(command.handler).toBe(runHandler);
  });
});

describe('extractHandler', () => {
  let state: ReplState;

  beforeEach(() => {
    state = createReplState();
    vi.clearAllMocks();
  });

  describe('when no response body exists', () => {
    it('should warn and return', async () => {
      // Arrange
      state.lastResponseBody = undefined;

      // Act
      await extractHandler(['token', '$.access_token'], state);

      // Assert
      expect(consolaMock.warn).toHaveBeenCalledWith('No response to extract from.');
    });
  });

  describe('when arguments are missing', () => {
    it('should warn with usage when no args', async () => {
      // Arrange
      state.lastResponseBody = '{"token":"abc"}';

      // Act
      await extractHandler([], state);

      // Assert
      expect(consolaMock.warn).toHaveBeenCalledWith('Usage: extract <varName> <jsonPath>');
    });

    it('should warn with usage when only one arg', async () => {
      // Arrange
      state.lastResponseBody = '{"token":"abc"}';

      // Act
      await extractHandler(['token'], state);

      // Assert
      expect(consolaMock.warn).toHaveBeenCalledWith('Usage: extract <varName> <jsonPath>');
    });
  });

  describe('when extracting successfully', () => {
    it('should extract and store variable', async () => {
      // Arrange
      state.lastResponseBody = '{"access_token":"jwt.token.here"}';

      // Act
      await extractHandler(['token', '$.access_token'], state);

      // Assert
      expect(state.extractedVars).toBeDefined();
      expect(state.extractedVars?.['token']).toBe('jwt.token.here');
      expect(consolaMock.success).toHaveBeenCalled();
    });

    it('should extract nested value', async () => {
      // Arrange
      state.lastResponseBody = '{"data":{"user":{"id":"user123"}}}';

      // Act
      await extractHandler(['userId', '$.data.user.id'], state);

      // Assert
      expect(state.extractedVars?.['userId']).toBe('user123');
    });

    it('should extract from array', async () => {
      // Arrange
      state.lastResponseBody = '{"items":[{"id":1},{"id":2}]}';

      // Act
      await extractHandler(['firstId', '$.items[0].id'], state);

      // Assert
      expect(state.extractedVars?.['firstId']).toBe('1');
    });

    it('should overwrite existing variable', async () => {
      // Arrange
      state.lastResponseBody = '{"value":"new"}';
      state.extractedVars = { value: 'old' };

      // Act
      await extractHandler(['value', '$.value'], state);

      // Assert
      expect(state.extractedVars?.['value']).toBe('new');
    });
  });

  describe('when extraction fails', () => {
    it('should handle optional path not found', async () => {
      // Arrange
      state.lastResponseBody = '{"data":{}}';

      // Act
      await extractHandler(['token', '$.token?'], state);

      // Assert
      expect(consolaMock.info).toHaveBeenCalledWith('Optional path not found: $.token?');
      expect(state.extractedVars?.['token']).toBeUndefined();
    });

    it('should error for required path not found', async () => {
      // Arrange
      state.lastResponseBody = '{"data":{}}';

      // Act
      await extractHandler(['token', '$.token'], state);

      // Assert
      expect(consolaMock.error).toHaveBeenCalled();
    });

    it('should error for invalid path', async () => {
      // Arrange
      state.lastResponseBody = '{"token":"abc"}';

      // Act
      await extractHandler(['token', 'invalid'], state);

      // Assert
      expect(consolaMock.error).toHaveBeenCalled();
    });
  });
});

describe('varsHandler', () => {
  let state: ReplState;

  beforeEach(() => {
    state = createReplState();
    vi.clearAllMocks();
  });

  describe('when no variables exist', () => {
    it('should show info message when undefined', async () => {
      // Arrange
      state.extractedVars = undefined;

      // Act
      await varsHandler([], state);

      // Assert
      expect(consolaMock.info).toHaveBeenCalledWith('No extracted variables.');
    });

    it('should show info message when empty', async () => {
      // Arrange
      state.extractedVars = {};

      // Act
      await varsHandler([], state);

      // Assert
      expect(consolaMock.info).toHaveBeenCalledWith('No extracted variables.');
    });
  });

  describe('when variables exist', () => {
    it('should list all variables', async () => {
      // Arrange
      state.extractedVars = {
        token: 'abc123',
        userId: '42',
      };

      // Act
      await varsHandler([], state);

      // Assert
      expect(consolaMock.info).toHaveBeenCalledWith('Extracted variables:');
      expect(consolaMock.log).toHaveBeenCalledTimes(2);
    });

    it('should truncate long values', async () => {
      // Arrange
      const longValue = 'x'.repeat(100);
      state.extractedVars = { longVar: longValue };

      // Act
      await varsHandler([], state);

      // Assert
      expect(consolaMock.log).toHaveBeenCalledWith(expect.stringContaining('...'));
    });
  });
});

describe('command creators', () => {
  it('createExtractCommand should return valid command', () => {
    // Act
    const command = createExtractCommand();

    // Assert
    expect(command.name).toBe('extract');
    expect(command.description).toBeDefined();
    expect(command.handler).toBe(extractHandler);
  });

  it('createVarsCommand should return valid command', () => {
    // Act
    const command = createVarsCommand();

    // Assert
    expect(command.name).toBe('vars');
    expect(command.description).toBeDefined();
    expect(command.handler).toBe(varsHandler);
  });

  it('createSaveCommand should return valid command', () => {
    // Act
    const command = createSaveCommand();

    // Assert
    expect(command.name).toBe('save');
    expect(command.description).toBeDefined();
  });
});
