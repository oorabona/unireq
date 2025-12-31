import { describe, expect, it } from 'vitest';
import { hasVariables, isKnownType, parseVariables, unescapeVariables } from '../parser.js';

describe('isKnownType', () => {
  describe('when type is known', () => {
    it.each(['var', 'env', 'secret', 'prompt'])('should return true for %s', (type) => {
      expect(isKnownType(type)).toBe(true);
    });
  });

  describe('when type is unknown', () => {
    it.each(['unknown', 'foo', 'VAR', 'ENV', ''])('should return false for %s', (type) => {
      expect(isKnownType(type)).toBe(false);
    });
  });
});

describe('parseVariables', () => {
  describe('when template has single variable', () => {
    it('should parse ${var:name}', () => {
      // Arrange
      const template = 'Hello ${var:name}!';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        full: '${var:name}',
        type: 'var',
        name: 'name',
        start: 6,
        end: 17,
      });
    });

    it('should parse ${env:HOME}', () => {
      // Arrange
      const template = 'path: ${env:HOME}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        full: '${env:HOME}',
        type: 'env',
        name: 'HOME',
        start: 6,
        end: 17,
      });
    });

    it('should parse ${secret:apiKey}', () => {
      // Arrange
      const template = 'key: ${secret:apiKey}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0]?.type).toBe('secret');
      expect(matches[0]?.name).toBe('apiKey');
    });

    it('should parse ${prompt:username}', () => {
      // Arrange
      const template = 'user: ${prompt:username}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0]?.type).toBe('prompt');
      expect(matches[0]?.name).toBe('username');
    });
  });

  describe('when template has multiple variables', () => {
    it('should parse all variables', () => {
      // Arrange
      const template = '${var:protocol}://${var:host}:${env:PORT}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches).toHaveLength(3);
      expect(matches[0]?.name).toBe('protocol');
      expect(matches[1]?.name).toBe('host');
      expect(matches[2]?.name).toBe('PORT');
    });
  });

  describe('when template has unknown type', () => {
    it('should not match unknown types', () => {
      // Arrange
      const template = '${unknown:value}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches).toHaveLength(0);
    });
  });

  describe('when template has invalid syntax', () => {
    it('should not match ${invalid} (no colon)', () => {
      // Arrange
      const template = '${invalid}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches).toHaveLength(0);
    });

    it('should not match ${var:} (empty name)', () => {
      // Arrange
      const template = '${var:}';

      // Act
      const matches = parseVariables(template);

      // Assert
      // Empty name is not matched (regex requires at least one char)
      expect(matches).toHaveLength(0);
    });
  });

  describe('when template has escaped syntax', () => {
    it('should not match $${var:name}', () => {
      // Arrange
      const template = 'literal: $${var:name}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches).toHaveLength(0);
    });
  });

  describe('when template has no variables', () => {
    it('should return empty array', () => {
      // Arrange
      const template = 'just a plain string';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches).toHaveLength(0);
    });
  });

  describe('when variable name has special characters', () => {
    it('should parse names with underscores', () => {
      // Arrange
      const template = '${var:my_variable}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches[0]?.name).toBe('my_variable');
    });

    it('should parse names with dashes', () => {
      // Arrange
      const template = '${var:my-variable}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches[0]?.name).toBe('my-variable');
    });

    it('should parse names with dots', () => {
      // Arrange
      const template = '${var:config.api.key}';

      // Act
      const matches = parseVariables(template);

      // Assert
      expect(matches[0]?.name).toBe('config.api.key');
    });
  });
});

describe('hasVariables', () => {
  describe('when template has variables', () => {
    it('should return true for ${var:x}', () => {
      expect(hasVariables('Hello ${var:name}')).toBe(true);
    });

    it('should return true for ${env:X}', () => {
      expect(hasVariables('${env:HOME}')).toBe(true);
    });
  });

  describe('when template has no variables', () => {
    it('should return false for plain string', () => {
      expect(hasVariables('plain string')).toBe(false);
    });

    it('should return false for unknown type', () => {
      expect(hasVariables('${unknown:x}')).toBe(false);
    });

    it('should return false for escaped', () => {
      expect(hasVariables('$${var:x}')).toBe(false);
    });
  });
});

describe('unescapeVariables', () => {
  describe('when template has escaped variables', () => {
    it('should unescape $${var:name} to ${var:name}', () => {
      // Arrange
      const template = 'literal: $${var:name}';

      // Act
      const result = unescapeVariables(template);

      // Assert
      expect(result).toBe('literal: ${var:name}');
    });

    it('should unescape multiple escaped patterns', () => {
      // Arrange
      const template = '$${a} and $${b}';

      // Act
      const result = unescapeVariables(template);

      // Assert
      expect(result).toBe('${a} and ${b}');
    });
  });

  describe('when template has no escaped variables', () => {
    it('should return unchanged string', () => {
      // Arrange
      const template = 'Hello ${var:name}';

      // Act
      const result = unescapeVariables(template);

      // Assert
      expect(result).toBe('Hello ${var:name}');
    });
  });
});
