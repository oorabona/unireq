/**
 * Tests for URL Resolution Utility
 *
 * Covers BDD scenarios S-3 to S-10 at the unit level.
 */

import { describe, expect, it } from 'vitest';
import { buildDisplayUrl, isExplicitUrl, normalizeUrl, resolveUrl, UrlResolutionError } from '../url-resolver.js';

describe('normalizeUrl', () => {
  it('should preserve protocol slashes', () => {
    expect(normalizeUrl('https://api.example.com')).toBe('https://api.example.com');
    expect(normalizeUrl('http://api.example.com')).toBe('http://api.example.com');
  });

  it('should collapse double slashes in path', () => {
    expect(normalizeUrl('https://api.example.com//users')).toBe('https://api.example.com/users');
    expect(normalizeUrl('https://api.example.com/users//123')).toBe('https://api.example.com/users/123');
  });

  it('should collapse multiple slashes', () => {
    expect(normalizeUrl('https://api.example.com///users///posts')).toBe('https://api.example.com/users/posts');
  });

  it('should handle paths without protocol', () => {
    expect(normalizeUrl('/users//123')).toBe('/users/123');
    expect(normalizeUrl('//users')).toBe('/users');
  });
});

describe('isExplicitUrl', () => {
  it('should return true for https URLs', () => {
    expect(isExplicitUrl('https://api.example.com')).toBe(true);
    expect(isExplicitUrl('https://api.example.com/users')).toBe(true);
  });

  it('should return true for http URLs', () => {
    expect(isExplicitUrl('http://localhost:3000')).toBe(true);
  });

  it('should return false for paths', () => {
    expect(isExplicitUrl('/users')).toBe(false);
    expect(isExplicitUrl('users')).toBe(false);
    expect(isExplicitUrl('123')).toBe(false);
  });
});

describe('resolveUrl', () => {
  describe('S-6: Explicit URL (ignores baseUrl)', () => {
    it('should return explicit https URL as-is', () => {
      const result = resolveUrl('https://other.com/foo', {
        baseUrl: 'https://api.example.com',
        currentPath: '/users',
      });

      expect(result.url).toBe('https://other.com/foo');
      expect(result.isExplicit).toBe(true);
    });

    it('should return explicit http URL as-is', () => {
      const result = resolveUrl('http://localhost:3000/test', {
        baseUrl: 'https://api.example.com',
        currentPath: '/users',
      });

      expect(result.url).toBe('http://localhost:3000/test');
      expect(result.isExplicit).toBe(true);
    });

    it('should work without baseUrl for explicit URLs', () => {
      const result = resolveUrl('https://other.com/foo', {
        baseUrl: undefined,
        currentPath: '/users',
      });

      expect(result.url).toBe('https://other.com/foo');
      expect(result.isExplicit).toBe(true);
    });
  });

  describe('S-3: Implicit URL (no input)', () => {
    it('should use baseUrl + currentPath when no input', () => {
      const result = resolveUrl(undefined, {
        baseUrl: 'https://api.example.com',
        currentPath: '/users',
      });

      expect(result.url).toBe('https://api.example.com/users');
      expect(result.isExplicit).toBe(false);
    });

    it('should use baseUrl + currentPath for empty string', () => {
      const result = resolveUrl('', {
        baseUrl: 'https://api.example.com',
        currentPath: '/users',
      });

      expect(result.url).toBe('https://api.example.com/users');
      expect(result.isExplicit).toBe(false);
    });

    it('should handle root currentPath', () => {
      const result = resolveUrl(undefined, {
        baseUrl: 'https://api.example.com',
        currentPath: '/',
      });

      expect(result.url).toBe('https://api.example.com/');
    });
  });

  describe('S-4: Relative segment', () => {
    it('should append segment to currentPath', () => {
      const result = resolveUrl('123', {
        baseUrl: 'https://api.example.com',
        currentPath: '/users',
      });

      expect(result.url).toBe('https://api.example.com/users/123');
      expect(result.isExplicit).toBe(false);
    });

    it('should handle currentPath with trailing slash', () => {
      const result = resolveUrl('123', {
        baseUrl: 'https://api.example.com',
        currentPath: '/users/',
      });

      expect(result.url).toBe('https://api.example.com/users/123');
    });

    it('should handle multi-segment input', () => {
      const result = resolveUrl('123/posts', {
        baseUrl: 'https://api.example.com',
        currentPath: '/users',
      });

      expect(result.url).toBe('https://api.example.com/users/123/posts');
    });
  });

  describe('S-10: Relative segment with nested path', () => {
    it('should append to nested currentPath', () => {
      const result = resolveUrl('456', {
        baseUrl: 'https://api.example.com',
        currentPath: '/users/123/posts',
      });

      expect(result.url).toBe('https://api.example.com/users/123/posts/456');
    });
  });

  describe('S-5: Absolute path', () => {
    it('should replace currentPath with absolute path', () => {
      const result = resolveUrl('/orders', {
        baseUrl: 'https://api.example.com',
        currentPath: '/users',
      });

      expect(result.url).toBe('https://api.example.com/orders');
      expect(result.isExplicit).toBe(false);
    });

    it('should handle nested absolute path', () => {
      const result = resolveUrl('/orders/456/items', {
        baseUrl: 'https://api.example.com',
        currentPath: '/users/123',
      });

      expect(result.url).toBe('https://api.example.com/orders/456/items');
    });
  });

  describe('S-9: URL normalization', () => {
    it('should remove trailing slash from baseUrl', () => {
      const result = resolveUrl('/orders', {
        baseUrl: 'https://api.example.com/',
        currentPath: '/users',
      });

      expect(result.url).toBe('https://api.example.com/orders');
    });

    it('should prevent double slashes', () => {
      const result = resolveUrl(undefined, {
        baseUrl: 'https://api.example.com/',
        currentPath: '/users/',
      });

      // Should not have double slashes
      expect(result.url).not.toContain('//users');
      expect(result.url).toBe('https://api.example.com/users/');
    });

    it('should normalize path without leading slash', () => {
      const result = resolveUrl(undefined, {
        baseUrl: 'https://api.example.com',
        currentPath: 'users', // Missing leading slash
      });

      expect(result.url).toBe('https://api.example.com/users');
    });
  });

  describe('S-7: Error when no URL and no baseUrl', () => {
    it('should throw UrlResolutionError when no input and no baseUrl', () => {
      expect(() =>
        resolveUrl(undefined, {
          baseUrl: undefined,
          currentPath: '/users',
        }),
      ).toThrow(UrlResolutionError);
    });

    it('should include helpful message', () => {
      try {
        resolveUrl(undefined, {
          baseUrl: undefined,
          currentPath: '/users',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UrlResolutionError);
        expect((error as UrlResolutionError).message).toContain('No base URL');
        expect((error as UrlResolutionError).hint).toBeDefined();
      }
    });
  });

  describe('S-8: Error when relative path and no baseUrl', () => {
    it('should throw for absolute path without baseUrl', () => {
      expect(() =>
        resolveUrl('/users', {
          baseUrl: undefined,
          currentPath: '/',
        }),
      ).toThrow(UrlResolutionError);
    });

    it('should throw for relative segment without baseUrl', () => {
      expect(() =>
        resolveUrl('123', {
          baseUrl: undefined,
          currentPath: '/users',
        }),
      ).toThrow(UrlResolutionError);
    });

    it('should include path in error message', () => {
      try {
        resolveUrl('/users', {
          baseUrl: undefined,
          currentPath: '/',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as UrlResolutionError).message).toContain('/users');
      }
    });
  });
});

describe('buildDisplayUrl', () => {
  it('should return full URL when baseUrl is available', () => {
    const result = buildDisplayUrl({
      baseUrl: 'https://api.example.com',
      currentPath: '/users',
    });

    expect(result).toBe('https://api.example.com/users');
  });

  it('should return undefined when no baseUrl', () => {
    const result = buildDisplayUrl({
      baseUrl: undefined,
      currentPath: '/users',
    });

    expect(result).toBeUndefined();
  });

  it('should normalize the URL', () => {
    const result = buildDisplayUrl({
      baseUrl: 'https://api.example.com/',
      currentPath: '/users/',
    });

    expect(result).toBe('https://api.example.com/users/');
  });

  it('should handle root path', () => {
    const result = buildDisplayUrl({
      baseUrl: 'https://api.example.com',
      currentPath: '/',
    });

    expect(result).toBe('https://api.example.com/');
  });
});
