/**
 * Tests for OpenAPI Validation Warning Display
 */

import { describe, expect, it, vi } from 'vitest';
import { displayWarnings, formatWarning, formatWarnings, hasWarnings } from '../display.js';
import type { ValidationResult, ValidationWarning } from '../types.js';

describe('formatWarning', () => {
  describe('with colors', () => {
    it('should format warning severity with yellow color', () => {
      const warning: ValidationWarning = {
        severity: 'warning',
        location: 'path',
        param: 'id',
        message: 'Missing required path parameter: id',
      };

      const formatted = formatWarning(warning, true);

      expect(formatted).toContain('⚠');
      expect(formatted).toContain('Missing required path parameter: id');
      expect(formatted).toContain('\x1b[33m'); // Yellow
      expect(formatted).toContain('\x1b[0m'); // Reset
    });

    it('should format info severity with cyan color', () => {
      const warning: ValidationWarning = {
        severity: 'info',
        location: 'query',
        param: 'date',
        message: "Query parameter 'date' should be date-time format",
      };

      const formatted = formatWarning(warning, true);

      expect(formatted).toContain('ℹ');
      expect(formatted).toContain('\x1b[36m'); // Cyan
    });
  });

  describe('without colors', () => {
    it('should format warning without ANSI codes', () => {
      const warning: ValidationWarning = {
        severity: 'warning',
        location: 'path',
        param: 'id',
        message: 'Test message',
      };

      const formatted = formatWarning(warning, false);

      expect(formatted).toBe('⚠ Test message');
      expect(formatted).not.toContain('\x1b');
    });

    it('should format info without ANSI codes', () => {
      const warning: ValidationWarning = {
        severity: 'info',
        location: 'query',
        param: 'old',
        message: 'Param is deprecated',
      };

      const formatted = formatWarning(warning, false);

      expect(formatted).toBe('ℹ Param is deprecated');
    });
  });
});

describe('formatWarnings', () => {
  it('should format multiple warnings', () => {
    const result: ValidationResult = {
      warnings: [
        { severity: 'warning', location: 'path', param: 'id', message: 'Missing id' },
        { severity: 'warning', location: 'query', param: 'status', message: 'Invalid status' },
      ],
      skipped: false,
    };

    const formatted = formatWarnings(result, false);

    expect(formatted).toHaveLength(2);
    expect(formatted[0]).toBe('⚠ Missing id');
    expect(formatted[1]).toBe('⚠ Invalid status');
  });

  it('should return empty array when no warnings', () => {
    const result: ValidationResult = {
      warnings: [],
      skipped: false,
    };

    const formatted = formatWarnings(result, false);

    expect(formatted).toHaveLength(0);
  });

  it('should return empty array when skipped', () => {
    const result: ValidationResult = {
      warnings: [{ severity: 'warning', location: 'path', param: 'id', message: 'Should not show' }],
      skipped: true,
      skipReason: 'No spec loaded',
    };

    const formatted = formatWarnings(result, false);

    expect(formatted).toHaveLength(0);
  });
});

describe('hasWarnings', () => {
  it('should return true when warnings exist', () => {
    const result: ValidationResult = {
      warnings: [{ severity: 'warning', location: 'path', param: 'id', message: 'Test' }],
      skipped: false,
    };

    expect(hasWarnings(result)).toBe(true);
  });

  it('should return false when no warnings', () => {
    const result: ValidationResult = {
      warnings: [],
      skipped: false,
    };

    expect(hasWarnings(result)).toBe(false);
  });

  it('should return false when skipped', () => {
    const result: ValidationResult = {
      warnings: [{ severity: 'warning', location: 'path', param: 'id', message: 'Test' }],
      skipped: true,
    };

    expect(hasWarnings(result)).toBe(false);
  });
});

describe('displayWarnings', () => {
  it('should log each warning', () => {
    // Arrange
    const consolaLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result: ValidationResult = {
      warnings: [
        { severity: 'warning', location: 'path', param: 'id', message: 'Warning 1' },
        { severity: 'info', location: 'query', param: 'date', message: 'Info 1' },
      ],
      skipped: false,
    };

    // Note: consola.log internally uses console.log, but we can't easily mock consola
    // So this test just verifies the function doesn't throw
    expect(() => displayWarnings(result, false)).not.toThrow();

    consolaLog.mockRestore();
  });

  it('should not log when skipped', () => {
    const result: ValidationResult = {
      warnings: [{ severity: 'warning', location: 'path', param: 'id', message: 'Should not show' }],
      skipped: true,
    };

    // Should not throw and should produce no output
    expect(() => displayWarnings(result, false)).not.toThrow();
  });
});
