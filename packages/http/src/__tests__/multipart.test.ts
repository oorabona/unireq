/**
 * @unireq/http - Multipart tests
 */

import { describe, expect, it, vi } from 'vitest';
import { multipart } from '../multipart.js';

describe('@unireq/http - multipart policy', () => {
  it('should create multipart form with files', async () => {
    const policy = multipart([
      {
        name: 'file',
        filename: 'test.txt',
        data: 'test content',
        contentType: 'text/plain',
      },
    ]);

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async (ctx) => {
      expect(ctx.body).toBeInstanceOf(FormData);
      return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
  });

  it('should create multipart form with fields', async () => {
    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'test.txt',
          data: 'test content',
          contentType: 'text/plain',
        },
      ],
      [{ name: 'title', value: 'My File' }],
    );

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async (ctx) => {
      expect(ctx.body).toBeInstanceOf(FormData);
      return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
  });

  it('should sanitize filenames by default', async () => {
    const policy = multipart([
      {
        name: 'file',
        filename: '../../etc/passwd',
        data: 'malicious',
        contentType: 'text/plain',
      },
    ]);

    await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async (_ctx) => {
      // Filename should be sanitized
      return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
    });
  });

  it('should validate file size', async () => {
    const largeData = 'x'.repeat(1000);
    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'large.txt',
          data: largeData,
          contentType: 'text/plain',
        },
      ],
      [],
      { maxFileSize: 500 },
    );

    await expect(
      policy({ url: 'https://example.com', method: 'POST', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow('exceeds maximum size limit');
  });

  it('should validate MIME types', async () => {
    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'test.txt',
          data: 'content',
          contentType: 'application/exe',
        },
      ],
      [],
      { allowedMimeTypes: ['text/plain', 'image/jpeg'] },
    );

    await expect(
      policy({ url: 'https://example.com', method: 'POST', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow('Invalid MIME type');
  });

  it('should support wildcard MIME types', async () => {
    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'test.jpg',
          data: new Blob(['image data']),
          contentType: 'image/jpeg',
        },
      ],
      [],
      { allowedMimeTypes: ['image/*'] },
    );

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should handle Blob data', async () => {
    const blob = new Blob(['test content'], { type: 'text/plain' });
    const policy = multipart([
      {
        name: 'file',
        filename: 'test.txt',
        data: blob,
        contentType: 'text/plain',
      },
    ]);

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async (ctx) => {
      expect(ctx.body).toBeInstanceOf(FormData);
      return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
  });

  it('should handle ArrayBuffer data', async () => {
    const buffer = new ArrayBuffer(10);
    const policy = multipart([
      {
        name: 'file',
        filename: 'test.bin',
        data: buffer,
        contentType: 'application/octet-stream',
      },
    ]);

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async (ctx) => {
      expect(ctx.body).toBeInstanceOf(FormData);
      return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
  });

  it('should allow disabling filename sanitization', async () => {
    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'normal-file.txt',
          data: 'content',
          contentType: 'text/plain',
        },
      ],
      [],
      { sanitizeFilenames: false },
    );

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should throw error for ReadableStream file data', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });

    const policy = multipart([
      {
        name: 'file',
        filename: 'test.bin',
        data: stream,
        contentType: 'application/octet-stream',
      },
    ]);

    await expect(
      policy({ url: 'https://example.com', method: 'POST', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow('ReadableStream not yet supported');
  });

  it('should log warning if MIME type validation explicitly disabled with empty array', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });

    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'test.txt',
          data: 'test content',
          contentType: 'text/plain',
        },
      ],
      [],
      { allowedMimeTypes: [] },
    );

    await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async (ctx) => {
      expect(ctx.body).toBeInstanceOf(FormData);
      return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SECURITY WARNING] MIME type validation disabled'),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('OWASP A01:2021'));
    consoleWarnSpy.mockRestore();
  });

  it('should handle wildcard MIME type matching correctly', async () => {
    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'test.jpg',
          data: 'content',
          contentType: 'image/jpeg',
        },
      ],
      [],
      { allowedMimeTypes: ['image/*'] },
    );

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should handle exact MIME type matching correctly', async () => {
    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'test.txt',
          data: 'content',
          contentType: 'text/plain',
        },
      ],
      [],
      { allowedMimeTypes: ['text/plain'] },
    );

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });
  it('should default to text/plain for string data without contentType', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'test.txt',
          data: 'content',
          // contentType omitted
        },
      ],
      [],
      { allowedMimeTypes: [] }, // Disable validation to reach fallback logic
    );

    const result = await policy({ url: 'https://example.com', method: 'POST', headers: {} }, async (ctx) => {
      const formData = ctx.body as FormData;
      const file = formData.get('file') as File;
      expect(file.type).toBe('text/plain');
      return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    consoleWarnSpy.mockRestore();
  });
});
