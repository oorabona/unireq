/**
 * Tests for workspace detection
 * Following AAA pattern for unit tests
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WORKSPACE_DIR_NAME } from '../workspace/constants.js';
import { findWorkspace } from '../workspace/detection.js';

describe('findWorkspace', () => {
  let testRoot: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    testRoot = mkdtempSync(join(tmpdir(), 'unireq-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    rmSync(testRoot, { recursive: true, force: true });
  });

  describe('when workspace exists in current directory', () => {
    it('should find workspace in the start directory', () => {
      // Arrange
      const workspaceDir = join(testRoot, WORKSPACE_DIR_NAME);
      mkdirSync(workspaceDir);

      // Act
      const result = findWorkspace({ startDir: testRoot });

      // Assert
      expect(result).not.toBeNull();
      expect(result?.path).toBe(workspaceDir);
      expect(result?.scope).toBe('local');
    });
  });

  describe('when workspace exists in parent directory', () => {
    it('should walk up and find the workspace', () => {
      // Arrange
      const workspaceDir = join(testRoot, WORKSPACE_DIR_NAME);
      mkdirSync(workspaceDir);
      const nestedDir = join(testRoot, 'src', 'utils');
      mkdirSync(nestedDir, { recursive: true });

      // Act
      const result = findWorkspace({ startDir: nestedDir });

      // Assert
      expect(result).not.toBeNull();
      expect(result?.path).toBe(workspaceDir);
      expect(result?.scope).toBe('local');
    });

    it('should find workspace several levels up', () => {
      // Arrange
      const workspaceDir = join(testRoot, WORKSPACE_DIR_NAME);
      mkdirSync(workspaceDir);
      const deepNestedDir = join(testRoot, 'a', 'b', 'c', 'd', 'e');
      mkdirSync(deepNestedDir, { recursive: true });

      // Act
      const result = findWorkspace({ startDir: deepNestedDir });

      // Assert
      expect(result).not.toBeNull();
      expect(result?.path).toBe(workspaceDir);
    });
  });

  describe('when no workspace exists', () => {
    it('should return null when no .unireq directory exists', () => {
      // Arrange
      const emptyDir = join(testRoot, 'empty');
      mkdirSync(emptyDir);

      // Act
      const result = findWorkspace({ startDir: emptyDir });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('when .unireq is a file not a directory', () => {
    it('should ignore the file and continue searching', () => {
      // Arrange
      const filePath = join(testRoot, WORKSPACE_DIR_NAME);
      writeFileSync(filePath, 'not a directory');
      const subDir = join(testRoot, 'sub');
      mkdirSync(subDir);

      // Act
      const result = findWorkspace({ startDir: subDir });

      // Assert
      expect(result).toBeNull();
    });

    it('should find directory workspace even if file exists in child', () => {
      // Arrange
      // Create workspace directory at root
      const workspaceDir = join(testRoot, WORKSPACE_DIR_NAME);
      mkdirSync(workspaceDir);

      // Create a file named .unireq in child directory
      const childDir = join(testRoot, 'child');
      mkdirSync(childDir);
      const childFile = join(childDir, WORKSPACE_DIR_NAME);
      writeFileSync(childFile, 'not a directory');

      // Start search from grandchild
      const grandchildDir = join(childDir, 'grandchild');
      mkdirSync(grandchildDir);

      // Act
      const result = findWorkspace({ startDir: grandchildDir });

      // Assert
      expect(result).not.toBeNull();
      expect(result?.path).toBe(workspaceDir);
    });
  });

  describe('when multiple workspaces exist in hierarchy', () => {
    it('should return the nearest workspace (closest to start)', () => {
      // Arrange
      // Parent workspace
      const parentWorkspace = join(testRoot, WORKSPACE_DIR_NAME);
      mkdirSync(parentWorkspace);

      // Child directory with its own workspace
      const childDir = join(testRoot, 'child');
      mkdirSync(childDir);
      const childWorkspace = join(childDir, WORKSPACE_DIR_NAME);
      mkdirSync(childWorkspace);

      // Grandchild directory (no workspace)
      const grandchildDir = join(childDir, 'grandchild');
      mkdirSync(grandchildDir);

      // Act
      const result = findWorkspace({ startDir: grandchildDir });

      // Assert
      expect(result).not.toBeNull();
      expect(result?.path).toBe(childWorkspace);
    });
  });

  describe('when startDir is not provided', () => {
    it('should default to process.cwd()', () => {
      // Arrange
      const originalCwd = process.cwd();

      // We can't easily test this without changing cwd, but we can verify
      // the function doesn't throw when called without options

      // Act & Assert
      expect(() => findWorkspace()).not.toThrow();

      // Verify cwd wasn't changed
      expect(process.cwd()).toBe(originalCwd);
    });
  });

  describe('when workspace path contains special characters', () => {
    it('should handle directories with spaces', () => {
      // Arrange
      const dirWithSpaces = join(testRoot, 'my project');
      mkdirSync(dirWithSpaces);
      const workspaceDir = join(dirWithSpaces, WORKSPACE_DIR_NAME);
      mkdirSync(workspaceDir);

      // Act
      const result = findWorkspace({ startDir: dirWithSpaces });

      // Assert
      expect(result).not.toBeNull();
      expect(result?.path).toBe(workspaceDir);
    });

    it('should handle directories with unicode characters', () => {
      // Arrange
      const unicodeDir = join(testRoot, 'projet-\u00e9\u00e8');
      mkdirSync(unicodeDir);
      const workspaceDir = join(unicodeDir, WORKSPACE_DIR_NAME);
      mkdirSync(workspaceDir);

      // Act
      const result = findWorkspace({ startDir: unicodeDir });

      // Assert
      expect(result).not.toBeNull();
      expect(result?.path).toBe(workspaceDir);
    });
  });

  describe('when workspace directory is empty', () => {
    it('should still detect the workspace', () => {
      // Arrange
      const workspaceDir = join(testRoot, WORKSPACE_DIR_NAME);
      mkdirSync(workspaceDir);
      // Empty workspace directory

      // Act
      const result = findWorkspace({ startDir: testRoot });

      // Assert
      expect(result).not.toBeNull();
      expect(result?.path).toBe(workspaceDir);
    });
  });
});
