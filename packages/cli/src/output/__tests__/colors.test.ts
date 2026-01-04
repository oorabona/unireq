/**
 * Tests for color utilities
 * Following AAA pattern for unit tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bold, dim, getStatusColor, getTerminalWidth, shouldUseColors } from '../colors.js';

describe('shouldUseColors', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return true when forceColors is true', () => {
    expect(shouldUseColors(true)).toBe(true);
  });

  it('should return false when forceColors is false', () => {
    expect(shouldUseColors(false)).toBe(false);
  });

  it('should return false when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    expect(shouldUseColors()).toBe(false);
  });

  it('should return true when FORCE_COLOR is set', () => {
    process.env['FORCE_COLOR'] = '1';
    expect(shouldUseColors()).toBe(true);
  });
});

describe('getStatusColor', () => {
  it('should return green for 2xx status', () => {
    const colorFn = getStatusColor(200, true);
    const result = colorFn('OK');
    expect(result).toContain('OK');
  });

  it('should return yellow for 3xx status', () => {
    const colorFn = getStatusColor(301, true);
    const result = colorFn('Moved');
    expect(result).toContain('Moved');
  });

  it('should return red for 4xx status', () => {
    const colorFn = getStatusColor(404, true);
    const result = colorFn('Not Found');
    expect(result).toContain('Not Found');
  });

  it('should return red for 5xx status', () => {
    const colorFn = getStatusColor(500, true);
    const result = colorFn('Error');
    expect(result).toContain('Error');
  });

  it('should return identity function when colors disabled', () => {
    const colorFn = getStatusColor(200, false);
    expect(colorFn('test')).toBe('test');
  });
});

describe('dim', () => {
  it('should apply dim styling when colors enabled', () => {
    const result = dim('text', true);
    expect(result).toContain('text');
  });

  it('should return plain text when colors disabled', () => {
    const result = dim('text', false);
    expect(result).toBe('text');
  });
});

describe('bold', () => {
  it('should apply bold styling when colors enabled', () => {
    const result = bold('text', true);
    expect(result).toContain('text');
  });

  it('should return plain text when colors disabled', () => {
    const result = bold('text', false);
    expect(result).toBe('text');
  });
});

describe('getTerminalWidth', () => {
  const originalColumns = process.stdout.columns;

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
  });

  it('should return process.stdout.columns when available', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 120,
      writable: true,
      configurable: true,
    });

    expect(getTerminalWidth()).toBe(120);
  });

  it('should return default 80 when columns undefined', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(getTerminalWidth()).toBe(80);
  });

  it('should return custom default when columns undefined', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(getTerminalWidth(100)).toBe(100);
  });

  it('should return default when columns is 0', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 0,
      writable: true,
      configurable: true,
    });

    expect(getTerminalWidth()).toBe(80);
  });
});
