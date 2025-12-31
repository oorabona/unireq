import { describe, expect, it } from 'vitest';
import { SpecError, SpecLoadError, SpecNotFoundError, SpecParseError } from '../errors';

describe('SpecError', () => {
  describe('base class', () => {
    it('should create error with message', () => {
      // Arrange & Act
      const error = new SpecError('Something went wrong');

      // Assert
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('SpecError');
      expect(error.source).toBeUndefined();
    });

    it('should create error with source', () => {
      // Arrange & Act
      const error = new SpecError('Something went wrong', './spec.yaml');

      // Assert
      expect(error.message).toBe('Something went wrong');
      expect(error.source).toBe('./spec.yaml');
    });

    it('should be instanceof Error', () => {
      // Arrange & Act
      const error = new SpecError('Test');

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SpecError);
    });
  });
});

describe('SpecNotFoundError', () => {
  it('should create error with source path', () => {
    // Arrange & Act
    const error = new SpecNotFoundError('./nonexistent.yaml');

    // Assert
    expect(error.message).toBe('Spec not found: ./nonexistent.yaml');
    expect(error.name).toBe('SpecNotFoundError');
    expect(error.source).toBe('./nonexistent.yaml');
  });

  it('should create error with details', () => {
    // Arrange & Act
    const error = new SpecNotFoundError('https://api.example.com/spec.json', 'HTTP 404');

    // Assert
    expect(error.message).toBe('Spec not found: https://api.example.com/spec.json (HTTP 404)');
  });

  it('should be instanceof SpecError', () => {
    // Arrange & Act
    const error = new SpecNotFoundError('./spec.yaml');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SpecError);
    expect(error).toBeInstanceOf(SpecNotFoundError);
  });
});

describe('SpecLoadError', () => {
  it('should create error with source and reason', () => {
    // Arrange & Act
    const error = new SpecLoadError('https://api.example.com/spec.json', 'network timeout');

    // Assert
    expect(error.message).toBe('Failed to load spec from https://api.example.com/spec.json: network timeout');
    expect(error.name).toBe('SpecLoadError');
    expect(error.source).toBe('https://api.example.com/spec.json');
    expect(error.cause).toBeUndefined();
  });

  it('should create error with cause', () => {
    // Arrange
    const originalError = new Error('ECONNREFUSED');

    // Act
    const error = new SpecLoadError('https://api.example.com/spec.json', 'connection refused', originalError);

    // Assert
    expect(error.cause).toBe(originalError);
  });

  it('should be instanceof SpecError', () => {
    // Arrange & Act
    const error = new SpecLoadError('./spec.yaml', 'permission denied');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SpecError);
    expect(error).toBeInstanceOf(SpecLoadError);
  });
});

describe('SpecParseError', () => {
  it('should create error with source and reason', () => {
    // Arrange & Act
    const error = new SpecParseError('./spec.yaml', 'invalid JSON syntax');

    // Assert
    expect(error.message).toBe('Invalid spec ./spec.yaml: invalid JSON syntax');
    expect(error.name).toBe('SpecParseError');
    expect(error.source).toBe('./spec.yaml');
    expect(error.line).toBeUndefined();
    expect(error.column).toBeUndefined();
  });

  it('should create error with line number', () => {
    // Arrange & Act
    const error = new SpecParseError('./spec.yaml', 'unexpected token', {
      line: 42,
    });

    // Assert
    expect(error.message).toBe('Invalid spec ./spec.yaml at line 42: unexpected token');
    expect(error.line).toBe(42);
    expect(error.column).toBeUndefined();
  });

  it('should create error with line and column', () => {
    // Arrange & Act
    const error = new SpecParseError('./spec.yaml', 'unexpected token', {
      line: 42,
      column: 15,
    });

    // Assert
    expect(error.message).toBe('Invalid spec ./spec.yaml at line 42, column 15: unexpected token');
    expect(error.line).toBe(42);
    expect(error.column).toBe(15);
  });

  it('should be instanceof SpecError', () => {
    // Arrange & Act
    const error = new SpecParseError('./spec.yaml', 'not a valid OpenAPI spec');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SpecError);
    expect(error).toBeInstanceOf(SpecParseError);
  });
});
