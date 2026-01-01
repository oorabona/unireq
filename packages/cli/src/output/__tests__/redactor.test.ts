/**
 * Tests for header redaction module
 * Following AAA pattern for unit tests
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SENSITIVE_HEADERS, REDACTED, redactHeaders, redactValue, shouldRedact } from '../redactor.js';

describe('redactor', () => {
  describe('DEFAULT_SENSITIVE_HEADERS', () => {
    it('should include all expected sensitive headers', () => {
      // Arrange & Act
      const headers = DEFAULT_SENSITIVE_HEADERS;

      // Assert
      expect(headers).toContain('authorization');
      expect(headers).toContain('x-api-key');
      expect(headers).toContain('api-key');
      expect(headers).toContain('x-auth-token');
      expect(headers).toContain('proxy-authorization');
      expect(headers).toContain('cookie');
      expect(headers).toContain('set-cookie');
    });
  });

  describe('shouldRedact', () => {
    describe('default patterns', () => {
      it('should return true for Authorization header', () => {
        expect(shouldRedact('Authorization')).toBe(true);
        expect(shouldRedact('authorization')).toBe(true);
        expect(shouldRedact('AUTHORIZATION')).toBe(true);
      });

      it('should return true for X-API-Key header', () => {
        expect(shouldRedact('X-API-Key')).toBe(true);
        expect(shouldRedact('x-api-key')).toBe(true);
        expect(shouldRedact('X-Api-Key')).toBe(true);
      });

      it('should return true for API-Key header', () => {
        expect(shouldRedact('API-Key')).toBe(true);
        expect(shouldRedact('api-key')).toBe(true);
      });

      it('should return true for X-Auth-Token header', () => {
        expect(shouldRedact('X-Auth-Token')).toBe(true);
        expect(shouldRedact('x-auth-token')).toBe(true);
      });

      it('should return true for Proxy-Authorization header', () => {
        expect(shouldRedact('Proxy-Authorization')).toBe(true);
        expect(shouldRedact('proxy-authorization')).toBe(true);
      });

      it('should return true for Cookie header', () => {
        expect(shouldRedact('Cookie')).toBe(true);
        expect(shouldRedact('cookie')).toBe(true);
      });

      it('should return true for Set-Cookie header', () => {
        expect(shouldRedact('Set-Cookie')).toBe(true);
        expect(shouldRedact('set-cookie')).toBe(true);
      });

      it('should return false for non-sensitive headers', () => {
        expect(shouldRedact('Content-Type')).toBe(false);
        expect(shouldRedact('Accept')).toBe(false);
        expect(shouldRedact('Cache-Control')).toBe(false);
        expect(shouldRedact('User-Agent')).toBe(false);
      });
    });

    describe('additional patterns', () => {
      it('should match exact additional patterns', () => {
        expect(shouldRedact('X-Custom-Auth', ['x-custom-auth'])).toBe(true);
        expect(shouldRedact('x-custom-auth', ['X-Custom-Auth'])).toBe(true);
      });

      it('should match wildcard patterns', () => {
        expect(shouldRedact('X-Tenant-Secret', ['x-tenant-*'])).toBe(true);
        expect(shouldRedact('X-Tenant-Token', ['x-tenant-*'])).toBe(true);
        expect(shouldRedact('X-Tenant-', ['x-tenant-*'])).toBe(true);
      });

      it('should not match non-matching wildcard patterns', () => {
        expect(shouldRedact('X-Other-Header', ['x-tenant-*'])).toBe(false);
      });

      it('should combine default and additional patterns', () => {
        // Default pattern
        expect(shouldRedact('Authorization', ['x-custom'])).toBe(true);
        // Additional pattern
        expect(shouldRedact('X-Custom', ['x-custom'])).toBe(true);
        // Neither
        expect(shouldRedact('Content-Type', ['x-custom'])).toBe(false);
      });
    });
  });

  describe('redactValue', () => {
    describe('Authorization header', () => {
      it('should preserve Bearer prefix', () => {
        expect(redactValue('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9')).toBe(`Bearer ${REDACTED}`);
      });

      it('should preserve Basic prefix', () => {
        expect(redactValue('Authorization', 'Basic dXNlcjpwYXNz')).toBe(`Basic ${REDACTED}`);
      });

      it('should preserve Digest prefix', () => {
        expect(redactValue('Authorization', 'Digest username="test"')).toBe(`Digest ${REDACTED}`);
      });

      it('should handle case variations in prefix', () => {
        expect(redactValue('Authorization', 'bearer token123')).toBe(`bearer ${REDACTED}`);
        expect(redactValue('Authorization', 'BEARER token123')).toBe(`BEARER ${REDACTED}`);
      });

      it('should redact values without recognized prefix', () => {
        expect(redactValue('Authorization', 'custom-token-value')).toBe(REDACTED);
      });

      it('should handle empty value', () => {
        expect(redactValue('Authorization', '')).toBe(REDACTED);
      });
    });

    describe('Proxy-Authorization header', () => {
      it('should preserve Basic prefix', () => {
        expect(redactValue('Proxy-Authorization', 'Basic abc123')).toBe(`Basic ${REDACTED}`);
      });
    });

    describe('other headers', () => {
      it('should fully redact X-API-Key', () => {
        expect(redactValue('X-API-Key', 'sk-123456789')).toBe(REDACTED);
      });

      it('should fully redact Cookie', () => {
        expect(redactValue('Cookie', 'session=abc123; other=value')).toBe(REDACTED);
      });

      it('should fully redact Set-Cookie', () => {
        expect(redactValue('Set-Cookie', 'session=abc123; Path=/; HttpOnly')).toBe(REDACTED);
      });
    });
  });

  describe('redactHeaders', () => {
    describe('default behavior', () => {
      it('should redact Authorization header with Bearer prefix', () => {
        // Arrange
        const headers = { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9...' };

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result['Authorization']).toBe(`Bearer ${REDACTED}`);
      });

      it('should redact X-API-Key header', () => {
        // Arrange
        const headers = { 'X-API-Key': 'sk-123456789' };

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result['X-API-Key']).toBe(REDACTED);
      });

      it('should redact Set-Cookie header', () => {
        // Arrange
        const headers = { 'Set-Cookie': 'session=abc123; Path=/; HttpOnly' };

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result['Set-Cookie']).toBe(REDACTED);
      });

      it('should handle case-insensitive header names', () => {
        // Arrange
        const headers = { authorization: 'basic dXNlcjpwYXNz' };

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result['authorization']).toBe(`basic ${REDACTED}`);
      });

      it('should not modify non-sensitive headers', () => {
        // Arrange
        const headers = { 'Content-Type': 'application/json' };

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result['Content-Type']).toBe('application/json');
      });

      it('should handle multiple headers with mixed sensitivity', () => {
        // Arrange
        const headers = {
          Authorization: 'Bearer token123',
          'X-API-Key': 'key456',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result['Authorization']).toBe(`Bearer ${REDACTED}`);
        expect(result['X-API-Key']).toBe(REDACTED);
        expect(result['Content-Type']).toBe('application/json');
        expect(result['Accept']).toBe('application/json');
      });

      it('should handle empty Authorization value', () => {
        // Arrange
        const headers = { Authorization: '' };

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result['Authorization']).toBe(REDACTED);
      });

      it('should return new object, not mutate original', () => {
        // Arrange
        const headers = { Authorization: 'Bearer secret' };

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result).not.toBe(headers);
        expect(headers.Authorization).toBe('Bearer secret');
      });
    });

    describe('showSecrets option', () => {
      it('should not redact when showSecrets is true', () => {
        // Arrange
        const headers = {
          Authorization: 'Bearer secret123',
          'X-API-Key': 'key456',
        };

        // Act
        const result = redactHeaders(headers, { showSecrets: true });

        // Assert
        expect(result['Authorization']).toBe('Bearer secret123');
        expect(result['X-API-Key']).toBe('key456');
      });

      it('should return headers as-is when showSecrets is true', () => {
        // Arrange
        const headers = { Authorization: 'Bearer secret' };

        // Act
        const result = redactHeaders(headers, { showSecrets: true });

        // Assert
        expect(result).toEqual(headers);
      });
    });

    describe('additionalPatterns option', () => {
      it('should redact custom patterns', () => {
        // Arrange
        const headers = { 'X-Custom-Auth': 'mytoken' };

        // Act
        const result = redactHeaders(headers, { additionalPatterns: ['x-custom-auth'] });

        // Assert
        expect(result['X-Custom-Auth']).toBe(REDACTED);
      });

      it('should support wildcard patterns', () => {
        // Arrange
        const headers = { 'X-Tenant-Secret': 'abc123' };

        // Act
        const result = redactHeaders(headers, { additionalPatterns: ['x-tenant-*'] });

        // Assert
        expect(result['X-Tenant-Secret']).toBe(REDACTED);
      });

      it('should still apply default patterns with additional patterns', () => {
        // Arrange
        const headers = {
          Authorization: 'Bearer token',
          'X-Custom-Auth': 'custom',
        };

        // Act
        const result = redactHeaders(headers, { additionalPatterns: ['x-custom-auth'] });

        // Assert
        expect(result['Authorization']).toBe(`Bearer ${REDACTED}`);
        expect(result['X-Custom-Auth']).toBe(REDACTED);
      });
    });

    describe('empty and edge cases', () => {
      it('should handle empty headers object', () => {
        // Arrange
        const headers = {};

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result).toEqual({});
      });

      it('should handle headers with only non-sensitive values', () => {
        // Arrange
        const headers = {
          'Content-Type': 'application/json',
          Accept: '*/*',
          'User-Agent': 'test',
        };

        // Act
        const result = redactHeaders(headers);

        // Assert
        expect(result).toEqual(headers);
      });
    });
  });
});
