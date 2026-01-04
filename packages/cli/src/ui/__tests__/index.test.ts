/**
 * Tests for Ink UI entry point
 */

import { afterEach, describe, expect, it } from 'vitest';

// Mock environment variables
const originalEnv = { ...process.env };

describe('shouldUseInk', () => {
  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  describe('S-8: Fallback to legacy REPL', () => {
    it('should return false when CI env is set', async () => {
      // Given CI environment detected
      process.env['CI'] = 'true';

      // When checking shouldUseInk
      const { shouldUseInk } = await import('../index.js');

      // Then legacy readline engine is used
      expect(shouldUseInk()).toBe(false);
    });

    it('should return false when UNIREQ_LEGACY_REPL is set', async () => {
      // Given UNIREQ_LEGACY_REPL=1 is set
      process.env['UNIREQ_LEGACY_REPL'] = '1';

      const { shouldUseInk } = await import('../index.js');

      expect(shouldUseInk()).toBe(false);
    });

    it('should return false when stdout is not a TTY', async () => {
      // Given stdout is not a TTY (piped)
      const originalIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        configurable: true,
      });

      const { shouldUseInk } = await import('../index.js');
      const result = shouldUseInk();

      // Restore
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });

      expect(result).toBe(false);
    });

    it('should return true when TTY and no env overrides', async () => {
      // Given normal TTY environment
      delete process.env['CI'];
      delete process.env['UNIREQ_LEGACY_REPL'];

      const originalIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });

      const { shouldUseInk } = await import('../index.js');
      const result = shouldUseInk();

      // Restore
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });

      expect(result).toBe(true);
    });
  });
});
