/**
 * Integration tests for save command handler
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplState } from '../../repl/state.js';
import type { ParsedRequest } from '../../types.js';
import { saveHandler } from '../commands.js';

// Mock consola
vi.mock('consola', () => ({
  consola: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    log: vi.fn(),
  },
}));

import { consola } from 'consola';

describe('saveHandler', () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Create temp directory for tests
    tempDir = join(tmpdir(), `unireq-save-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  const createTestState = (overrides: Partial<ReplState> = {}): ReplState => ({
    currentPath: '/',
    running: true,
    workspace: tempDir,
    ...overrides,
  });

  const createTestRequest = (overrides: Partial<ParsedRequest> = {}): ParsedRequest => ({
    method: 'GET',
    url: '/health',
    headers: [],
    query: [],
    ...overrides,
  });

  describe('when no workspace is loaded', () => {
    it('should show warning message', async () => {
      // Arrange
      const state = createTestState({ workspace: undefined });

      // Act
      await saveHandler(['smoke/health'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No workspace loaded.');
      expect(consola.info).toHaveBeenCalledWith('Run from a directory with .unireq/ or use a global workspace.');
    });
  });

  describe('when no request has been executed', () => {
    it('should show warning message', async () => {
      // Arrange
      const state = createTestState({ lastRequest: undefined });

      // Act
      await saveHandler(['smoke/health'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No request to save.');
      expect(consola.info).toHaveBeenCalledWith('Execute a request first (e.g., get /health).');
    });
  });

  describe('when valid request is saved', () => {
    it('should save and show success message', async () => {
      // Arrange
      const state = createTestState({ lastRequest: createTestRequest() });

      // Act
      await saveHandler(['smoke/health'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('Created collection: smoke');
      expect(consola.success).toHaveBeenCalledWith('Saved: smoke/health');

      // Verify file was created
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('smoke');
      expect(content).toContain('health');
    });

    it('should save with custom name', async () => {
      // Arrange
      const state = createTestState({ lastRequest: createTestRequest() });

      // Act
      await saveHandler(['smoke/health', '--name', 'Health Check'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Saved: smoke/health');

      // Verify name in file
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('name: Health Check');
    });

    it('should show update message when item exists', async () => {
      // Arrange
      const existingYaml = `version: 1
collections:
  - id: smoke
    name: smoke
    items:
      - id: health
        name: Old Health
        request:
          method: GET
          path: /old
`;
      await writeFile(join(tempDir, 'collections.yaml'), existingYaml);
      const state = createTestState({ lastRequest: createTestRequest({ url: '/new' }) });

      // Act
      await saveHandler(['smoke/health'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Updated: smoke/health');
    });

    it('should not show collection created when adding to existing collection', async () => {
      // Arrange
      const existingYaml = `version: 1
collections:
  - id: smoke
    name: smoke
    items: []
`;
      await writeFile(join(tempDir, 'collections.yaml'), existingYaml);
      const state = createTestState({ lastRequest: createTestRequest() });

      // Act
      await saveHandler(['smoke/health'], state);

      // Assert
      expect(consola.info).not.toHaveBeenCalledWith('Created collection: smoke');
      expect(consola.success).toHaveBeenCalledWith('Saved: smoke/health');
    });
  });

  describe('when syntax is invalid', () => {
    it('should show usage for empty arguments', async () => {
      // Arrange
      const state = createTestState({ lastRequest: createTestRequest() });

      // Act
      await saveHandler([], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining('Usage: save <collection>/<item>'));
    });

    it('should show usage for missing slash', async () => {
      // Arrange
      const state = createTestState({ lastRequest: createTestRequest() });

      // Act
      await saveHandler(['smoke'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining("Use 'save smoke/<item>' format"));
    });

    it('should show error for invalid ID', async () => {
      // Arrange
      const state = createTestState({ lastRequest: createTestRequest() });

      // Act
      await saveHandler(['smoke test/health'], state);

      // Assert
      expect(consola.error).toHaveBeenCalledWith(expect.stringContaining('Invalid collection ID'));
    });
  });

  describe('when saving different request types', () => {
    it('should save POST request with body', async () => {
      // Arrange
      const request = createTestRequest({
        method: 'POST',
        url: '/users',
        headers: ['Content-Type:application/json'],
        body: '{"name":"Alice"}',
      });
      const state = createTestState({ lastRequest: request });

      // Act
      await saveHandler(['api/create-user'], state);

      // Assert
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('method: POST');
      expect(content).toContain('path: /users');
      expect(content).toContain('{"name":"Alice"}');
    });

    it('should save request with query params', async () => {
      // Arrange
      const request = createTestRequest({
        url: '/users',
        query: ['page=1', 'limit=10'],
      });
      const state = createTestState({ lastRequest: request });

      // Act
      await saveHandler(['api/list-users'], state);

      // Assert
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('page=1');
      expect(content).toContain('limit=10');
    });

    it('should extract path from full URL', async () => {
      // Arrange
      const request = createTestRequest({
        url: 'https://api.example.com/health?v=2',
      });
      const state = createTestState({ lastRequest: request });

      // Act
      await saveHandler(['smoke/health'], state);

      // Assert
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('path: /health');
      expect(content).toContain('v=2');
      // Should not contain the full URL
      expect(content).not.toContain('https://api.example.com');
    });
  });
});
