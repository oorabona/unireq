/**
 * @unireq/core - URL utilities tests
 */

import { describe, expect, it } from 'vitest';
import { URLNormalizationError } from '../errors.js';
import { appendQueryParams, getHeader, normalizeHeaders, normalizeURL, setHeader } from '../url.js';

describe('@unireq/core - normalizeURL', () => {
  it('should return absolute URL as-is', () => {
    expect(normalizeURL('https://example.com/path')).toBe('https://example.com/path');
    expect(normalizeURL('http://localhost:3000')).toBe('http://localhost:3000/');
  });

  it('should resolve relative URL with base', () => {
    expect(normalizeURL('/path', { base: 'https://example.com' })).toBe('https://example.com/path');
    expect(normalizeURL('path', { base: 'https://example.com' })).toBe('https://example.com/path');
  });

  it('should add default scheme to base without protocol', () => {
    expect(normalizeURL('/path', { base: 'example.com' })).toBe('https://example.com/path');
    expect(normalizeURL('/path', { base: 'example.com', defaultScheme: 'http' })).toBe('http://example.com/path');
  });

  it('should handle protocol-relative URLs', () => {
    expect(normalizeURL('//example.com/path')).toBe('https://example.com/path');
    expect(normalizeURL('//example.com/path', { defaultScheme: 'http' })).toBe('http://example.com/path');
  });

  it('should prepend default scheme to hostname with base', () => {
    expect(normalizeURL('example.com/path', { base: 'https://api.com' })).toBe('https://api.com/example.com/path');
  });

  it('should throw for relative URL without base', () => {
    expect(() => normalizeURL('/path')).toThrow(URLNormalizationError);
    expect(() => normalizeURL('/path')).toThrow('Relative URL requires URI in transport');
    expect(() => normalizeURL('example.com/path')).toThrow(URLNormalizationError);
    expect(() => normalizeURL('example.com/path')).toThrow('Relative URL requires URI in transport');
  });

  it('should throw for invalid URL', () => {
    expect(() => normalizeURL('ht!tp://invalid')).toThrow(URLNormalizationError);
  });

  it('should wrap non-URLNormalizationError in URLNormalizationError', () => {
    // URL constructor throws TypeError for invalid characters like null byte
    expect(() => normalizeURL('\x00invalid')).toThrow(URLNormalizationError);
    expect(() => normalizeURL('\x00invalid')).toThrow('Failed to normalize URL');
  });
});

describe('@unireq/core - appendQueryParams', () => {
  it('should append query parameters to URL without existing params', () => {
    const result = appendQueryParams('https://example.com', { foo: 'bar', baz: 123 });
    expect(result).toBe('https://example.com/?foo=bar&baz=123');
  });

  it('should append query parameters to URL with existing params', () => {
    const result = appendQueryParams('https://example.com?existing=value', { foo: 'bar' });
    expect(result).toContain('existing=value');
    expect(result).toContain('foo=bar');
  });

  it('should skip undefined values', () => {
    const result = appendQueryParams('https://example.com', { foo: 'bar', baz: undefined });
    expect(result).toBe('https://example.com/?foo=bar');
  });

  it('should handle boolean values', () => {
    const result = appendQueryParams('https://example.com', { enabled: true, disabled: false });
    expect(result).toContain('enabled=true');
    expect(result).toContain('disabled=false');
  });

  it('should handle number values', () => {
    const result = appendQueryParams('https://example.com', { count: 42, score: 0 });
    expect(result).toContain('count=42');
    expect(result).toContain('score=0');
  });

  it('should handle empty params object', () => {
    const result = appendQueryParams('https://example.com', {});
    expect(result).toBe('https://example.com/');
  });
});

describe('@unireq/core - normalizeHeaders', () => {
  it('should convert all header keys to lowercase', () => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/html',
      'X-Custom-Header': 'value',
    };

    const result = normalizeHeaders(headers);

    expect(result).toEqual({
      'content-type': 'application/json',
      accept: 'text/html',
      'x-custom-header': 'value',
    });
  });

  it('should handle empty headers object', () => {
    const result = normalizeHeaders({});
    expect(result).toEqual({});
  });

  it('should handle already lowercase headers', () => {
    const headers = {
      'content-type': 'application/json',
      accept: 'text/html',
    };

    const result = normalizeHeaders(headers);
    expect(result).toEqual(headers);
  });
});

describe('@unireq/core - getHeader', () => {
  it('should find header with exact lowercase match', () => {
    const headers = { 'content-type': 'application/json' };
    expect(getHeader(headers, 'content-type')).toBe('application/json');
  });

  it('should find header with case-insensitive match', () => {
    const headers = { 'Content-Type': 'application/json' };
    expect(getHeader(headers, 'content-type')).toBe('application/json');
  });

  it('should find header regardless of input case', () => {
    const headers = { 'content-type': 'application/json' };
    expect(getHeader(headers, 'Content-Type')).toBe('application/json');
  });

  it('should return undefined for missing header', () => {
    const headers = { 'content-type': 'application/json' };
    expect(getHeader(headers, 'accept')).toBeUndefined();
  });

  it('should handle mixed-case headers', () => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/html',
      'x-custom-header': 'value',
    };

    expect(getHeader(headers, 'content-type')).toBe('application/json');
    expect(getHeader(headers, 'ACCEPT')).toBe('text/html');
    expect(getHeader(headers, 'X-Custom-Header')).toBe('value');
  });

  it('should return undefined for empty headers', () => {
    expect(getHeader({}, 'content-type')).toBeUndefined();
  });
});

describe('@unireq/core - setHeader', () => {
  it('should set header with normalized lowercase name', () => {
    const result = setHeader({}, 'Content-Type', 'application/json');
    expect(result).toEqual({ 'content-type': 'application/json' });
  });

  it('should remove existing variants with different casing', () => {
    const headers = {
      Accept: 'text/html',
      'x-custom': 'value',
    };
    const result = setHeader(headers, 'accept', 'application/json');
    expect(result).toEqual({
      accept: 'application/json',
      'x-custom': 'value',
    });
    expect(result['Accept']).toBeUndefined();
  });

  it('should handle multiple case variants', () => {
    const headers = {
      ACCEPT: 'text/html',
      Accept: 'application/xml',
      accept: 'application/json',
    };
    const result = setHeader(headers, 'Accept', 'text/plain');
    expect(result).toEqual({ accept: 'text/plain' });
  });

  it('should preserve other headers', () => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
      Accept: 'text/html',
    };
    const result = setHeader(headers, 'accept', 'application/json');
    expect(result).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
      accept: 'application/json',
    });
  });

  it('should work with empty headers object', () => {
    const result = setHeader({}, 'x-custom', 'value');
    expect(result).toEqual({ 'x-custom': 'value' });
  });

  it('should be immutable (not mutate original)', () => {
    const original = { Accept: 'text/html' };
    const result = setHeader(original, 'accept', 'application/json');
    expect(original).toEqual({ Accept: 'text/html' }); // Original unchanged
    expect(result).toEqual({ accept: 'application/json' });
  });
});
