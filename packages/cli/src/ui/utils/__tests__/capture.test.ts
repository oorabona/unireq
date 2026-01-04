/**
 * Tests for Output Capture Utility
 */

import { consola } from 'consola';
import { describe, expect, it } from 'vitest';
import { captureOutput, formatCapturedOutput, hasErrors, hasWarnings } from '../capture.js';

describe('captureOutput', () => {
  describe('Basic capture', () => {
    it('should capture info logs', async () => {
      const output = await captureOutput(async () => {
        consola.info('Hello world');
      });

      expect(output.lines).toHaveLength(1);
      expect(output.lines[0]?.level).toBe('info');
      expect(output.lines[0]?.text).toBe('Hello world');
    });

    it('should capture multiple log levels', async () => {
      const output = await captureOutput(async () => {
        consola.info('Info message');
        consola.warn('Warning message');
        consola.error('Error message');
        consola.success('Success message');
      });

      expect(output.lines).toHaveLength(4);
      expect(output.lines[0]?.level).toBe('info');
      expect(output.lines[1]?.level).toBe('warn');
      expect(output.lines[2]?.level).toBe('error');
      expect(output.lines[3]?.level).toBe('success');
    });

    it('should capture logs with multiple arguments', async () => {
      const output = await captureOutput(async () => {
        consola.info('Request to', '/users', 'completed');
      });

      expect(output.lines[0]?.text).toBe('Request to /users completed');
    });

    it('should stringify non-string arguments', async () => {
      const output = await captureOutput(async () => {
        consola.info('Data:', { id: 1, name: 'test' });
      });

      expect(output.lines[0]?.text).toContain('Data:');
      expect(output.lines[0]?.text).toContain('"id":1');
    });
  });

  describe('Error handling', () => {
    it('should capture thrown errors', async () => {
      const output = await captureOutput(async () => {
        throw new Error('Test error');
      });

      expect(output.error).toBeDefined();
      expect(output.error?.message).toBe('Test error');
    });

    it('should still capture logs before error', async () => {
      const output = await captureOutput(async () => {
        consola.info('Before error');
        throw new Error('Boom');
      });

      expect(output.lines).toHaveLength(1);
      expect(output.lines[0]?.text).toBe('Before error');
      expect(output.error).toBeDefined();
    });

    it('should handle non-Error throws', async () => {
      const output = await captureOutput(async () => {
        throw 'string error';
      });

      expect(output.error).toBeDefined();
      expect(output.error?.message).toBe('string error');
    });
  });

  describe('Duration tracking', () => {
    it('should track execution duration', async () => {
      const output = await captureOutput(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(output.duration).toBeGreaterThanOrEqual(50);
      expect(output.duration).toBeLessThan(200);
    });
  });

  describe('Reporter restoration', () => {
    it('should restore original reporters after capture', async () => {
      const originalReporters = consola.options.reporters;

      await captureOutput(async () => {
        consola.info('Inside capture');
      });

      expect(consola.options.reporters).toBe(originalReporters);
    });

    it('should restore reporters even after error', async () => {
      const originalReporters = consola.options.reporters;

      await captureOutput(async () => {
        throw new Error('Test');
      });

      expect(consola.options.reporters).toBe(originalReporters);
    });
  });
});

describe('formatCapturedOutput', () => {
  it('should join lines with newlines', async () => {
    const output = await captureOutput(async () => {
      consola.info('Line 1');
      consola.info('Line 2');
      consola.info('Line 3');
    });

    const formatted = formatCapturedOutput(output);
    expect(formatted).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should return empty string for no output', async () => {
    const output = await captureOutput(async () => {
      // No logging
    });

    expect(formatCapturedOutput(output)).toBe('');
  });
});

describe('hasErrors', () => {
  it('should return true when error was thrown', async () => {
    const output = await captureOutput(async () => {
      throw new Error('Test');
    });

    expect(hasErrors(output)).toBe(true);
  });

  it('should return true when error level logs exist', async () => {
    const output = await captureOutput(async () => {
      consola.error('Something went wrong');
    });

    expect(hasErrors(output)).toBe(true);
  });

  it('should return false for warnings only', async () => {
    const output = await captureOutput(async () => {
      consola.warn('Just a warning');
    });

    expect(hasErrors(output)).toBe(false);
  });

  it('should return false for info only', async () => {
    const output = await captureOutput(async () => {
      consola.info('All good');
    });

    expect(hasErrors(output)).toBe(false);
  });
});

describe('hasWarnings', () => {
  it('should return true when warnings exist', async () => {
    const output = await captureOutput(async () => {
      consola.warn('Watch out');
    });

    expect(hasWarnings(output)).toBe(true);
  });

  it('should return false for info only', async () => {
    const output = await captureOutput(async () => {
      consola.info('All good');
    });

    expect(hasWarnings(output)).toBe(false);
  });
});
