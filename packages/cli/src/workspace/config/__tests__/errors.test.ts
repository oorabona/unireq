/**
 * Tests for WorkspaceConfigError
 */

import { describe, expect, it } from 'vitest';
import { WorkspaceConfigError } from '../errors.js';

describe('WorkspaceConfigError', () => {
  describe('constructor', () => {
    it('should create error with message only', () => {
      // Arrange & Act
      const error = new WorkspaceConfigError('Test error');

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WorkspaceConfigError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('WorkspaceConfigError');
    });

    it('should create error with all options', () => {
      // Arrange
      const cause = new Error('Original error');

      // Act
      const error = new WorkspaceConfigError('Test error', {
        fieldPath: 'openapi.cache.ttlMs',
        line: 10,
        column: 5,
        cause,
      });

      // Assert
      expect(error.fieldPath).toBe('openapi.cache.ttlMs');
      expect(error.line).toBe(10);
      expect(error.column).toBe(5);
      expect(error.cause).toBe(cause);
    });
  });

  describe('yamlSyntaxError', () => {
    it('should create error with line and column', () => {
      // Arrange
      const cause = new Error('YAML parse error');

      // Act
      const error = WorkspaceConfigError.yamlSyntaxError('Invalid indentation', 5, 3, cause);

      // Assert
      expect(error.message).toBe('Invalid YAML syntax at line 5, column 3: Invalid indentation');
      expect(error.line).toBe(5);
      expect(error.column).toBe(3);
      expect(error.cause).toBe(cause);
    });

    it('should create error without position info', () => {
      // Act
      const error = WorkspaceConfigError.yamlSyntaxError('Parse error');

      // Assert
      expect(error.message).toBe('Invalid YAML syntax: Parse error');
      expect(error.line).toBeUndefined();
      expect(error.column).toBeUndefined();
    });
  });

  describe('schemaValidationError', () => {
    it('should create error with field path', () => {
      // Act
      const error = WorkspaceConfigError.schemaValidationError('profiles.dev.timeoutMs', 'Expected positive number');

      // Assert
      expect(error.message).toBe("Validation error at 'profiles.dev.timeoutMs': Expected positive number");
      expect(error.fieldPath).toBe('profiles.dev.timeoutMs');
    });
  });

  describe('unsupportedVersion', () => {
    it('should create error for unsupported version', () => {
      // Act
      const error = WorkspaceConfigError.unsupportedVersion(2);

      // Assert
      expect(error.message).toBe('Unsupported workspace config version: 2. Only version 1 is supported.');
      expect(error.fieldPath).toBe('version');
    });
  });

  describe('fileAccessError', () => {
    it('should create error with file path and cause', () => {
      // Arrange
      const cause = new Error('EACCES: permission denied');

      // Act
      const error = WorkspaceConfigError.fileAccessError('/path/to/workspace.yaml', cause);

      // Assert
      expect(error.message).toBe(
        "Cannot read workspace config at '/path/to/workspace.yaml': EACCES: permission denied",
      );
      expect(error.cause).toBe(cause);
    });
  });

  describe('prototype chain', () => {
    it('should be catchable as Error', () => {
      // Arrange
      const error = new WorkspaceConfigError('Test');
      let caught = false;

      // Act
      try {
        throw error;
      } catch (e) {
        if (e instanceof Error) {
          caught = true;
        }
      }

      // Assert
      expect(caught).toBe(true);
    });

    it('should be catchable as WorkspaceConfigError', () => {
      // Arrange
      const error = new WorkspaceConfigError('Test');
      let caught = false;

      // Act
      try {
        throw error;
      } catch (e) {
        if (e instanceof WorkspaceConfigError) {
          caught = true;
        }
      }

      // Assert
      expect(caught).toBe(true);
    });
  });
});
