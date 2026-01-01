/**
 * Tests for OpenAPI Input Validators
 */

import { describe, expect, it } from 'vitest';
import type { OpenAPISchema } from '../../types.js';
import type { ResolvedParameter } from '../types.js';
import { validateEnum, validateFormat, validateParameter, validateRequired, validateType } from '../validators.js';

describe('validateRequired', () => {
  const createParam = (name: string, required: boolean, location: 'path' | 'query' | 'header'): ResolvedParameter => ({
    name,
    in: location,
    required,
  });

  describe('when required parameter is missing', () => {
    it('should return warning for missing required path parameter', () => {
      // Arrange
      const params = [createParam('id', true, 'path')];
      const provided = new Map<string, string>();

      // Act
      const warnings = validateRequired(params, provided, 'path');

      // Assert
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toEqual({
        severity: 'warning',
        location: 'path',
        param: 'id',
        message: 'Missing required path parameter: id',
      });
    });

    it('should return warning for missing required query parameter', () => {
      // Arrange
      const params = [createParam('status', true, 'query')];
      const provided = new Map<string, string>();

      // Act
      const warnings = validateRequired(params, provided, 'query');

      // Assert
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.message).toBe('Missing required query parameter: status');
    });

    it('should return warning for empty required parameter', () => {
      // Arrange
      const params = [createParam('id', true, 'path')];
      const provided = new Map([['id', '']]);

      // Act
      const warnings = validateRequired(params, provided, 'path');

      // Assert
      expect(warnings).toHaveLength(1);
    });
  });

  describe('when required parameter is provided', () => {
    it('should return no warnings', () => {
      // Arrange
      const params = [createParam('id', true, 'path')];
      const provided = new Map([['id', '123']]);

      // Act
      const warnings = validateRequired(params, provided, 'path');

      // Assert
      expect(warnings).toHaveLength(0);
    });
  });

  describe('when optional parameter is missing', () => {
    it('should return no warnings', () => {
      // Arrange
      const params = [createParam('limit', false, 'query')];
      const provided = new Map<string, string>();

      // Act
      const warnings = validateRequired(params, provided, 'query');

      // Assert
      expect(warnings).toHaveLength(0);
    });
  });

  describe('when filtering by location', () => {
    it('should only check parameters matching the location', () => {
      // Arrange
      const params = [createParam('id', true, 'path'), createParam('status', true, 'query')];
      const provided = new Map<string, string>();

      // Act
      const pathWarnings = validateRequired(params, provided, 'path');
      const queryWarnings = validateRequired(params, provided, 'query');

      // Assert
      expect(pathWarnings).toHaveLength(1);
      expect(pathWarnings[0]?.param).toBe('id');
      expect(queryWarnings).toHaveLength(1);
      expect(queryWarnings[0]?.param).toBe('status');
    });
  });
});

describe('validateType', () => {
  describe('integer type', () => {
    const intSchema: OpenAPISchema = { type: 'integer' };

    it('should accept valid integer strings', () => {
      expect(validateType(intSchema, '123', 'id', 'path')).toBeUndefined();
      expect(validateType(intSchema, '-456', 'id', 'path')).toBeUndefined();
      expect(validateType(intSchema, '0', 'id', 'path')).toBeUndefined();
    });

    it('should warn on non-integer strings', () => {
      const warning = validateType(intSchema, 'abc', 'id', 'path');
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("should be integer, got 'abc'");
    });

    it('should warn on decimal strings', () => {
      const warning = validateType(intSchema, '3.14', 'id', 'path');
      expect(warning).toBeDefined();
      expect(warning?.message).toContain('should be integer');
    });
  });

  describe('number type', () => {
    const numSchema: OpenAPISchema = { type: 'number' };

    it('should accept valid number strings', () => {
      expect(validateType(numSchema, '123', 'price', 'query')).toBeUndefined();
      expect(validateType(numSchema, '3.14', 'price', 'query')).toBeUndefined();
      expect(validateType(numSchema, '-99.99', 'price', 'query')).toBeUndefined();
    });

    it('should warn on non-number strings', () => {
      const warning = validateType(numSchema, 'expensive', 'price', 'query');
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("should be number, got 'expensive'");
    });
  });

  describe('boolean type', () => {
    const boolSchema: OpenAPISchema = { type: 'boolean' };

    it('should accept valid boolean strings', () => {
      expect(validateType(boolSchema, 'true', 'active', 'query')).toBeUndefined();
      expect(validateType(boolSchema, 'false', 'active', 'query')).toBeUndefined();
      expect(validateType(boolSchema, '1', 'active', 'query')).toBeUndefined();
      expect(validateType(boolSchema, '0', 'active', 'query')).toBeUndefined();
    });

    it('should warn on non-boolean strings', () => {
      const warning = validateType(boolSchema, 'yes', 'active', 'query');
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("should be boolean, got 'yes'");
    });
  });

  describe('string type', () => {
    const strSchema: OpenAPISchema = { type: 'string' };

    it('should accept any string', () => {
      expect(validateType(strSchema, 'anything', 'name', 'query')).toBeUndefined();
      expect(validateType(strSchema, '123', 'name', 'query')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should skip validation when schema is undefined', () => {
      expect(validateType(undefined, 'value', 'param', 'query')).toBeUndefined();
    });

    it('should skip validation when type is undefined', () => {
      expect(validateType({}, 'value', 'param', 'query')).toBeUndefined();
    });

    it('should skip validation for empty value', () => {
      const intSchema: OpenAPISchema = { type: 'integer' };
      expect(validateType(intSchema, '', 'id', 'path')).toBeUndefined();
    });

    it('should handle array type in schema', () => {
      const schema: OpenAPISchema = { type: ['integer', 'null'] };
      const warning = validateType(schema, 'abc', 'id', 'path');
      expect(warning).toBeDefined();
    });
  });
});

describe('validateEnum', () => {
  describe('when value is in enum', () => {
    it('should return no warning', () => {
      const schema: OpenAPISchema = { enum: ['pending', 'shipped', 'delivered'] };
      expect(validateEnum(schema, 'shipped', 'status', 'query')).toBeUndefined();
    });
  });

  describe('when value is not in enum', () => {
    it('should return warning with allowed values', () => {
      const schema: OpenAPISchema = { enum: ['pending', 'shipped'] };
      const warning = validateEnum(schema, 'invalid', 'status', 'query');

      expect(warning).toBeDefined();
      expect(warning?.message).toBe("Query parameter 'status' must be one of: pending, shipped");
    });
  });

  describe('edge cases', () => {
    it('should skip validation when schema is undefined', () => {
      expect(validateEnum(undefined, 'value', 'param', 'query')).toBeUndefined();
    });

    it('should skip validation when enum is undefined', () => {
      expect(validateEnum({ type: 'string' }, 'value', 'param', 'query')).toBeUndefined();
    });

    it('should skip validation when enum is empty', () => {
      expect(validateEnum({ enum: [] }, 'value', 'param', 'query')).toBeUndefined();
    });

    it('should skip validation for empty value', () => {
      const schema: OpenAPISchema = { enum: ['a', 'b'] };
      expect(validateEnum(schema, '', 'param', 'query')).toBeUndefined();
    });

    it('should handle numeric enum values', () => {
      const schema: OpenAPISchema = { enum: [1, 2, 3] };
      expect(validateEnum(schema, '2', 'count', 'query')).toBeUndefined();
    });
  });
});

describe('validateFormat', () => {
  describe('date-time format', () => {
    it('should not warn on valid ISO datetime', () => {
      const schema: OpenAPISchema = { format: 'date-time' };
      expect(validateFormat(schema, '2024-01-15T10:30:00Z', 'createdAt', 'query')).toBeUndefined();
    });

    it('should warn on invalid datetime', () => {
      const schema: OpenAPISchema = { format: 'date-time' };
      const warning = validateFormat(schema, 'not-a-date', 'createdAt', 'query');
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('info');
      expect(warning?.message).toContain('should be date-time format');
    });
  });

  describe('date format', () => {
    it('should not warn on valid ISO date', () => {
      const schema: OpenAPISchema = { format: 'date' };
      expect(validateFormat(schema, '2024-01-15', 'birthDate', 'query')).toBeUndefined();
    });

    it('should warn on invalid date', () => {
      const schema: OpenAPISchema = { format: 'date' };
      const warning = validateFormat(schema, '2024/01/15', 'birthDate', 'query');
      expect(warning).toBeDefined();
    });
  });

  describe('email format', () => {
    it('should not warn on value with @', () => {
      const schema: OpenAPISchema = { format: 'email' };
      expect(validateFormat(schema, 'user@example.com', 'email', 'query')).toBeUndefined();
    });

    it('should warn on value without @', () => {
      const schema: OpenAPISchema = { format: 'email' };
      const warning = validateFormat(schema, 'not-an-email', 'email', 'query');
      expect(warning).toBeDefined();
    });
  });

  describe('uuid format', () => {
    it('should not warn on valid UUID', () => {
      const schema: OpenAPISchema = { format: 'uuid' };
      expect(validateFormat(schema, '550e8400-e29b-41d4-a716-446655440000', 'id', 'path')).toBeUndefined();
    });

    it('should warn on invalid UUID', () => {
      const schema: OpenAPISchema = { format: 'uuid' };
      const warning = validateFormat(schema, 'not-a-uuid', 'id', 'path');
      expect(warning).toBeDefined();
    });
  });
});

describe('validateParameter', () => {
  describe('complete parameter validation', () => {
    it('should return multiple warnings for multiple issues', () => {
      // Arrange
      const param: ResolvedParameter = {
        name: 'status',
        in: 'query',
        required: false,
        schema: { type: 'integer', enum: [1, 2, 3] },
        deprecated: true,
      };

      // Act
      const warnings = validateParameter(param, 'invalid');

      // Assert
      expect(warnings.length).toBeGreaterThanOrEqual(2);
      expect(warnings.some((w) => w.message.includes('should be integer'))).toBe(true);
      expect(warnings.some((w) => w.message.includes('deprecated'))).toBe(true);
    });

    it('should return only required warning when value is missing', () => {
      // Arrange
      const param: ResolvedParameter = {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer' },
      };

      // Act
      const warnings = validateParameter(param, undefined);

      // Assert
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.message).toContain('Missing required');
    });

    it('should return no warnings for valid optional parameter', () => {
      // Arrange
      const param: ResolvedParameter = {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer' },
      };

      // Act
      const warnings = validateParameter(param, undefined);

      // Assert
      expect(warnings).toHaveLength(0);
    });
  });
});
