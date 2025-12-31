import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CircularReferenceError, MaxRecursionError, VariableNotFoundError } from '../errors.js';
import { interpolate, interpolateAsync } from '../resolver.js';
import type { InterpolationContext } from '../types.js';

describe('interpolate', () => {
  // Store original env for restoration
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set up test environment variables
    process.env['TEST_USER'] = 'alice';
    process.env['TEST_PORT'] = '8080';
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('Scenario 1: Resolve workspace variable', () => {
    it('should resolve ${var:greeting} to "Hello"', () => {
      // Given
      const template = '${var:greeting}';
      const context: InterpolationContext = { vars: { greeting: 'Hello' } };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('Hello');
    });
  });

  describe('Scenario 2: Resolve environment variable', () => {
    it('should resolve ${env:TEST_USER} to "alice"', () => {
      // Given
      const template = '${env:TEST_USER}';
      const context: InterpolationContext = { vars: {} };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('alice');
    });
  });

  describe('Scenario 3: Undefined workspace variable throws error', () => {
    it('should throw VariableNotFoundError for missing var', () => {
      // Given
      const template = '${var:missing}';
      const context: InterpolationContext = { vars: {} };

      // When & Then
      expect(() => interpolate(template, context)).toThrow(VariableNotFoundError);
      expect(() => interpolate(template, context)).toThrow(/missing/);
    });
  });

  describe('Scenario 4: Undefined env variable throws error', () => {
    it('should throw VariableNotFoundError for missing env var', () => {
      // Given
      const template = '${env:NONEXISTENT_VAR_12345}';
      const context: InterpolationContext = { vars: {} };

      // When & Then
      expect(() => interpolate(template, context)).toThrow(VariableNotFoundError);
      expect(() => interpolate(template, context)).toThrow(/NONEXISTENT_VAR_12345/);
    });
  });

  describe('Scenario 5: Recursive variable resolution', () => {
    it('should resolve nested ${var:...} references', () => {
      // Given
      const template = '${var:greeting}';
      const context: InterpolationContext = {
        vars: {
          greeting: '${var:word} World',
          word: 'Hello',
        },
      };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('Hello World');
    });

    it('should resolve multiple levels of nesting', () => {
      // Given
      const template = '${var:a}';
      const context: InterpolationContext = {
        vars: {
          a: '${var:b}',
          b: '${var:c}',
          c: 'final',
        },
      };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('final');
    });
  });

  describe('Scenario 6: Circular reference detection', () => {
    it('should throw CircularReferenceError for a → b → a', () => {
      // Given
      const template = '${var:a}';
      const context: InterpolationContext = {
        vars: {
          a: '${var:b}',
          b: '${var:a}',
        },
      };

      // When & Then
      expect(() => interpolate(template, context)).toThrow(CircularReferenceError);
      expect(() => interpolate(template, context)).toThrow(/a → b → a/);
    });

    it('should throw CircularReferenceError for self-reference', () => {
      // Given
      const template = '${var:x}';
      const context: InterpolationContext = {
        vars: {
          x: '${var:x}',
        },
      };

      // When & Then
      expect(() => interpolate(template, context)).toThrow(CircularReferenceError);
    });
  });

  describe('Scenario 7: Max recursion depth exceeded', () => {
    it('should throw MaxRecursionError for chain > 10', () => {
      // Given: Create a chain v0 → v1 → v2 → ... → v11
      const vars: Record<string, string> = {};
      for (let i = 0; i <= 11; i++) {
        vars[`v${i}`] = `\${var:v${i + 1}}`;
      }
      vars['v12'] = 'end';

      const template = '${var:v0}';
      const context: InterpolationContext = { vars };

      // When & Then
      expect(() => interpolate(template, context)).toThrow(MaxRecursionError);
    });

    it('should succeed for chain exactly at depth 10', () => {
      // Given: Create a chain exactly 10 deep
      const vars: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        vars[`v${i}`] = `\${var:v${i + 1}}`;
      }
      vars['v10'] = 'end';

      const template = '${var:v0}';
      const context: InterpolationContext = { vars };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('end');
    });
  });

  describe('Scenario 8: Secret placeholder without resolver', () => {
    it('should return <secret:apiKey> placeholder', () => {
      // Given
      const template = 'key: ${secret:apiKey}';
      const context: InterpolationContext = { vars: {} };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('key: <secret:apiKey>');
    });

    it('should use secretResolver when provided', () => {
      // Given
      const template = 'key: ${secret:apiKey}';
      const context: InterpolationContext = {
        vars: {},
        secretResolver: (name) => `resolved-${name}`,
      };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('key: resolved-apiKey');
    });
  });

  describe('Scenario 9: Prompt placeholder without resolver', () => {
    it('should return <prompt:username> placeholder', () => {
      // Given
      const template = 'user: ${prompt:username}';
      const context: InterpolationContext = { vars: {} };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('user: <prompt:username>');
    });

    it('should use promptResolver when provided', () => {
      // Given
      const template = 'user: ${prompt:username}';
      const context: InterpolationContext = {
        vars: {},
        promptResolver: (name) => `user-${name}`,
      };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('user: user-username');
    });
  });

  describe('Scenario 10: Multiple variables in one string', () => {
    it('should resolve all variables', () => {
      // Given
      const template = '${var:protocol}://${var:host}:${env:TEST_PORT}';
      const context: InterpolationContext = {
        vars: {
          protocol: 'https',
          host: 'api.example.com',
        },
      };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('https://api.example.com:8080');
    });
  });

  describe('Scenario 11: Unknown variable type left as literal', () => {
    it('should leave ${unknown:value} unchanged', () => {
      // Given
      const template = '${unknown:value}';
      const context: InterpolationContext = { vars: {} };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('${unknown:value}');
    });
  });

  describe('Scenario 12: Escaped variable syntax', () => {
    it('should unescape $${var:name} to ${var:name}', () => {
      // Given
      const template = 'literal: $${var:name}';
      const context: InterpolationContext = { vars: {} };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('literal: ${var:name}');
    });
  });

  describe('Scenario 13: Empty string value is valid', () => {
    it('should resolve to empty string', () => {
      // Given
      const template = 'prefix${var:empty}suffix';
      const context: InterpolationContext = { vars: { empty: '' } };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('prefixsuffix');
    });
  });

  describe('Additional edge cases', () => {
    it('should handle plain string without variables', () => {
      // Given
      const template = 'just a plain string';
      const context: InterpolationContext = { vars: {} };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('just a plain string');
    });

    it('should handle empty template', () => {
      // Given
      const template = '';
      const context: InterpolationContext = { vars: {} };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('');
    });

    it('should handle mixed var and env in recursive chain', () => {
      // Given
      const template = '${var:url}';
      const context: InterpolationContext = {
        vars: {
          url: '${var:protocol}://${env:TEST_USER}',
          protocol: 'https',
        },
      };

      // When
      const result = interpolate(template, context);

      // Then
      expect(result).toBe('https://alice');
    });
  });
});

describe('interpolateAsync', () => {
  it('should work like sync version', async () => {
    // Given
    const template = '${var:name}';
    const context: InterpolationContext = { vars: { name: 'World' } };

    // When
    const result = await interpolateAsync(template, context);

    // Then
    expect(result).toBe('World');
  });
});
