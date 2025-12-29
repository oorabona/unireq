/**
 * @unireq/http - Range request tests
 */

import { describe, expect, it } from 'vitest';
import { parseContentRange, range, resume, supportsRange } from '../range.js';

describe('@unireq/http - range policy', () => {
  it('should add Range header with start and end', async () => {
    const policy = range({ start: 0, end: 1023 });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 206,
        statusText: 'Partial Content',
        headers: {},
        data: 'partial data',
        ok: true,
      };
    });

    expect(capturedHeaders['range']).toBe('bytes=0-1023');
  });

  it('should add Range header with start only', async () => {
    const policy = range({ start: 1024 });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 206,
        statusText: 'Partial Content',
        headers: {},
        data: 'partial data',
        ok: true,
      };
    });

    expect(capturedHeaders['range']).toBe('bytes=1024-');
  });

  it('should support custom unit', async () => {
    const policy = range({ start: 0, end: 100, unit: 'items' });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 206,
        statusText: 'Partial Content',
        headers: {},
        data: 'partial data',
        ok: true,
      };
    });

    expect(capturedHeaders['range']).toBe('items=0-100');
  });

  it('should use bytes as default unit', async () => {
    const policy = range({ start: 500, end: 999 });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 206,
        statusText: 'Partial Content',
        headers: {},
        data: 'partial data',
        ok: true,
      };
    });

    expect(capturedHeaders['range']).toBe('bytes=500-999');
  });

  it('should preserve existing headers', async () => {
    const policy = range({ start: 0, end: 100 });

    let capturedHeaders: Record<string, string> = {};
    await policy(
      {
        url: 'https://example.com',
        method: 'GET',
        headers: { 'x-custom': 'value' },
      },
      async (ctx) => {
        capturedHeaders = ctx.headers;
        return {
          status: 206,
          statusText: 'Partial Content',
          headers: {},
          data: 'partial data',
          ok: true,
        };
      },
    );

    expect(capturedHeaders['range']).toBe('bytes=0-100');
    expect(capturedHeaders['x-custom']).toBe('value');
  });

  it('should handle zero as start position', async () => {
    const policy = range({ start: 0 });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 206,
        statusText: 'Partial Content',
        headers: {},
        data: 'partial data',
        ok: true,
      };
    });

    expect(capturedHeaders['range']).toBe('bytes=0-');
  });

  it('should handle large byte ranges', async () => {
    const policy = range({ start: 1000000, end: 2000000 });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 206,
        statusText: 'Partial Content',
        headers: {},
        data: 'partial data',
        ok: true,
      };
    });

    expect(capturedHeaders['range']).toBe('bytes=1000000-2000000');
  });
});

describe('@unireq/http - resume policy', () => {
  it('should not add Range header when downloaded is 0', async () => {
    const policy = resume({ downloaded: 0 });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'full data',
        ok: true,
      };
    });

    expect(capturedHeaders['range']).toBeUndefined();
  });

  it('should add Range header when downloaded > 0', async () => {
    const policy = resume({ downloaded: 5000 });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 206,
        statusText: 'Partial Content',
        headers: {},
        data: 'resumed data',
        ok: true,
      };
    });

    expect(capturedHeaders['range']).toBe('bytes=5000-');
  });

  it('should use total if provided', async () => {
    const policy = resume({ downloaded: 3000, total: 10000 });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 206,
        statusText: 'Partial Content',
        headers: {},
        data: 'resumed data',
        ok: true,
      };
    });

    // Resume uses open-ended range (total is metadata, not used in Range header)
    expect(capturedHeaders['range']).toBe('bytes=3000-');
  });

  it('should preserve existing headers', async () => {
    const policy = resume({ downloaded: 1000 });

    let capturedHeaders: Record<string, string> = {};
    await policy(
      {
        url: 'https://example.com',
        method: 'GET',
        headers: { 'x-custom': 'value' },
      },
      async (ctx) => {
        capturedHeaders = ctx.headers;
        return {
          status: 206,
          statusText: 'Partial Content',
          headers: {},
          data: 'resumed data',
          ok: true,
        };
      },
    );

    expect(capturedHeaders['range']).toBe('bytes=1000-');
    expect(capturedHeaders['x-custom']).toBe('value');
  });

  it('should handle resume from near end', async () => {
    const policy = resume({ downloaded: 99999, total: 100000 });

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 206,
        statusText: 'Partial Content',
        headers: {},
        data: 'final byte',
        ok: true,
      };
    });

    expect(capturedHeaders['range']).toBe('bytes=99999-');
  });
});

describe('@unireq/http - supportsRange', () => {
  it('should return true when Accept-Ranges is bytes', () => {
    const response = {
      headers: { 'accept-ranges': 'bytes' },
    };

    expect(supportsRange(response)).toBe(true);
  });

  it('should return true when Accept-Ranges is bytes (capital A)', () => {
    const response = {
      headers: { 'Accept-Ranges': 'bytes' },
    };

    expect(supportsRange(response)).toBe(true);
  });

  it('should return false when Accept-Ranges is none', () => {
    const response = {
      headers: { 'accept-ranges': 'none' },
    };

    expect(supportsRange(response)).toBe(false);
  });

  it('should return false when Accept-Ranges header is missing', () => {
    const response = {
      headers: {},
    };

    expect(supportsRange(response)).toBe(false);
  });

  it('should return false for other values', () => {
    const response = {
      headers: { 'accept-ranges': 'items' },
    };

    expect(supportsRange(response)).toBe(false);
  });
});

describe('@unireq/http - parseContentRange', () => {
  it('should parse valid Content-Range header', () => {
    const result = parseContentRange('bytes 200-1023/1024');

    expect(result).toEqual({
      unit: 'bytes',
      start: 200,
      end: 1023,
      total: 1024,
    });
  });

  it('should parse Content-Range with unknown total', () => {
    const result = parseContentRange('bytes 0-499/*');

    expect(result).toEqual({
      unit: 'bytes',
      start: 0,
      end: 499,
      total: undefined,
    });
  });

  it('should parse Content-Range with custom unit', () => {
    const result = parseContentRange('items 10-20/100');

    expect(result).toEqual({
      unit: 'items',
      start: 10,
      end: 20,
      total: 100,
    });
  });

  it('should return null for invalid format', () => {
    const result = parseContentRange('invalid');

    expect(result).toBeNull();
  });

  it('should return null for missing parts', () => {
    const result = parseContentRange('bytes 0-');

    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = parseContentRange('');

    expect(result).toBeNull();
  });

  it('should parse large byte ranges', () => {
    const result = parseContentRange('bytes 1000000-2000000/5000000');

    expect(result).toEqual({
      unit: 'bytes',
      start: 1000000,
      end: 2000000,
      total: 5000000,
    });
  });

  it('should parse single byte range', () => {
    const result = parseContentRange('bytes 0-0/1');

    expect(result).toEqual({
      unit: 'bytes',
      start: 0,
      end: 0,
      total: 1,
    });
  });

  it('should parse full range', () => {
    const result = parseContentRange('bytes 0-999/1000');

    expect(result).toEqual({
      unit: 'bytes',
      start: 0,
      end: 999,
      total: 1000,
    });
  });

  it('should handle spaces correctly', () => {
    const result = parseContentRange('bytes 100-200/300');

    expect(result).toEqual({
      unit: 'bytes',
      start: 100,
      end: 200,
      total: 300,
    });
  });

  it('should return null for malformed headers', () => {
    // Various malformed formats that fail regex match
    expect(parseContentRange('bytes')).toBeNull();
    expect(parseContentRange('bytes 200')).toBeNull();
    expect(parseContentRange('200-300/400')).toBeNull();
    expect(parseContentRange('bytes-200-300/400')).toBeNull();
  });
});
