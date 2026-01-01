/**
 * Tests for variable extraction engine
 */

import { describe, expect, it } from 'vitest';
import { ExtractionError, extractSingleVariable, extractVariables } from '../extractor.js';

describe('extractVariables', () => {
  describe('when extracting simple values', () => {
    it('should extract string value', () => {
      // Arrange
      const body = '{"token":"abc123"}';
      const config = { vars: { token: '$.token' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({ token: 'abc123' });
      expect(result.skipped).toHaveLength(0);
    });

    it('should extract number value as string', () => {
      // Arrange
      const body = '{"id":42}';
      const config = { vars: { id: '$.id' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({ id: '42' });
    });

    it('should extract boolean value as string', () => {
      // Arrange
      const body = '{"active":true}';
      const config = { vars: { active: '$.active' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({ active: 'true' });
    });

    it('should extract null value as "null"', () => {
      // Arrange
      const body = '{"value":null}';
      const config = { vars: { value: '$.value' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({ value: 'null' });
    });

    it('should extract object as JSON string', () => {
      // Arrange
      const body = '{"data":{"id":1,"name":"test"}}';
      const config = { vars: { data: '$.data' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables['data']).toBe('{"id":1,"name":"test"}');
    });

    it('should extract array as JSON string', () => {
      // Arrange
      const body = '{"items":[1,2,3]}';
      const config = { vars: { items: '$.items' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables['items']).toBe('[1,2,3]');
    });
  });

  describe('when extracting nested values', () => {
    it('should extract nested property', () => {
      // Arrange
      const body = '{"data":{"user":{"id":"user123"}}}';
      const config = { vars: { userId: '$.data.user.id' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({ userId: 'user123' });
    });

    it('should extract from array', () => {
      // Arrange
      const body = '{"items":[{"id":1},{"id":2}]}';
      const config = { vars: { firstId: '$.items[0].id' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({ firstId: '1' });
    });
  });

  describe('when extracting multiple values', () => {
    it('should extract multiple variables', () => {
      // Arrange
      const body = '{"access_token":"jwt...","user":{"id":42,"name":"Alice"}}';
      const config = {
        vars: {
          token: '$.access_token',
          userId: '$.user.id',
          userName: '$.user.name',
        },
      };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({
        token: 'jwt...',
        userId: '42',
        userName: 'Alice',
      });
    });
  });

  describe('when handling optional paths', () => {
    it('should skip optional path that does not exist', () => {
      // Arrange
      const body = '{"data":{}}';
      const config = { vars: { token: '$.token?' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({});
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toEqual({
        name: 'token',
        path: '$.token?',
        reason: 'Optional path not found',
      });
    });

    it('should extract existing optional path', () => {
      // Arrange
      const body = '{"token":"abc"}';
      const config = { vars: { token: '$.token?' } };

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({ token: 'abc' });
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe('when handling errors', () => {
    it('should throw for empty body', () => {
      // Arrange
      const body = '';
      const config = { vars: { token: '$.token' } };

      // Act & Assert
      expect(() => extractVariables(body, config)).toThrow(ExtractionError);
      expect(() => extractVariables(body, config)).toThrow('empty response body');
    });

    it('should throw for non-JSON body', () => {
      // Arrange
      const body = 'plain text response';
      const config = { vars: { token: '$.token' } };

      // Act & Assert
      expect(() => extractVariables(body, config)).toThrow(ExtractionError);
      expect(() => extractVariables(body, config)).toThrow('not valid JSON');
    });

    it('should throw for invalid JSONPath', () => {
      // Arrange
      const body = '{"token":"abc"}';
      const config = { vars: { token: 'invalid' } };

      // Act & Assert
      expect(() => extractVariables(body, config)).toThrow(ExtractionError);
      expect(() => extractVariables(body, config)).toThrow('Invalid JSONPath');
    });

    it('should throw for required path not found', () => {
      // Arrange
      const body = '{"data":{}}';
      const config = { vars: { token: '$.token' } };

      // Act & Assert
      expect(() => extractVariables(body, config)).toThrow(ExtractionError);
      expect(() => extractVariables(body, config)).toThrow('Cannot extract variable');
    });
  });

  describe('when config has no vars', () => {
    it('should return empty result for undefined vars', () => {
      // Arrange
      const body = '{"token":"abc"}';
      const config = {};

      // Act
      const result = extractVariables(body, config);

      // Assert
      expect(result.variables).toEqual({});
      expect(result.skipped).toHaveLength(0);
    });
  });
});

describe('extractSingleVariable', () => {
  it('should extract value and return as string', () => {
    // Arrange
    const body = '{"data":{"id":"abc123"}}';
    const path = '$.data.id';

    // Act
    const result = extractSingleVariable(body, path);

    // Assert
    expect(result).toBe('abc123');
  });

  it('should return undefined for optional path not found', () => {
    // Arrange
    const body = '{"data":{}}';
    const path = '$.token?';

    // Act
    const result = extractSingleVariable(body, path);

    // Assert
    expect(result).toBeUndefined();
  });

  it('should throw ExtractionError for invalid path', () => {
    // Arrange
    const body = '{"token":"abc"}';
    const path = 'invalid';

    // Act & Assert
    expect(() => extractSingleVariable(body, path)).toThrow(ExtractionError);
  });

  it('should throw ExtractionError for path not found', () => {
    // Arrange
    const body = '{"data":{}}';
    const path = '$.token';

    // Act & Assert
    expect(() => extractSingleVariable(body, path)).toThrow(ExtractionError);
  });
});
