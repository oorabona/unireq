import { describe, expect, it } from 'vitest';
import { CircularReferenceError, MaxRecursionError, VariableError, VariableNotFoundError } from '../errors.js';

describe('VariableError', () => {
  describe('when created with name and type', () => {
    it('should store variableName and variableType', () => {
      // Arrange & Act
      const error = new VariableError('Test error', {
        variableName: 'testVar',
        variableType: 'var',
      });

      // Assert
      expect(error.variableName).toBe('testVar');
      expect(error.variableType).toBe('var');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('VariableError');
    });

    it('should be instanceof Error', () => {
      // Arrange & Act
      const error = new VariableError('Test', { variableName: 'x', variableType: 'var' });

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VariableError);
    });
  });
});

describe('VariableNotFoundError', () => {
  describe('when variable type is var', () => {
    it('should format message for workspace variables', () => {
      // Arrange & Act
      const error = new VariableNotFoundError('var', 'apiKey');

      // Assert
      expect(error.message).toBe("Variable 'apiKey' not found in vars");
      expect(error.name).toBe('VariableNotFoundError');
      expect(error.variableName).toBe('apiKey');
      expect(error.variableType).toBe('var');
    });
  });

  describe('when variable type is env', () => {
    it('should format message for environment variables', () => {
      // Arrange & Act
      const error = new VariableNotFoundError('env', 'MY_SECRET');

      // Assert
      expect(error.message).toBe("Environment variable 'MY_SECRET' is not defined");
      expect(error.variableType).toBe('env');
    });
  });

  describe('when used with other types', () => {
    it('should handle secret type', () => {
      // Arrange & Act
      const error = new VariableNotFoundError('secret', 'password');

      // Assert
      expect(error.message).toBe("Variable 'password' not found in secrets");
    });
  });

  it('should be instanceof VariableError', () => {
    // Arrange & Act
    const error = new VariableNotFoundError('var', 'test');

    // Assert
    expect(error).toBeInstanceOf(VariableError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('CircularReferenceError', () => {
  describe('when chain has 2 elements', () => {
    it('should format chain as a → b', () => {
      // Arrange & Act
      const error = new CircularReferenceError(['a', 'b', 'a']);

      // Assert
      expect(error.message).toBe('Circular reference detected: a → b → a');
      expect(error.chain).toEqual(['a', 'b', 'a']);
      expect(error.name).toBe('CircularReferenceError');
    });
  });

  describe('when chain has multiple elements', () => {
    it('should format full chain', () => {
      // Arrange & Act
      const error = new CircularReferenceError(['x', 'y', 'z', 'x']);

      // Assert
      expect(error.message).toBe('Circular reference detected: x → y → z → x');
      expect(error.variableName).toBe('x');
    });
  });

  it('should be instanceof VariableError', () => {
    // Arrange & Act
    const error = new CircularReferenceError(['a', 'a']);

    // Assert
    expect(error).toBeInstanceOf(VariableError);
  });
});

describe('MaxRecursionError', () => {
  describe('when max depth is exceeded', () => {
    it('should include max depth in message', () => {
      // Arrange & Act
      const error = new MaxRecursionError(10, 11, 'deepVar');

      // Assert
      expect(error.message).toBe("Maximum recursion depth (10) exceeded while resolving variable 'deepVar'");
      expect(error.maxDepth).toBe(10);
      expect(error.currentDepth).toBe(11);
      expect(error.variableName).toBe('deepVar');
      expect(error.name).toBe('MaxRecursionError');
    });
  });

  it('should be instanceof VariableError', () => {
    // Arrange & Act
    const error = new MaxRecursionError(5, 6, 'v');

    // Assert
    expect(error).toBeInstanceOf(VariableError);
  });
});
