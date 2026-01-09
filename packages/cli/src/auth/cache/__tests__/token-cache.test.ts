/**
 * Token Cache Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateExpiresAt, generateCacheKey, TokenCache, tokenCache } from '../token-cache.js';

describe('Token Cache', () => {
  describe('generateCacheKey', () => {
    it('should generate key from tokenUrl and clientId', () => {
      const key = generateCacheKey('https://auth.example.com/token', 'my-client');
      expect(key).toBe('https://auth.example.com/token::my-client');
    });

    it('should include scope in key when provided', () => {
      const key = generateCacheKey('https://auth.example.com/token', 'my-client', 'read write');
      expect(key).toBe('https://auth.example.com/token::my-client::read write');
    });

    it('should generate different keys for different scopes', () => {
      const key1 = generateCacheKey('https://auth.example.com/token', 'client', 'read');
      const key2 = generateCacheKey('https://auth.example.com/token', 'client', 'write');
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different clients', () => {
      const key1 = generateCacheKey('https://auth.example.com/token', 'client1');
      const key2 = generateCacheKey('https://auth.example.com/token', 'client2');
      expect(key1).not.toBe(key2);
    });
  });

  describe('calculateExpiresAt', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-06T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate expiration with default safety buffer (30s)', () => {
      const now = Date.now();
      const expiresAt = calculateExpiresAt(3600); // 1 hour

      // Should be 3570 seconds from now (3600 - 30)
      expect(expiresAt).toBe(now + 3570 * 1000);
    });

    it('should use custom safety buffer', () => {
      const now = Date.now();
      const expiresAt = calculateExpiresAt(3600, 60); // 1 minute buffer

      // Should be 3540 seconds from now (3600 - 60)
      expect(expiresAt).toBe(now + 3540 * 1000);
    });

    it('should use default TTL (3600s) when expiresIn is not provided', () => {
      const now = Date.now();
      const expiresAt = calculateExpiresAt(undefined);

      // Default 3600 - 30 = 3570
      expect(expiresAt).toBe(now + 3570 * 1000);
    });

    it('should not go negative when expiresIn is smaller than safety buffer', () => {
      const now = Date.now();
      const expiresAt = calculateExpiresAt(10, 30); // 10s < 30s buffer

      // Should be 0 (expires immediately)
      expect(expiresAt).toBe(now);
    });
  });

  describe('TokenCache class', () => {
    let cache: TokenCache;

    beforeEach(() => {
      cache = new TokenCache();
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-06T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('set and get', () => {
      it('should store and retrieve a token', () => {
        cache.set('key1', 'access_token_123', 'Bearer', 3600);

        const result = cache.get('key1');
        expect(result).toBeDefined();
        expect(result?.accessToken).toBe('access_token_123');
        expect(result?.tokenType).toBe('Bearer');
      });

      it('should store scope when provided', () => {
        cache.set('key1', 'token', 'Bearer', 3600, 'read write');

        const result = cache.get('key1');
        expect(result?.scope).toBe('read write');
      });

      it('should return undefined for non-existent key', () => {
        const result = cache.get('nonexistent');
        expect(result).toBeUndefined();
      });

      it('should return undefined and delete expired token', () => {
        cache.set('key1', 'token', 'Bearer', 60); // Expires in ~30s (60-30 buffer)

        // Advance time past expiration
        vi.advanceTimersByTime(35 * 1000);

        const result = cache.get('key1');
        expect(result).toBeUndefined();
        expect(cache.size).toBe(0);
      });

      it('should return token if not yet expired', () => {
        cache.set('key1', 'token', 'Bearer', 3600);

        // Advance time but not past expiration
        vi.advanceTimersByTime(1000 * 1000); // 1000 seconds

        const result = cache.get('key1');
        expect(result).toBeDefined();
        expect(result?.accessToken).toBe('token');
      });

      it('should overwrite existing entry with same key', () => {
        cache.set('key1', 'old_token', 'Bearer', 3600);
        cache.set('key1', 'new_token', 'Bearer', 7200);

        const result = cache.get('key1');
        expect(result?.accessToken).toBe('new_token');
        expect(cache.size).toBe(1);
      });
    });

    describe('delete', () => {
      it('should remove an entry', () => {
        cache.set('key1', 'token', 'Bearer', 3600);

        const deleted = cache.delete('key1');
        expect(deleted).toBe(true);
        expect(cache.get('key1')).toBeUndefined();
      });

      it('should return false for non-existent key', () => {
        const deleted = cache.delete('nonexistent');
        expect(deleted).toBe(false);
      });
    });

    describe('clear', () => {
      it('should remove all entries', () => {
        cache.set('key1', 'token1', 'Bearer', 3600);
        cache.set('key2', 'token2', 'Bearer', 3600);
        cache.set('key3', 'token3', 'Bearer', 3600);

        cache.clear();

        expect(cache.size).toBe(0);
        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBeUndefined();
        expect(cache.get('key3')).toBeUndefined();
      });
    });

    describe('has', () => {
      it('should return true for existing non-expired entry', () => {
        cache.set('key1', 'token', 'Bearer', 3600);
        expect(cache.has('key1')).toBe(true);
      });

      it('should return false for non-existent entry', () => {
        expect(cache.has('nonexistent')).toBe(false);
      });

      it('should return false for expired entry', () => {
        cache.set('key1', 'token', 'Bearer', 60);
        vi.advanceTimersByTime(35 * 1000);
        expect(cache.has('key1')).toBe(false);
      });
    });

    describe('size', () => {
      it('should return correct count', () => {
        expect(cache.size).toBe(0);

        cache.set('key1', 'token1', 'Bearer', 3600);
        expect(cache.size).toBe(1);

        cache.set('key2', 'token2', 'Bearer', 3600);
        expect(cache.size).toBe(2);

        cache.delete('key1');
        expect(cache.size).toBe(1);
      });
    });
  });

  describe('Singleton tokenCache', () => {
    afterEach(() => {
      tokenCache.clear();
    });

    it('should be a singleton instance', () => {
      tokenCache.set('test', 'token', 'Bearer', 3600);
      expect(tokenCache.get('test')).toBeDefined();
    });
  });
});
