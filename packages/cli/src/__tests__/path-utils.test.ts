/**
 * Tests for path utilities
 * Following AAA pattern for unit tests
 */

import { describe, expect, it } from 'vitest';
import { normalizePath, resolvePath } from '../repl/path-utils.js';

describe('normalizePath', () => {
  describe('when given empty or root paths', () => {
    it('should return root for empty string', () => {
      // Arrange
      const path = '';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/');
    });

    it('should return root for whitespace', () => {
      // Arrange
      const path = '   ';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/');
    });

    it('should return root for single slash', () => {
      // Arrange
      const path = '/';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/');
    });
  });

  describe('when given simple paths', () => {
    it('should normalize absolute path', () => {
      // Arrange
      const path = '/api/users';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/users');
    });

    it('should add leading slash to relative path', () => {
      // Arrange
      const path = 'api/users';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/users');
    });

    it('should remove trailing slash', () => {
      // Arrange
      const path = '/api/users/';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/users');
    });
  });

  describe('when given paths with redundant slashes', () => {
    it('should collapse multiple leading slashes', () => {
      // Arrange
      const path = '//api/users';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/users');
    });

    it('should collapse multiple internal slashes', () => {
      // Arrange
      const path = '/api///users//admins';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/users/admins');
    });

    it('should handle complex redundant slashes', () => {
      // Arrange
      const path = '///api////users///';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/users');
    });
  });

  describe('when given paths with parent segments (..)', () => {
    it('should resolve single parent segment', () => {
      // Arrange
      const path = '/api/users/..';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api');
    });

    it('should resolve parent segment in middle', () => {
      // Arrange
      const path = '/api/users/../admins';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/admins');
    });

    it('should resolve multiple parent segments', () => {
      // Arrange
      const path = '/api/users/../..';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/');
    });

    it('should stop at root for excess parent segments', () => {
      // Arrange
      const path = '/api/../../../..';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/');
    });
  });

  describe('when given paths with current dir segments (.)', () => {
    it('should ignore single current dir segment', () => {
      // Arrange
      const path = '/api/./users';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/users');
    });

    it('should ignore multiple current dir segments', () => {
      // Arrange
      const path = '/./api/././users/.';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/users');
    });
  });

  describe('when given complex paths', () => {
    it('should normalize complex path with all features', () => {
      // Arrange
      const path = '//api//users/../admins/./roles//';

      // Act
      const result = normalizePath(path);

      // Assert
      expect(result).toBe('/api/admins/roles');
    });
  });
});

describe('resolvePath', () => {
  describe('when given empty target', () => {
    it('should return root for empty string', () => {
      // Arrange
      const current = '/api/users';
      const target = '';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/');
    });

    it('should return root for whitespace', () => {
      // Arrange
      const current = '/api/users';
      const target = '   ';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/');
    });
  });

  describe('when given absolute target path', () => {
    it('should return normalized absolute path', () => {
      // Arrange
      const current = '/api/users';
      const target = '/admin/roles';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/admin/roles');
    });

    it('should normalize absolute path with redundant slashes', () => {
      // Arrange
      const current = '/api/users';
      const target = '//admin///roles/';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/admin/roles');
    });

    it('should return root for absolute /', () => {
      // Arrange
      const current = '/api/users';
      const target = '/';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/');
    });
  });

  describe('when given relative target path', () => {
    it('should resolve simple relative path', () => {
      // Arrange
      const current = '/api';
      const target = 'users';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/api/users');
    });

    it('should resolve nested relative path', () => {
      // Arrange
      const current = '/api';
      const target = 'users/admins';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/api/users/admins');
    });

    it('should resolve parent relative path', () => {
      // Arrange
      const current = '/api/users';
      const target = '..';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/api');
    });

    it('should resolve complex relative path', () => {
      // Arrange
      const current = '/api/users';
      const target = '../admins/./roles';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/api/admins/roles');
    });

    it('should handle parent at root', () => {
      // Arrange
      const current = '/';
      const target = '..';

      // Act
      const result = resolvePath(current, target);

      // Assert
      expect(result).toBe('/');
    });
  });
});
