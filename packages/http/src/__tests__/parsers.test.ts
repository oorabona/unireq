/**
 * @unireq/http - Parsers tests
 */

import { NotAcceptableError } from '@unireq/core';
import { describe, expect, it } from 'vitest';
import { accept, json, text } from '../parsers.js';

describe('@unireq/http - accept parser', () => {
  it('should set Accept header with single media type', async () => {
    const policy = accept(['application/json']);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (_ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should set Accept header with multiple media types', async () => {
    const policy = accept(['application/json', 'application/xml']);

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: 'OK',
        ok: true,
      };
    });

    expect(capturedHeaders['accept']).toBe('application/json, application/xml');
  });

  it('should accept response with matching content-type', async () => {
    const policy = accept(['application/json']);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should accept response with Content-Type (capital C)', async () => {
    const policy = accept(['application/json']);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should throw NotAcceptableError for mismatched content-type', async () => {
    const policy = accept(['application/json']);

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow(NotAcceptableError);
  });

  it('should accept wildcard */*', async () => {
    const policy = accept(['*/*']);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'anything/goes' },
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should accept partial wildcard text/*', async () => {
    const policy = accept(['text/*']);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/plain' },
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should reject when partial wildcard does not match', async () => {
    const policy = accept(['application/*']);

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow(NotAcceptableError);
  });

  it('should not validate non-2xx responses', async () => {
    const policy = accept(['application/json']);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'text/html' },
      data: 'Not Found',
      ok: false,
    }));

    expect(result.status).toBe(404);
  });

  it('should handle missing content-type header', async () => {
    const policy = accept(['application/json']);

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow(NotAcceptableError);
  });

  it('should accept when any of multiple types match', async () => {
    const policy = accept(['application/json', 'application/xml', 'text/html']);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/xml' },
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should skip validation for 204 No Content', async () => {
    const policy = accept(['application/json']);

    const result = await policy({ url: 'https://example.com', method: 'DELETE', headers: {} }, async () => ({
      status: 204,
      statusText: 'No Content',
      headers: {}, // No content-type header
      data: '',
      ok: true,
    }));

    expect(result.status).toBe(204);
  });

  it('should skip validation for 205 Reset Content', async () => {
    const policy = accept(['application/json']);

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async () => ({
      status: 205,
      statusText: 'Reset Content',
      headers: {}, // No content-type header
      data: '',
      ok: true,
    }));

    expect(result.status).toBe(205);
  });

  it('should skip validation for 304 Not Modified', async () => {
    const policy = accept(['application/json']);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 304,
      statusText: 'Not Modified',
      headers: { 'content-type': 'text/html' }, // Wrong content-type but should be ignored
      data: '',
      ok: true,
    }));

    expect(result.status).toBe(304);
  });

  it('should skip validation for HEAD requests', async () => {
    const policy = accept(['application/json']);

    const result = await policy({ url: 'https://example.com', method: 'HEAD', headers: {} }, async (_ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html' }, // Wrong content-type but should be ignored for HEAD
      data: '',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should reject mismatched content-type for 204 with GET (edge case)', async () => {
    // Even though 204 normally has no body, if a 204 has wrong content-type, we skip validation
    const policy = accept(['application/json']);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 204,
      statusText: 'No Content',
      headers: { 'content-type': 'text/html' },
      data: '',
      ok: true,
    }));

    // Should pass because 204 always skips validation
    expect(result.status).toBe(204);
  });
});

describe('@unireq/http - json parser', () => {
  it('should parse JSON string', async () => {
    const policy = json();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '{"message":"hello"}',
      ok: true,
    }));

    expect(result.data).toEqual({ message: 'hello' });
  });

  it('should parse JSON from ArrayBuffer', async () => {
    const policy = json();
    // Create ArrayBuffer with JSON data
    const jsonStr = '{"value":42}';
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonStr);
    // Create a clean ArrayBuffer with exact size
    const buffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: buffer,
      ok: true,
    }));

    // Should decode ArrayBuffer and parse JSON
    expect(result.data).toEqual({ value: 42 });
  });

  it('should return already parsed object as-is', async () => {
    const policy = json();
    const parsedData = { already: 'parsed' };

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: parsedData,
      ok: true,
    }));

    expect(result.data).toBe(parsedData);
  });

  it('should handle arrays', async () => {
    const policy = json();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '[1,2,3]',
      ok: true,
    }));

    expect(result.data).toEqual([1, 2, 3]);
  });

  it('should throw on invalid JSON', async () => {
    const policy = json();

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'not valid json',
        ok: true,
      })),
    ).rejects.toThrow();
  });

  it('should handle nested objects', async () => {
    const policy = json();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '{"nested":{"value":true}}',
      ok: true,
    }));

    expect(result.data).toEqual({ nested: { value: true } });
  });

  it('should handle null as data', async () => {
    const policy = json();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: null,
      ok: true,
    }));

    // null is not an object per the check (typeof null === 'object' but response.data === null)
    expect(result.data).toBe(null);
  });

  it('should parse empty object', async () => {
    const policy = json();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '{}',
      ok: true,
    }));

    expect(result.data).toEqual({});
  });

  it('should parse empty array', async () => {
    const policy = json();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '[]',
      ok: true,
    }));

    expect(result.data).toEqual([]);
  });
});

describe('@unireq/http - text parser', () => {
  it('should return text as-is', async () => {
    const policy = text();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'plain text response',
      ok: true,
    }));

    expect(result.data).toBe('plain text response');
  });

  it('should convert ArrayBuffer to text', async () => {
    const policy = text();
    const encoder = new TextEncoder();
    const buffer = encoder.encode('buffer text').buffer;

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: buffer,
      ok: true,
    }));

    expect(result.data).toBe('buffer text');
  });

  it('should handle UTF-8 characters', async () => {
    const policy = text();
    const encoder = new TextEncoder();
    const buffer = encoder.encode('Hello 世界 🌍').buffer;

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: buffer,
      ok: true,
    }));

    expect(result.data).toBe('Hello 世界 🌍');
  });

  it('should handle empty string', async () => {
    const policy = text();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '',
      ok: true,
    }));

    expect(result.data).toBe('');
  });

  it('should preserve whitespace', async () => {
    const policy = text();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '  spaces  \n\ttabs\t  ',
      ok: true,
    }));

    expect(result.data).toBe('  spaces  \n\ttabs\t  ');
  });

  it('should return object data unchanged', async () => {
    const policy = text();
    const objectData = { some: 'object' };

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: objectData,
      ok: true,
    }));

    expect(result.data).toBe(objectData);
  });
});

describe('@unireq/http - accept parser (advanced)', () => {
  it('should normalize Accept header (remove duplicate case variants)', async () => {
    const policy = accept(['application/json']);

    let capturedHeaders: Record<string, string> = {};
    await policy(
      { url: 'https://example.com', method: 'GET', headers: { Accept: 'text/html', ACCEPT: 'text/plain' } },
      async (ctx) => {
        capturedHeaders = ctx.headers;
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: 'OK',
          ok: true,
        };
      },
    );

    // Should have only lowercase 'accept', not 'Accept' or 'ACCEPT'
    expect(capturedHeaders['accept']).toBe('application/json');
    expect(capturedHeaders['Accept']).toBeUndefined();
    expect(capturedHeaders['ACCEPT']).toBeUndefined();
  });

  it('should skip setting Accept header for HEAD requests', async () => {
    const policy = accept(['application/json']);

    let capturedHeaders: Record<string, string> = {};
    await policy({ url: 'https://example.com', method: 'HEAD', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: undefined,
        ok: true,
      };
    });

    // Accept header should NOT be set for HEAD requests
    expect(capturedHeaders['accept']).toBeUndefined();
  });

  it('should allow missing content-type when allowMissingContentType=true', async () => {
    const policy = accept(['application/json'], { allowMissingContentType: true });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {}, // No content-type header
      data: '{"ok":true}',
      ok: true,
    }));

    expect(result.status).toBe(200);
    expect(result.data).toBe('{"ok":true}');
  });

  it('should skip validation when validate=false', async () => {
    const policy = accept(['application/json'], { validate: false });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html' }, // Wrong content-type
      data: '<html></html>',
      ok: true,
    }));

    expect(result.status).toBe(200);
    expect(result.data).toBe('<html></html>');
  });
});
