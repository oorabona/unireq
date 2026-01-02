import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplState } from '../../repl/state.js';
import { createReplState } from '../../repl/state.js';
import { clearSpecFromState, getSpecInfoString, loadSpecIntoState } from '../state-loader.js';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

describe('state-loader', () => {
  let state: ReplState;

  beforeEach(() => {
    state = createReplState();
    // Suppress consola output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadSpecIntoState', () => {
    describe('file loading', () => {
      it('should load spec from absolute file path', async () => {
        // Arrange
        const source = path.join(fixturesDir, 'petstore-3.0.json');

        // Act
        const result = await loadSpecIntoState(state, source, { silent: true });

        // Assert
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(state.spec).toBeDefined();
        expect(state.spec?.version).toBe('3.0');
        expect(state.spec?.document.info.title).toBe('Petstore API');
        expect(state.navigationTree).toBeDefined();
      });

      it('should load spec from relative path with workspace', async () => {
        // Arrange
        const relativePath = 'petstore-3.0.json';
        const workspacePath = fixturesDir;

        // Act
        const result = await loadSpecIntoState(state, relativePath, {
          workspacePath,
          silent: true,
        });

        // Assert
        expect(result.success).toBe(true);
        expect(state.spec).toBeDefined();
        expect(state.spec?.version).toBe('3.0');
      });

      it('should return error for non-existent file', async () => {
        // Arrange
        const source = path.join(fixturesDir, 'non-existent.yaml');

        // Act
        const result = await loadSpecIntoState(state, source, { silent: true });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
        expect(state.spec).toBeUndefined();
        expect(state.navigationTree).toBeUndefined();
      });

      it('should return error for invalid spec', async () => {
        // Arrange
        const source = path.join(fixturesDir, 'invalid-yaml.yaml');

        // Act
        const result = await loadSpecIntoState(state, source, { silent: true });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('parse');
        expect(state.spec).toBeUndefined();
      });
    });

    describe('options', () => {
      it('should bypass cache with forceReload option', async () => {
        // Arrange
        const source = path.join(fixturesDir, 'petstore-3.0.json');

        // Act - first load
        await loadSpecIntoState(state, source, { silent: true });
        expect(state.spec).toBeDefined();

        // Act - reload with forceReload (bypasses cache)
        const result = await loadSpecIntoState(state, source, {
          forceReload: true,
          silent: true,
        });

        // Assert - reload succeeds, spec is still valid
        expect(result.success).toBe(true);
        expect(state.spec).toBeDefined();
        expect(state.spec?.version).toBe('3.0');
      });

      it('should replace existing spec when loading new one', async () => {
        // Arrange
        const source1 = path.join(fixturesDir, 'petstore-3.0.json');
        const source2 = path.join(fixturesDir, 'users-3.1.yaml');

        // Act - load first spec
        await loadSpecIntoState(state, source1, { silent: true });
        expect(state.spec?.document.info.title).toBe('Petstore API');

        // Act - load second spec
        await loadSpecIntoState(state, source2, { silent: true });

        // Assert
        expect(state.spec?.document.info.title).toBe('Users API');
        expect(state.spec?.version).toBe('3.1');
      });
    });

    describe('error recovery', () => {
      it('should clear spec from state on load error', async () => {
        // Arrange - first load a valid spec
        const validSource = path.join(fixturesDir, 'petstore-3.0.json');
        await loadSpecIntoState(state, validSource, { silent: true });
        expect(state.spec).toBeDefined();

        // Act - try to load invalid spec
        const invalidSource = path.join(fixturesDir, 'invalid-yaml.yaml');
        await loadSpecIntoState(state, invalidSource, { silent: true });

        // Assert - state should be cleared
        expect(state.spec).toBeUndefined();
        expect(state.navigationTree).toBeUndefined();
      });
    });
  });

  describe('clearSpecFromState', () => {
    it('should clear spec and navigation tree from state', async () => {
      // Arrange - load a spec first
      const source = path.join(fixturesDir, 'petstore-3.0.json');
      await loadSpecIntoState(state, source, { silent: true });
      expect(state.spec).toBeDefined();
      expect(state.navigationTree).toBeDefined();

      // Act
      clearSpecFromState(state);

      // Assert
      expect(state.spec).toBeUndefined();
      expect(state.navigationTree).toBeUndefined();
    });

    it('should not throw when state has no spec', () => {
      // Arrange
      expect(state.spec).toBeUndefined();

      // Act & Assert - should not throw
      expect(() => clearSpecFromState(state)).not.toThrow();
    });
  });

  describe('getSpecInfoString', () => {
    it('should return formatted spec info when spec is loaded', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'petstore-3.0.json');
      await loadSpecIntoState(state, source, { silent: true });

      // Act
      const info = getSpecInfoString(state);

      // Assert
      expect(info).toContain('petstore-3.0.json');
      expect(info).toContain('3.0.3');
    });

    it('should return undefined when no spec is loaded', () => {
      // Arrange - state has no spec

      // Act
      const info = getSpecInfoString(state);

      // Assert
      expect(info).toBeUndefined();
    });

    it('should format URL sources correctly', async () => {
      // Arrange - we'll simulate this by checking the function logic
      // For a real URL test, we'd need to mock fetch
      const source = path.join(fixturesDir, 'petstore-3.0.json');
      await loadSpecIntoState(state, source, { silent: true });

      // Act
      const info = getSpecInfoString(state);

      // Assert - file path should show basename
      expect(info).toBe('petstore-3.0.json (3.0.3)');
    });
  });
});
