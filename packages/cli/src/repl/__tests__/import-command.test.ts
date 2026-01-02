import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImportCommand, importHandler } from '../import-command.js';
import type { ReplState } from '../state.js';
import { createReplState } from '../state.js';

const fixturesDir = path.join(import.meta.dirname, '../../openapi/__tests__/fixtures');

describe('import-command', () => {
  let state: ReplState;

  beforeEach(() => {
    state = createReplState();
    // Suppress consola output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createImportCommand', () => {
    it('should create command with correct properties', () => {
      // Arrange & Act
      const command = createImportCommand();

      // Assert
      expect(command.name).toBe('import');
      expect(command.description).toContain('OpenAPI');
      expect(command.handler).toBe(importHandler);
      expect(command.helpText).toContain('--reload');
    });
  });

  describe('importHandler', () => {
    describe('argument validation', () => {
      it('should show error when no source provided', async () => {
        // Arrange
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // Act
        await importHandler([], state);

        // Assert
        expect(state.spec).toBeUndefined();
        // Error is shown via consola.error
      });

      it('should reject http:// URLs', async () => {
        // Arrange
        const args = ['http://example.com/api.yaml'];

        // Act
        await importHandler(args, state);

        // Assert
        expect(state.spec).toBeUndefined();
        // Error about HTTPS required is shown via consola.error
      });
    });

    describe('file loading', () => {
      it('should load spec from file path', async () => {
        // Arrange
        const source = path.join(fixturesDir, 'petstore-3.0.json');
        const args = [source];

        // Act
        await importHandler(args, state);

        // Assert
        expect(state.spec).toBeDefined();
        expect(state.spec?.document.info.title).toBe('Petstore API');
        expect(state.navigationTree).toBeDefined();
      });

      it('should load spec with --reload flag', async () => {
        // Arrange
        const source = path.join(fixturesDir, 'petstore-3.0.json');

        // Act - first load
        await importHandler([source], state);
        expect(state.spec).toBeDefined();

        // Act - reload with --reload flag
        await importHandler([source, '--reload'], state);

        // Assert
        expect(state.spec).toBeDefined();
        expect(state.spec?.version).toBe('3.0');
      });

      it('should load spec with -r short flag', async () => {
        // Arrange
        const source = path.join(fixturesDir, 'petstore-3.0.json');

        // Act
        await importHandler([source, '-r'], state);

        // Assert
        expect(state.spec).toBeDefined();
      });

      it('should replace existing spec when importing new one', async () => {
        // Arrange
        const source1 = path.join(fixturesDir, 'petstore-3.0.json');
        const source2 = path.join(fixturesDir, 'users-3.1.yaml');

        // Act - load first spec
        await importHandler([source1], state);
        expect(state.spec?.document.info.title).toBe('Petstore API');

        // Act - load second spec
        await importHandler([source2], state);

        // Assert
        expect(state.spec?.document.info.title).toBe('Users API');
        expect(state.spec?.version).toBe('3.1');
      });
    });

    describe('error handling', () => {
      it('should handle file not found', async () => {
        // Arrange
        const args = ['/nonexistent/path/to/spec.yaml'];

        // Act
        await importHandler(args, state);

        // Assert
        expect(state.spec).toBeUndefined();
      });

      it('should handle invalid spec', async () => {
        // Arrange
        const source = path.join(fixturesDir, 'invalid-yaml.yaml');

        // Act
        await importHandler([source], state);

        // Assert
        expect(state.spec).toBeUndefined();
      });
    });
  });
});
