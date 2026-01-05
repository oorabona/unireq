/**
 * Tests for Notice Extraction Utility
 */

import { describe, expect, it } from 'vitest';
import { extractNotices, hasNotices } from '../notices.js';

describe('extractNotices', () => {
  describe('Rate limit notices', () => {
    it('should extract rate limit warning when below 25%', () => {
      const headers = new Headers({
        'X-RateLimit-Remaining': '20',
        'X-RateLimit-Limit': '100',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.type).toBe('rate-limit');
      expect(notices[0]?.severity).toBe('warning');
      expect(notices[0]?.message).toContain('20/100');
    });

    it('should extract rate limit error when below 10%', () => {
      const headers = new Headers({
        'X-RateLimit-Remaining': '5',
        'X-RateLimit-Limit': '100',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.severity).toBe('error');
      expect(notices[0]?.message).toContain('🔴');
    });

    it('should not extract notice when above 25%', () => {
      const headers = new Headers({
        'X-RateLimit-Remaining': '50',
        'X-RateLimit-Limit': '100',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(0);
    });

    it('should include reset time in seconds', () => {
      const resetTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now
      const headers = new Headers({
        'X-RateLimit-Remaining': '5',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Reset': resetTime.toString(),
      });

      const notices = extractNotices(headers);

      expect(notices[0]?.message).toContain('resets in');
      expect(notices[0]?.message).toContain('min');
    });

    it('should handle plain object headers', () => {
      const headers = {
        'X-RateLimit-Remaining': '10',
        'X-RateLimit-Limit': '100',
      };

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.message).toContain('10/100');
    });

    it('should handle Map headers', () => {
      const headers = new Map([
        ['X-RateLimit-Remaining', '15'],
        ['X-RateLimit-Limit', '100'],
      ]);

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
    });
  });

  describe('Deprecation notices', () => {
    it('should extract deprecation header', () => {
      const headers = new Headers({
        Deprecation: 'true',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.type).toBe('deprecation');
      expect(notices[0]?.severity).toBe('warning');
      expect(notices[0]?.message).toContain('deprecated');
    });

    it('should include sunset date', () => {
      const headers = new Headers({
        Deprecation: 'true',
        Sunset: 'Sat, 01 Feb 2025 00:00:00 GMT',
      });

      const notices = extractNotices(headers);

      expect(notices[0]?.message).toContain('removed');
    });

    it('should extract X-Deprecated header', () => {
      const headers = new Headers({
        'X-Deprecated': 'Use /v2/users instead',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.message).toContain('Use /v2/users instead');
    });

    it('should prefer standard Deprecation over X-Deprecated', () => {
      const headers = new Headers({
        Deprecation: 'true',
        'X-Deprecated': 'Custom message',
      });

      const notices = extractNotices(headers);

      // Should only have one deprecation notice (the standard one)
      const deprecationNotices = notices.filter((n) => n.type === 'deprecation');
      expect(deprecationNotices).toHaveLength(1);
      expect(deprecationNotices[0]?.header).toBe('Deprecation');
    });
  });

  describe('Retry-After notices', () => {
    it('should extract retry-after in seconds', () => {
      const headers = new Headers({
        'Retry-After': '30',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.type).toBe('retry-after');
      expect(notices[0]?.message).toContain('30 seconds');
    });

    it('should convert seconds to minutes when > 60', () => {
      const headers = new Headers({
        'Retry-After': '120',
      });

      const notices = extractNotices(headers);

      expect(notices[0]?.message).toContain('2 minutes');
    });

    it('should handle HTTP-date format', () => {
      const headers = new Headers({
        'Retry-After': 'Wed, 01 Jan 2025 12:00:00 GMT',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.message).toContain('Retry after');
    });
  });

  describe('Custom notices', () => {
    it('should extract X-API-Warn header', () => {
      const headers = new Headers({
        'X-API-Warn': 'This endpoint is slow',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.type).toBe('custom');
      expect(notices[0]?.severity).toBe('warning');
      expect(notices[0]?.message).toContain('This endpoint is slow');
    });

    it('should extract X-API-Notice header', () => {
      const headers = new Headers({
        'X-API-Notice': 'New feature available',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.severity).toBe('info');
      expect(notices[0]?.message).toContain('New feature available');
    });

    it('should extract Warning header', () => {
      const headers = new Headers({
        Warning: '199 - "Response is stale"',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(1);
      expect(notices[0]?.message).toContain('Response is stale');
    });
  });

  describe('Multiple notices', () => {
    it('should extract all notice types', () => {
      const headers = new Headers({
        'X-RateLimit-Remaining': '5',
        'X-RateLimit-Limit': '100',
        Deprecation: 'true',
        'X-API-Warn': 'Slow endpoint',
      });

      const notices = extractNotices(headers);

      expect(notices.length).toBeGreaterThanOrEqual(3);

      const types = notices.map((n) => n.type);
      expect(types).toContain('rate-limit');
      expect(types).toContain('deprecation');
      expect(types).toContain('custom');
    });
  });

  describe('No notices', () => {
    it('should return empty array for headers without notices', () => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Content-Length': '1234',
      });

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(0);
    });

    it('should return empty array for empty headers', () => {
      const headers = new Headers();

      const notices = extractNotices(headers);

      expect(notices).toHaveLength(0);
    });
  });
});

describe('hasNotices', () => {
  it('should return true when notices exist', () => {
    const headers = new Headers({
      'X-RateLimit-Remaining': '5',
      'X-RateLimit-Limit': '100',
    });

    expect(hasNotices(headers)).toBe(true);
  });

  it('should return false when no notices', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
    });

    expect(hasNotices(headers)).toBe(false);
  });
});
