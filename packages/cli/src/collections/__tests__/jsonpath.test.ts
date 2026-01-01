/**
 * Tests for JSONPath-lite parser and evaluator
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateJsonPath,
  extractByPath,
  InvalidJsonPathError,
  JsonPathNotFoundError,
  parseJsonPath,
} from '../jsonpath.js';

describe('parseJsonPath', () => {
  describe('when valid paths are provided', () => {
    it('should parse simple property access', () => {
      // Arrange
      const path = '$.token';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]).toEqual({ type: 'root', value: '$', optional: false });
      expect(result.segments[1]).toEqual({ type: 'property', value: 'token', optional: false });
      expect(result.optional).toBe(false);
    });

    it('should parse nested property access', () => {
      // Arrange
      const path = '$.data.user.id';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments).toHaveLength(4);
      expect(result.segments[1]).toEqual({ type: 'property', value: 'data', optional: false });
      expect(result.segments[2]).toEqual({ type: 'property', value: 'user', optional: false });
      expect(result.segments[3]).toEqual({ type: 'property', value: 'id', optional: false });
    });

    it('should parse array index access', () => {
      // Arrange
      const path = '$.items[0]';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments).toHaveLength(3);
      expect(result.segments[1]).toEqual({ type: 'property', value: 'items', optional: false });
      expect(result.segments[2]).toEqual({ type: 'index', value: 0, optional: false });
    });

    it('should parse array index with property access', () => {
      // Arrange
      const path = '$.items[0].name';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments).toHaveLength(4);
      expect(result.segments[2]).toEqual({ type: 'index', value: 0, optional: false });
      expect(result.segments[3]).toEqual({ type: 'property', value: 'name', optional: false });
    });

    it('should parse optional property', () => {
      // Arrange
      const path = '$.token?';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments[1]).toEqual({ type: 'property', value: 'token', optional: true });
      expect(result.optional).toBe(true);
    });

    it('should parse optional nested property', () => {
      // Arrange
      const path = '$.data.token?';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments[2]).toEqual({ type: 'property', value: 'token', optional: true });
      expect(result.optional).toBe(true);
    });

    it('should parse optional array index', () => {
      // Arrange
      const path = '$.items[0]?';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments[2]).toEqual({ type: 'index', value: 0, optional: true });
      expect(result.optional).toBe(true);
    });

    it('should parse properties with underscores', () => {
      // Arrange
      const path = '$.user_name';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments[1]).toEqual({ type: 'property', value: 'user_name', optional: false });
    });

    it('should parse properties with numbers', () => {
      // Arrange
      const path = '$.item123';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments[1]).toEqual({ type: 'property', value: 'item123', optional: false });
    });

    it('should parse multi-digit array indices', () => {
      // Arrange
      const path = '$.items[123]';

      // Act
      const result = parseJsonPath(path);

      // Assert
      expect(result.segments[2]).toEqual({ type: 'index', value: 123, optional: false });
    });
  });

  describe('when invalid paths are provided', () => {
    it('should throw for empty path', () => {
      // Arrange & Act & Assert
      expect(() => parseJsonPath('')).toThrow(InvalidJsonPathError);
      expect(() => parseJsonPath('')).toThrow('Path cannot be empty');
    });

    it('should throw for path without $', () => {
      // Arrange & Act & Assert
      expect(() => parseJsonPath('token')).toThrow(InvalidJsonPathError);
      expect(() => parseJsonPath('token')).toThrow('Path must start with $');
    });

    it('should throw for $ alone', () => {
      // Arrange & Act & Assert
      expect(() => parseJsonPath('$')).toThrow(InvalidJsonPathError);
      expect(() => parseJsonPath('$')).toThrow('must access at least one property');
    });

    it('should throw for invalid characters', () => {
      // Arrange & Act & Assert
      expect(() => parseJsonPath('$.token@name')).toThrow(InvalidJsonPathError);
      expect(() => parseJsonPath('$.token@name')).toThrow('Unexpected character');
    });

    it('should throw for invalid array syntax', () => {
      // Arrange & Act & Assert
      expect(() => parseJsonPath('$.items[')).toThrow(InvalidJsonPathError);
    });
  });
});

describe('evaluateJsonPath', () => {
  describe('when path exists in data', () => {
    it('should extract simple property', () => {
      // Arrange
      const parsed = parseJsonPath('$.token');
      const data = { token: 'abc123' };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBe('abc123');
    });

    it('should extract nested property', () => {
      // Arrange
      const parsed = parseJsonPath('$.data.user.id');
      const data = { data: { user: { id: 42 } } };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBe(42);
    });

    it('should extract array element', () => {
      // Arrange
      const parsed = parseJsonPath('$.items[0]');
      const data = { items: ['first', 'second'] };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBe('first');
    });

    it('should extract property from array element', () => {
      // Arrange
      const parsed = parseJsonPath('$.items[0].id');
      const data = { items: [{ id: 1 }, { id: 2 }] };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBe(1);
    });

    it('should extract null value', () => {
      // Arrange
      const parsed = parseJsonPath('$.value');
      const data = { value: null };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBeNull();
    });

    it('should extract boolean value', () => {
      // Arrange
      const parsed = parseJsonPath('$.active');
      const data = { active: true };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBe(true);
    });

    it('should extract object value', () => {
      // Arrange
      const parsed = parseJsonPath('$.data');
      const data = { data: { id: 1, name: 'test' } };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should extract array value', () => {
      // Arrange
      const parsed = parseJsonPath('$.items');
      const data = { items: [1, 2, 3] };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('when path does not exist (required)', () => {
    it('should throw for missing property', () => {
      // Arrange
      const parsed = parseJsonPath('$.token');
      const data = { other: 'value' };

      // Act & Assert
      expect(() => evaluateJsonPath(parsed, data)).toThrow(JsonPathNotFoundError);
      expect(() => evaluateJsonPath(parsed, data)).toThrow('Path not found');
      expect(() => evaluateJsonPath(parsed, data)).toThrow('token');
    });

    it('should include available keys in error', () => {
      // Arrange
      const parsed = parseJsonPath('$.token');
      const data = { name: 'test', id: 1 };

      // Act & Assert
      try {
        evaluateJsonPath(parsed, data);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(JsonPathNotFoundError);
        const jsonError = error as JsonPathNotFoundError;
        expect(jsonError.availableKeys).toContain('name');
        expect(jsonError.availableKeys).toContain('id');
      }
    });

    it('should throw for array index out of bounds', () => {
      // Arrange
      const parsed = parseJsonPath('$.items[5]');
      const data = { items: [1, 2, 3] };

      // Act & Assert
      expect(() => evaluateJsonPath(parsed, data)).toThrow(JsonPathNotFoundError);
      expect(() => evaluateJsonPath(parsed, data)).toThrow('[5]');
    });

    it('should throw for property access on non-object', () => {
      // Arrange
      const parsed = parseJsonPath('$.value.nested');
      const data = { value: 'string' };

      // Act & Assert
      expect(() => evaluateJsonPath(parsed, data)).toThrow(JsonPathNotFoundError);
    });

    it('should throw for array access on non-array', () => {
      // Arrange
      const parsed = parseJsonPath('$.value[0]');
      const data = { value: { not: 'array' } };

      // Act & Assert
      expect(() => evaluateJsonPath(parsed, data)).toThrow(JsonPathNotFoundError);
    });
  });

  describe('when path does not exist (optional)', () => {
    it('should return undefined for missing optional property', () => {
      // Arrange
      const parsed = parseJsonPath('$.token?');
      const data = { other: 'value' };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined for optional nested path', () => {
      // Arrange
      const parsed = parseJsonPath('$.data.token?');
      const data = { data: {} };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined for optional array index out of bounds', () => {
      // Arrange
      const parsed = parseJsonPath('$.items[5]?');
      const data = { items: [1, 2, 3] };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined when parent is null', () => {
      // Arrange
      const parsed = parseJsonPath('$.data.token?');
      const data = { data: null };

      // Act
      const result = evaluateJsonPath(parsed, data);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

describe('extractByPath', () => {
  it('should combine parse and evaluate', () => {
    // Arrange
    const path = '$.data.id';
    const data = { data: { id: 42 } };

    // Act
    const result = extractByPath(path, data);

    // Assert
    expect(result).toBe(42);
  });

  it('should throw InvalidJsonPathError for invalid path', () => {
    // Arrange
    const path = 'invalid';
    const data = {};

    // Act & Assert
    expect(() => extractByPath(path, data)).toThrow(InvalidJsonPathError);
  });

  it('should throw JsonPathNotFoundError for missing path', () => {
    // Arrange
    const path = '$.missing';
    const data = {};

    // Act & Assert
    expect(() => extractByPath(path, data)).toThrow(JsonPathNotFoundError);
  });
});
