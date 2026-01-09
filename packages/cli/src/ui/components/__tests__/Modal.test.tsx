/**
 * Tests for Modal component utilities
 */

import { describe, expect, it } from 'vitest';
import { calculateModalWidth, getVisualWidth } from '../Modal.js';

describe('Modal utilities', () => {
  describe('getVisualWidth', () => {
    it('should return correct width for ASCII strings', () => {
      expect(getVisualWidth('hello')).toBe(5);
      expect(getVisualWidth('hello world')).toBe(11);
      expect(getVisualWidth('')).toBe(0);
    });

    it('should return width 2 for common emojis and symbols', () => {
      expect(getVisualWidth('🌐')).toBe(2);
      expect(getVisualWidth('✓')).toBe(2); // U+2713 is in Dingbats range (0x2700-0x27bf)
      expect(getVisualWidth('🔴')).toBe(2);
      expect(getVisualWidth('📋')).toBe(2);
    });

    it('should handle mixed content', () => {
      expect(getVisualWidth('🌐 HTTP')).toBe(7); // 2 + 1 + 4
      expect(getVisualWidth('Tab: switch · ↑↓')).toBe(16);
    });

    it('should strip ANSI escape codes', () => {
      expect(getVisualWidth('\x1b[32mgreen\x1b[0m')).toBe(5);
      expect(getVisualWidth('\x1b[1;34mblue bold\x1b[0m')).toBe(9);
    });

    it('should handle emoji sequences', () => {
      // Emoji + space + text: 🌐(2) + space(1) + "HTTP Defaults"(13) = 16
      expect(getVisualWidth('🌐 HTTP Defaults')).toBe(16);
    });
  });

  describe('calculateModalWidth', () => {
    it('should return baseWidth when no content provided', () => {
      expect(calculateModalWidth({})).toBe(50); // default baseWidth
      expect(calculateModalWidth({ baseWidth: 60 })).toBe(60);
    });

    it('should account for footer width', () => {
      // Footer: "Tab: switch · Esc: close" = 24 chars + 2 padding = 26
      // But baseWidth=30 is larger, so returns 30
      expect(
        calculateModalWidth({
          footer: 'Tab: switch · Esc: close',
          baseWidth: 30,
        }),
      ).toBe(30);

      // With smaller baseWidth, footer determines width
      expect(
        calculateModalWidth({
          footer: 'Tab: switch · Esc: close',
          baseWidth: 20,
        }),
      ).toBe(26); // 24 + 2 padding
    });

    it('should account for title width', () => {
      expect(
        calculateModalWidth({
          title: '🌐 HTTP Defaults (modified)',
          baseWidth: 30,
        }),
      ).toBe(30); // 28 + 2 = 30, but title with emoji is 29, so max is 31
    });

    it('should account for content lines', () => {
      expect(
        calculateModalWidth({
          contentLines: ['short', 'this is a longer line here'],
          baseWidth: 20,
        }),
      ).toBe(28); // 26 + 2 padding
    });

    it('should return max of all sources', () => {
      const width = calculateModalWidth({
        footer: 'short footer',
        title: 'title',
        contentLines: ['this is the longest content line in the modal'],
        baseWidth: 30,
      });
      expect(width).toBe(47); // 45 + 2 padding
    });

    it('should handle custom padding', () => {
      expect(
        calculateModalWidth({
          footer: 'footer text',
          padding: 4,
        }),
      ).toBe(50); // baseWidth is larger
    });

    it('should handle emojis in calculations', () => {
      const width = calculateModalWidth({
        title: '🌐 HTTP Defaults',
        footer: 'Esc: close',
        baseWidth: 10,
      });
      // Title: 🌐(2) + space(1) + "HTTP Defaults"(13) = 16 + 2 padding = 18
      // Footer: 10 + 2 = 12
      // baseWidth: 10
      // max(10, 18, 12) = 18
      expect(width).toBe(18);
    });
  });
});
