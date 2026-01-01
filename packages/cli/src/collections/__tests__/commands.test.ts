import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplState } from '../../repl/state.js';
import { createRunCommand, runHandler } from '../commands.js';

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
    log: vi.fn(),
  },
}));

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
