/**
 * Tests for trace output formatting
 */

import type { TimingInfo } from '@unireq/http';
import { describe, expect, it } from 'vitest';
import { formatTrace, formatTraceCompact } from '../trace.js';

describe('formatTrace', () => {
  const createTiming = (overrides: Partial<TimingInfo> = {}): TimingInfo => ({
    ttfb: 50,
    download: 30,
    total: 80,
    startTime: 1000,
    endTime: 1080,
    ...overrides,
  });

  describe('basic formatting', () => {
    it('should format timing information with sections', () => {
      const timing = createTiming();
      const result = formatTrace(timing, { useColors: false });

      expect(result).toContain('Timing');
      expect(result).toContain('TTFB');
      expect(result).toContain('Download');
      expect(result).toContain('Total');
    });

    it('should display timing values in milliseconds', () => {
      const timing = createTiming({ ttfb: 150, download: 50, total: 200 });
      const result = formatTrace(timing, { useColors: false });

      expect(result).toContain('150ms');
      expect(result).toContain('50ms');
      expect(result).toContain('200ms');
    });

    it('should display timing values in seconds for values >= 1000ms', () => {
      const timing = createTiming({ ttfb: 1500, download: 500, total: 2000 });
      const result = formatTrace(timing, { useColors: false });

      expect(result).toContain('1.50s');
      expect(result).toContain('500ms');
      expect(result).toContain('2.00s');
    });

    it('should display <1ms for very fast operations', () => {
      const timing = createTiming({ ttfb: 0, download: 0.5, total: 0.5 });
      const result = formatTrace(timing, { useColors: false });

      expect(result).toContain('<1ms');
    });
  });

  describe('timing bars', () => {
    it('should create proportional timing bars', () => {
      const timing = createTiming({ ttfb: 80, download: 20, total: 100 });
      const result = formatTrace(timing, { useColors: false });

      // TTFB bar should be longer than download bar
      const lines = result.split('\n');
      const ttfbLine = lines.find((l) => l.includes('TTFB'));
      const downloadLine = lines.find((l) => l.includes('Download'));

      expect(ttfbLine).toBeDefined();
      expect(downloadLine).toBeDefined();

      // Count filled bar characters (█)
      const ttfbFilled = (ttfbLine?.match(/█/g) || []).length;
      const downloadFilled = (downloadLine?.match(/█/g) || []).length;

      expect(ttfbFilled).toBeGreaterThan(downloadFilled);
    });

    it('should handle zero total gracefully', () => {
      const timing = createTiming({ ttfb: 0, download: 0, total: 0 });
      const result = formatTrace(timing, { useColors: false });

      // Should not throw, should show empty bars
      expect(result).toContain('─'.repeat(20));
    });
  });

  describe('optional connection breakdown', () => {
    it('should display DNS timing when available', () => {
      const timing = createTiming({ dns: 10 });
      const result = formatTrace(timing, { useColors: false });

      expect(result).toContain('DNS:');
      expect(result).toContain('10ms');
    });

    it('should display TCP timing when available', () => {
      const timing = createTiming({ tcp: 15 });
      const result = formatTrace(timing, { useColors: false });

      expect(result).toContain('TCP:');
      expect(result).toContain('15ms');
    });

    it('should display TLS timing when available', () => {
      const timing = createTiming({ tls: 25 });
      const result = formatTrace(timing, { useColors: false });

      expect(result).toContain('TLS:');
      expect(result).toContain('25ms');
    });

    it('should display connection breakdown header when any phase is available', () => {
      const timing = createTiming({ dns: 10, tcp: 15, tls: 25 });
      const result = formatTrace(timing, { useColors: false });

      expect(result).toContain('Connection breakdown');
      expect(result).toContain('DNS:');
      expect(result).toContain('TCP:');
      expect(result).toContain('TLS:');
    });

    it('should not display connection breakdown when no phases available', () => {
      const timing = createTiming();
      const result = formatTrace(timing, { useColors: false });

      expect(result).not.toContain('Connection breakdown');
      expect(result).not.toContain('DNS:');
      expect(result).not.toContain('TCP:');
      expect(result).not.toContain('TLS:');
    });
  });

  describe('color handling', () => {
    it('should include formatting when colors enabled', () => {
      const timing = createTiming();
      const resultWithColors = formatTrace(timing, { useColors: true });
      const resultWithoutColors = formatTrace(timing, { useColors: false });

      // With colors should have ANSI escape codes
      expect(resultWithColors).toContain('\x1b[');
      expect(resultWithoutColors).not.toContain('\x1b[');
    });
  });
});

describe('formatTraceCompact', () => {
  it('should format compact timing line', () => {
    const timing: TimingInfo = {
      ttfb: 50,
      download: 30,
      total: 80,
      startTime: 1000,
      endTime: 1080,
    };

    const result = formatTraceCompact(timing);

    expect(result).toBe('[80ms total, 50ms TTFB]');
  });

  it('should format with seconds for large values', () => {
    const timing: TimingInfo = {
      ttfb: 1500,
      download: 500,
      total: 2000,
      startTime: 1000,
      endTime: 3000,
    };

    const result = formatTraceCompact(timing);

    expect(result).toBe('[2.00s total, 1.50s TTFB]');
  });

  it('should handle sub-millisecond values', () => {
    const timing: TimingInfo = {
      ttfb: 0,
      download: 0.5,
      total: 0.5,
      startTime: 1000,
      endTime: 1000,
    };

    const result = formatTraceCompact(timing);

    expect(result).toBe('[<1ms total, <1ms TTFB]');
  });
});
