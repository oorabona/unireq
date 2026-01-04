/**
 * Tests for Ink UI entry point
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requireTTY, TTYRequiredError } from '../index.js';

describe('requireTTY', () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
  });

  describe('TTY enforcement', () => {
    it('should not throw when stdout is a TTY', () => {
      // Given stdout is a TTY
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      // When checking TTY requirement
      // Then no error is thrown
      expect(() => requireTTY()).not.toThrow();
    });

    it('should throw TTYRequiredError when stdout is not a TTY', () => {
      // Given stdout is not a TTY (piped)
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        configurable: true,
      });

      // When checking TTY requirement
      // Then TTYRequiredError is thrown
      expect(() => requireTTY()).toThrow(TTYRequiredError);
    });

    it('should provide helpful error message', () => {
      // Given stdout is not a TTY
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        configurable: true,
      });

      // When checking TTY requirement
      // Then error message suggests one-shot commands
      expect(() => requireTTY()).toThrow(/one-shot commands/);
    });
  });
});

describe('TTYRequiredError', () => {
  it('should have correct name', () => {
    const error = new TTYRequiredError();
    expect(error.name).toBe('TTYRequiredError');
  });

  it('should be instanceof Error', () => {
    const error = new TTYRequiredError();
    expect(error).toBeInstanceOf(Error);
  });
});
