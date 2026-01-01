/**
 * Tests for redaction and truncation utilities
 */

import { describe, expect, it } from 'vitest';
import { isBinaryBody, redactBody, redactHeaders, truncateBody } from '../redactor.js';

describe('redactHeaders', () => {
  it('should redact Authorization header', () => {
    // Arrange
    const headers = {
      Authorization: 'Bearer secret-token-123',
      'Content-Type': 'application/json',
    };

    // Act
    const result = redactHeaders(headers);

    // Assert
    expect(result['Authorization']).toBe('[REDACTED]');
    expect(result['Content-Type']).toBe('application/json');
  });

  it('should redact multiple sensitive headers', () => {
    // Arrange
    const headers = {
      'X-Api-Key': 'my-api-key',
      Cookie: 'session=abc123',
      'X-Auth-Token': 'token123',
      Accept: 'application/json',
    };

    // Act
    const result = redactHeaders(headers);

    // Assert
    expect(result['X-Api-Key']).toBe('[REDACTED]');
    expect(result['Cookie']).toBe('[REDACTED]');
    expect(result['X-Auth-Token']).toBe('[REDACTED]');
    expect(result['Accept']).toBe('application/json');
  });

  it('should be case-insensitive for header names', () => {
    // Arrange
    const headers = {
      AUTHORIZATION: 'Bearer token',
      authorization: 'Bearer token2',
    };

    // Act
    const result = redactHeaders(headers);

    // Assert
    expect(result['AUTHORIZATION']).toBe('[REDACTED]');
    expect(result['authorization']).toBe('[REDACTED]');
  });

  it('should preserve original header name casing', () => {
    // Arrange
    const headers = {
      'X-API-KEY': 'secret',
    };

    // Act
    const result = redactHeaders(headers);

    // Assert
    expect(result['X-API-KEY']).toBe('[REDACTED]');
    expect(result['x-api-key']).toBeUndefined();
  });

  it('should handle empty headers object', () => {
    // Arrange
    const headers = {};

    // Act
    const result = redactHeaders(headers);

    // Assert
    expect(result).toEqual({});
  });
});

describe('redactBody', () => {
  it('should redact password field in JSON body', () => {
    // Arrange
    const body = JSON.stringify({ username: 'alice', password: 'secret123' });

    // Act
    const result = redactBody(body);

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.username).toBe('alice');
    expect(parsed.password).toBe('[REDACTED]');
  });

  it('should redact multiple sensitive fields', () => {
    // Arrange
    const body = JSON.stringify({
      user: 'bob',
      token: 'abc123',
      api_key: 'key456',
      refresh_token: 'refresh789',
    });

    // Act
    const result = redactBody(body);

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.user).toBe('bob');
    expect(parsed.token).toBe('[REDACTED]');
    expect(parsed.api_key).toBe('[REDACTED]');
    expect(parsed.refresh_token).toBe('[REDACTED]');
  });

  it('should redact nested sensitive fields', () => {
    // Arrange
    const body = JSON.stringify({
      user: { name: 'alice', auth: { password: 'secret' } },
    });

    // Act
    const result = redactBody(body);

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.user.name).toBe('alice');
    expect(parsed.user.auth.password).toBe('[REDACTED]');
  });

  it('should redact entire sensitive field when it is an object', () => {
    // Arrange - "credentials" is a sensitive field name, so entire value is redacted
    const body = JSON.stringify({
      user: { name: 'alice', credentials: { username: 'bob', password: 'secret' } },
    });

    // Act
    const result = redactBody(body);

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.user.name).toBe('alice');
    expect(parsed.user.credentials).toBe('[REDACTED]');
  });

  it('should redact sensitive fields in arrays', () => {
    // Arrange
    const body = JSON.stringify({
      users: [
        { name: 'alice', password: 'pass1' },
        { name: 'bob', password: 'pass2' },
      ],
    });

    // Act
    const result = redactBody(body);

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.users[0].name).toBe('alice');
    expect(parsed.users[0].password).toBe('[REDACTED]');
    expect(parsed.users[1].name).toBe('bob');
    expect(parsed.users[1].password).toBe('[REDACTED]');
  });

  it('should be case-insensitive for field names', () => {
    // Arrange
    const body = JSON.stringify({
      PASSWORD: 'secret1',
      Password: 'secret2',
    });

    // Act
    const result = redactBody(body);

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.PASSWORD).toBe('[REDACTED]');
    expect(parsed.Password).toBe('[REDACTED]');
  });

  it('should return non-JSON body unchanged', () => {
    // Arrange
    const body = 'plain text content';

    // Act
    const result = redactBody(body);

    // Assert
    expect(result).toBe('plain text content');
  });

  it('should handle empty body', () => {
    // Arrange
    const body = '';

    // Act
    const result = redactBody(body);

    // Assert
    expect(result).toBe('');
  });

  it('should handle null and undefined in JSON', () => {
    // Arrange
    const body = JSON.stringify({ value: null, other: undefined });

    // Act
    const result = redactBody(body);

    // Assert
    const parsed = JSON.parse(result);
    expect(parsed.value).toBeNull();
  });
});

describe('truncateBody', () => {
  it('should not truncate body smaller than max size', () => {
    // Arrange
    const body = 'short body';

    // Act
    const result = truncateBody(body, 100);

    // Assert
    expect(result.body).toBe('short body');
    expect(result.truncated).toBe(false);
  });

  it('should truncate body larger than max size', () => {
    // Arrange
    const body = 'x'.repeat(200);

    // Act
    const result = truncateBody(body, 100);

    // Assert
    expect(result.body.length).toBeLessThan(200);
    expect(result.body).toContain('...[truncated]');
    expect(result.truncated).toBe(true);
  });

  it('should handle UTF-8 characters correctly', () => {
    // Arrange
    const body = '日本語テスト'.repeat(50); // Multi-byte characters

    // Act
    const result = truncateBody(body, 100);

    // Assert
    expect(result.truncated).toBe(true);
    // Should not end with replacement character
    expect(result.body).not.toContain('\uFFFD');
  });

  it('should handle empty body', () => {
    // Arrange
    const body = '';

    // Act
    const result = truncateBody(body, 100);

    // Assert
    expect(result.body).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('should handle body exactly at max size', () => {
    // Arrange
    const body = 'x'.repeat(100);

    // Act
    const result = truncateBody(body, 100);

    // Assert
    expect(result.body).toBe(body);
    expect(result.truncated).toBe(false);
  });
});

describe('isBinaryBody', () => {
  it('should detect null bytes as binary', () => {
    // Arrange
    const body = 'text\x00with\x00nulls';

    // Act
    const result = isBinaryBody(body);

    // Assert
    expect(result).toBe(true);
  });

  it('should detect high ratio of control characters as binary', () => {
    // Arrange
    const body = '\x01\x02\x03\x04\x05\x06\x07\x08'.repeat(20);

    // Act
    const result = isBinaryBody(body);

    // Assert
    expect(result).toBe(true);
  });

  it('should not flag normal text as binary', () => {
    // Arrange
    const body = 'This is normal text with newlines\nand tabs\t!';

    // Act
    const result = isBinaryBody(body);

    // Assert
    expect(result).toBe(false);
  });

  it('should allow common whitespace characters', () => {
    // Arrange
    const body = 'Text\twith\ttabs\nand\nnewlines\rand\rcarriage returns';

    // Act
    const result = isBinaryBody(body);

    // Assert
    expect(result).toBe(false);
  });

  it('should handle empty body', () => {
    // Arrange
    const body = '';

    // Act
    const result = isBinaryBody(body);

    // Assert
    expect(result).toBe(false);
  });

  it('should handle JSON content', () => {
    // Arrange
    const body = JSON.stringify({ key: 'value', number: 123 });

    // Act
    const result = isBinaryBody(body);

    // Assert
    expect(result).toBe(false);
  });
});
