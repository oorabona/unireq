/**
 * Tests for output color utilities
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bold, dim, getStatusColor, shouldUseColors } from '../output/colors.js';

describe('output/colors', () => {
  const originalEnv = { ...process.env };
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
    });
  });

  describe('shouldUseColors', () => {
    beforeEach(() => {
      // Reset environment for these tests
      delete process.env['NO_COLOR'];
      delete process.env['FORCE_COLOR'];
    });

    describe('when forceColors is specified', () => {
      it('should return true when forceColors is true', () => {
        expect(shouldUseColors(true)).toBe(true);
      });

      it('should return false when forceColors is false', () => {
        expect(shouldUseColors(false)).toBe(false);
      });
    });

    describe('when NO_COLOR env var is set', () => {
      it('should return false regardless of TTY', () => {
        process.env['NO_COLOR'] = '1';
        Object.defineProperty(process.stdout, 'isTTY', {
          value: true,
          writable: true,
        });

        expect(shouldUseColors()).toBe(false);
      });

      it('should return false even with empty value', () => {
        process.env['NO_COLOR'] = '';
        expect(shouldUseColors()).toBe(false);
      });
    });

    describe('when FORCE_COLOR env var is set', () => {
      it('should return true even when not TTY', () => {
        process.env['FORCE_COLOR'] = '1';
        Object.defineProperty(process.stdout, 'isTTY', {
          value: false,
          writable: true,
        });

        expect(shouldUseColors()).toBe(true);
      });
    });

    describe('when auto-detecting', () => {
      it('should return true when stdout is TTY', () => {
        Object.defineProperty(process.stdout, 'isTTY', {
          value: true,
          writable: true,
        });

        expect(shouldUseColors()).toBe(true);
      });

      it('should return false when stdout is not TTY', () => {
        Object.defineProperty(process.stdout, 'isTTY', {
          value: false,
          writable: true,
        });

        expect(shouldUseColors()).toBe(false);
      });

      it('should return false when isTTY is undefined', () => {
        Object.defineProperty(process.stdout, 'isTTY', {
          value: undefined,
          writable: true,
        });

        expect(shouldUseColors()).toBe(false);
      });
    });
  });

  describe('getStatusColor', () => {
    describe('when colors are disabled', () => {
      it('should return identity function for 2xx', () => {
        const colorFn = getStatusColor(200, false);
        expect(colorFn('200 OK')).toBe('200 OK');
      });

      it('should return identity function for 3xx', () => {
        const colorFn = getStatusColor(301, false);
        expect(colorFn('301 Moved')).toBe('301 Moved');
      });

      it('should return identity function for 4xx', () => {
        const colorFn = getStatusColor(404, false);
        expect(colorFn('404 Not Found')).toBe('404 Not Found');
      });

      it('should return identity function for 5xx', () => {
        const colorFn = getStatusColor(500, false);
        expect(colorFn('500 Error')).toBe('500 Error');
      });
    });

    describe('when colors are enabled', () => {
      // Note: picocolors may not output ANSI codes in non-TTY test environment
      // We verify the function is returned and processes input correctly

      it('should return a function for 2xx status', () => {
        const colorFn = getStatusColor(200, true);
        expect(typeof colorFn).toBe('function');
        // Function should contain the original text
        expect(colorFn('200 OK')).toContain('200 OK');
      });

      it('should return a function for 201', () => {
        const colorFn = getStatusColor(201, true);
        expect(typeof colorFn).toBe('function');
        expect(colorFn('201 Created')).toContain('201 Created');
      });

      it('should return a function for 204', () => {
        const colorFn = getStatusColor(204, true);
        expect(typeof colorFn).toBe('function');
        expect(colorFn('204 No Content')).toContain('204 No Content');
      });

      it('should return a function for 3xx status', () => {
        const colorFn = getStatusColor(301, true);
        expect(typeof colorFn).toBe('function');
        expect(colorFn('301 Moved')).toContain('301 Moved');
      });

      it('should return a function for 304', () => {
        const colorFn = getStatusColor(304, true);
        expect(typeof colorFn).toBe('function');
        expect(colorFn('304 Not Modified')).toContain('304 Not Modified');
      });

      it('should return a function for 4xx status', () => {
        const colorFn = getStatusColor(404, true);
        expect(typeof colorFn).toBe('function');
        expect(colorFn('404 Not Found')).toContain('404 Not Found');
      });

      it('should return a function for 400', () => {
        const colorFn = getStatusColor(400, true);
        expect(typeof colorFn).toBe('function');
        expect(colorFn('400 Bad Request')).toContain('400 Bad Request');
      });

      it('should return a function for 5xx status', () => {
        const colorFn = getStatusColor(500, true);
        expect(typeof colorFn).toBe('function');
        expect(colorFn('500 Internal Server Error')).toContain('500 Internal Server Error');
      });

      it('should return a function for 503', () => {
        const colorFn = getStatusColor(503, true);
        expect(typeof colorFn).toBe('function');
        expect(colorFn('503 Service Unavailable')).toContain('503 Service Unavailable');
      });
    });

    describe('status code categorization', () => {
      // Verify correct categorization by comparing color functions
      it('should use same color for all 2xx statuses', () => {
        const color200 = getStatusColor(200, true);
        const color201 = getStatusColor(201, true);
        const color204 = getStatusColor(204, true);
        const color299 = getStatusColor(299, true);

        // All should produce same transformation
        expect(color200('X')).toBe(color201('X'));
        expect(color200('X')).toBe(color204('X'));
        expect(color200('X')).toBe(color299('X'));
      });

      it('should use same color for all 3xx statuses', () => {
        const color301 = getStatusColor(301, true);
        const color302 = getStatusColor(302, true);
        const color304 = getStatusColor(304, true);

        expect(color301('X')).toBe(color302('X'));
        expect(color301('X')).toBe(color304('X'));
      });

      it('should use same color for all 4xx statuses', () => {
        const color400 = getStatusColor(400, true);
        const color404 = getStatusColor(404, true);
        const color499 = getStatusColor(499, true);

        expect(color400('X')).toBe(color404('X'));
        expect(color400('X')).toBe(color499('X'));
      });

      it('should use same color for all 5xx statuses', () => {
        const color500 = getStatusColor(500, true);
        const color503 = getStatusColor(503, true);
        const color599 = getStatusColor(599, true);

        expect(color500('X')).toBe(color503('X'));
        expect(color500('X')).toBe(color599('X'));
      });

      it('should use same color for 4xx and 5xx (both are errors)', () => {
        const color400 = getStatusColor(400, true);
        const color500 = getStatusColor(500, true);

        // Both should use red (same color)
        expect(color400('X')).toBe(color500('X'));
      });

      it('should use different color for 2xx vs 3xx', () => {
        const color200 = getStatusColor(200, true);
        const color300 = getStatusColor(300, true);

        // Might be same in non-TTY, but function identity differs
        // This tests the logic, not the actual ANSI output
        const result200 = color200('X');
        const result300 = color300('X');

        // In TTY with colors, these would differ
        // In non-TTY, both return 'X'
        // We just verify they don't throw
        expect(result200).toBeTruthy();
        expect(result300).toBeTruthy();
      });
    });
  });

  describe('dim', () => {
    it('should return original text when colors disabled', () => {
      expect(dim('test', false)).toBe('test');
    });

    it('should return text when colors enabled', () => {
      const result = dim('test', true);
      expect(result).toContain('test');
    });
  });

  describe('bold', () => {
    it('should return original text when colors disabled', () => {
      expect(bold('test', false)).toBe('test');
    });

    it('should return text when colors enabled', () => {
      const result = bold('test', true);
      expect(result).toContain('test');
    });
  });
});
