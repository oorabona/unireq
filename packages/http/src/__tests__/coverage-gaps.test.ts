import { describe, expect, it, vi } from 'vitest';
import { body } from '../body.js';
import { conditional, etag, lastModified } from '../conditional.js';
import { multipart } from '../multipart.js';
import { parse } from '../parse.js';
import { accept } from '../parsers.js';
import { parseSSE } from '../stream.js';

describe('body.multipart() — behavioral', () => {
  it('produces a FormData with correct file entry for a binary part', () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    const descriptor = body.multipart({
      name: 'file',
      filename: 'test.bin',
      part: body.binary(new Blob([buffer], { type: 'application/octet-stream' }), 'application/octet-stream'),
    });

    const formData = descriptor.serialize() as FormData;
    expect(formData.has('file')).toBe(true);
    const file = formData.get('file') as File;
    expect(file.size).toBe(3);
    expect(file.name).toBe('test.bin');
  });

  it('produces a FormData with correct file entry for an ArrayBuffer part', () => {
    const buffer = new Uint8Array([10, 20, 30]).buffer;
    const customPart = {
      __brand: 'BodyDescriptor' as const,
      data: buffer,
      contentType: 'application/octet-stream',
      serialize: () => buffer,
    };

    const descriptor = body.multipart({
      name: 'upload',
      filename: 'data.bin',
      part: customPart as any,
    });

    const formData = descriptor.serialize() as FormData;
    expect(formData.has('upload')).toBe(true);
    const file = formData.get('upload') as File;
    expect(file.size).toBe(3);
  });

  it('throws when a part MIME type is not in the allowedMimeTypes list', () => {
    const descriptor = body.multipart(
      { name: 'file', filename: 'script.js', part: body.text('alert(1)') },
      { allowedMimeTypes: ['image/png', 'application/pdf'] },
    );
    // text/plain is not in the allowed list — should be rejected at serialize time
    expect(() => descriptor.serialize()).toThrow(/Invalid MIME type/);
  });

  it('accepts a part whose MIME type matches a wildcard entry', () => {
    const descriptor = body.multipart(
      { name: 'photo', filename: 'shot.png', part: body.binary(new Blob([], { type: 'image/png' }), 'image/png') },
      { allowedMimeTypes: ['image/*'] },
    );
    expect(() => descriptor.serialize()).not.toThrow();
  });

  it('emits a security warning when allowedMimeTypes is explicitly set to []', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    body.multipart(
      { name: 'file', filename: 'any.txt', part: body.text('content') },
      { allowedMimeTypes: [] },
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SECURITY WARNING'));
    warnSpy.mockRestore();
  });
});

describe('multipart policy — behavioral', () => {
  it('passes FormData body to next() when validation passes', async () => {
    const policy = multipart(
      [{ name: 'doc', filename: 'file.pdf', data: 'PDF content', contentType: 'application/pdf' }],
      [],
      { allowedMimeTypes: ['application/pdf'] },
    );

    let capturedBody: unknown;
    const next = vi.fn().mockImplementation(async (ctx: any) => {
      capturedBody = ctx.body;
      return { ok: true, status: 200, headers: {}, data: null };
    });

    await policy({ method: 'POST', url: 'https://api.example.com/upload', headers: {} } as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(capturedBody).toBeInstanceOf(FormData);
    expect((capturedBody as FormData).has('doc')).toBe(true);
  });

  it('throws before calling next() when a file MIME type is disallowed', async () => {
    const policy = multipart(
      [{ name: 'file', filename: 'hack.exe', data: 'payload', contentType: 'application/x-msdownload' }],
      [],
      { allowedMimeTypes: ['image/*', 'application/pdf'] },
    );
    const next = vi.fn();

    await expect(
      policy({ method: 'POST', url: 'https://api.example.com/upload', headers: {} } as any, next),
    ).rejects.toThrow(/Invalid MIME type/);
    expect(next).not.toHaveBeenCalled();
  });

  it('includes form fields alongside files in the FormData', async () => {
    const policy = multipart(
      [{ name: 'file', filename: 'doc.txt', data: 'hello', contentType: 'text/plain' }],
      [{ name: 'title', value: 'My Document' }],
      { allowedMimeTypes: ['text/plain'] },
    );

    let capturedBody: FormData | undefined;
    const next = vi.fn().mockImplementation(async (ctx: any) => {
      capturedBody = ctx.body as FormData;
      return { ok: true, status: 200, headers: {}, data: null };
    });

    await policy({ method: 'POST', url: 'https://api.example.com/upload', headers: {} } as any, next);

    expect(capturedBody?.get('title')).toBe('My Document');
    expect(capturedBody?.has('file')).toBe(true);
  });

  it('matches wildcard MIME type in allowedMimeTypes', async () => {
    const policy = multipart(
      [{ name: 'image', filename: 'photo.jpeg', data: 'imgdata', contentType: 'image/jpeg' }],
      [],
      { allowedMimeTypes: ['image/*'] },
    );
    const next = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: {}, data: null });

    await expect(
      policy({ method: 'POST', url: 'https://api.example.com/upload', headers: {} } as any, next),
    ).resolves.toBeDefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects when wildcard prefix does not match the actual MIME type', async () => {
    const policy = multipart(
      [{ name: 'doc', filename: 'report.pdf', data: 'pdfdata', contentType: 'application/pdf' }],
      [],
      { allowedMimeTypes: ['image/*'] },
    );
    const next = vi.fn();

    await expect(
      policy({ method: 'POST', url: 'https://api.example.com/upload', headers: {} } as any, next),
    ).rejects.toThrow(/Invalid MIME type/);
  });

  it('defaults string data with no contentType to text/plain in the FormData', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const policy = multipart(
      [{ name: 'note', filename: 'note.txt', data: 'hello world', contentType: undefined }],
      [],
      { allowedMimeTypes: [] }, // disable MIME check so undefined passes validation
    );

    let capturedFormData: FormData | undefined;
    const next = vi.fn().mockImplementation(async (ctx: any) => {
      capturedFormData = ctx.body as FormData;
      return { ok: true, status: 200, headers: {}, data: null };
    });

    await policy({ method: 'POST', url: 'https://api.example.com/upload', headers: {} } as any, next);

    const file = capturedFormData?.get('note') as File;
    expect(file.type).toBe('text/plain');

    warnSpy.mockRestore();
  });
});

describe('conditional request policies — behavioral', () => {
  describe('lastModified()', () => {
    it('does not populate the cache when the response has no Last-Modified header', async () => {
      const cache = new Map();
      const policy = lastModified({ cache });

      const next = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: {}, data: 'payload' });
      await policy({ method: 'GET', url: 'https://api.example.com/data', headers: {} } as any, next);

      expect(cache.size).toBe(0);
    });

    it('populates the cache on first response with a Last-Modified header', async () => {
      const cache = new Map();
      const policy = lastModified({ cache });

      const next = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        data: 'payload',
      });

      await policy({ method: 'GET', url: 'https://api.example.com/data', headers: {} } as any, next);

      expect(cache.size).toBe(1);
    });

    it('serves a cache HIT on second request within TTL', async () => {
      const cache = new Map();
      const policy = lastModified({ cache, ttl: 60_000 });

      const next = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
          data: 'original data',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 304,
          headers: {},
          data: null,
        });

      // Populate cache
      await policy({ method: 'GET', url: 'https://api.example.com/data', headers: {} } as any, next);
      // Second request — should return cached data without calling next
      const response = await policy(
        { method: 'GET', url: 'https://api.example.com/data', headers: {} } as any,
        next,
      );

      expect(response.headers['x-cache']).toBe('HIT');
      expect(response.data).toBe('original data');
    });

    it('does not apply to non-GET/HEAD methods', async () => {
      const cache = new Map();
      const policy = lastModified({ cache });
      const next = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: {}, data: null });

      await policy({ method: 'POST', url: 'https://api.example.com/data', headers: {} } as any, next);

      // Cache should be empty — POST bypasses conditional logic
      expect(cache.size).toBe(0);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe('etag()', () => {
    it('populates the cache on first response with an ETag header', async () => {
      const cache = new Map();
      const policy = etag({ cache });

      const next = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { etag: '"abc123"' },
        data: 'payload',
      });

      await policy({ method: 'GET', url: 'https://api.example.com/items', headers: {} } as any, next);

      expect(cache.size).toBe(1);
    });

    it('sends If-None-Match on second request when ETag is cached and TTL expired', async () => {
      const cache = new Map();
      const policy = etag({ cache, ttl: 0 }); // TTL=0 forces revalidation

      const next = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { etag: '"abc123"' },
          data: 'payload',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 304,
          headers: { etag: '"abc123"' },
          data: null,
        });

      await policy({ method: 'GET', url: 'https://api.example.com/items', headers: {} } as any, next);
      await policy({ method: 'GET', url: 'https://api.example.com/items', headers: {} } as any, next);

      const secondCallCtx = next.mock.calls[1][0] as any;
      expect(secondCallCtx.headers['if-none-match']).toBe('"abc123"');
    });
  });

  describe('conditional()', () => {
    it('caches via Last-Modified when ETag is absent', async () => {
      const policy = conditional();
      const next = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        data: 'data',
      });

      await policy({ method: 'GET', url: 'https://api.example.com/res', headers: {} } as any, next);
      const response = await policy(
        { method: 'GET', url: 'https://api.example.com/res', headers: {} } as any,
        next,
      );

      expect(response.headers['x-cache']).toBe('HIT');
    });

    it('does not cache when both ETag and Last-Modified are absent', async () => {
      const policy = conditional();
      const next = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: {}, data: 'data' });

      await policy({ method: 'GET', url: 'https://api.example.com/none', headers: {} } as any, next);
      await policy({ method: 'GET', url: 'https://api.example.com/none', headers: {} } as any, next);

      // next() called twice — no cache serving
      expect(next).toHaveBeenCalledTimes(2);
    });

    it('does not cache when the response is not ok', async () => {
      const policy = conditional();
      const next = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        data: 'Server Error',
      });

      await policy({ method: 'GET', url: 'https://api.example.com/err', headers: {} } as any, next);
      await policy({ method: 'GET', url: 'https://api.example.com/err', headers: {} } as any, next);

      // next() called twice — error responses are never cached
      expect(next).toHaveBeenCalledTimes(2);
    });
  });
});

describe('JSON parse policy — behavioral', () => {
  it('throws SerializationError when the response body is invalid JSON', async () => {
    const policy = parse.json();
    const next = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: '{ not valid json }',
    });

    await expect(policy({ method: 'GET', headers: {} } as any, next)).rejects.toThrow(
      /Failed to parse JSON response/,
    );
  });

  it('parses a valid JSON string body into an object', async () => {
    const policy = parse.json();
    const next = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: '{"id":1,"name":"Alice"}',
    });

    const response = await policy({ method: 'GET', headers: {} } as any, next);
    expect(response.data).toEqual({ id: 1, name: 'Alice' });
  });
});

describe('accept() content negotiation policy — behavioral', () => {
  it('throws NotAcceptableError when response has no content-type on 200 OK', async () => {
    const policy = accept(['application/json']);
    const next = vi.fn().mockResolvedValue({ status: 200, headers: {}, data: '{}' });

    await expect(policy({ method: 'GET', headers: {} } as any, next)).rejects.toThrow();
  });

  it('does not throw for non-2xx responses without content-type', async () => {
    const policy = accept(['application/json']);
    const next = vi.fn().mockResolvedValue({ status: 404, headers: {}, data: 'Not Found' });

    await expect(policy({ method: 'GET', headers: {} } as any, next)).resolves.toBeDefined();
  });

  it('does not throw when response content-type matches the accepted list', async () => {
    const policy = accept(['application/json']);
    const next = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      data: '{}',
    });

    await expect(policy({ method: 'GET', headers: {} } as any, next)).resolves.toBeDefined();
  });

  it('sets the Accept request header to the joined media types', async () => {
    const policy = accept(['application/json', 'text/plain']);
    let capturedHeaders: Record<string, string> | undefined;
    const next = vi.fn().mockImplementation(async (ctx: any) => {
      capturedHeaders = ctx.headers;
      return { status: 200, headers: { 'content-type': 'application/json' }, data: '{}' };
    });

    await policy({ method: 'GET', headers: {} } as any, next);
    expect(capturedHeaders?.['accept']).toBe('application/json, text/plain');
  });
});

describe('parseSSE() — behavioral', () => {
  it('parses SSE data field from a stream', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: hello\n\n'));
        controller.close();
      },
    });
    const policy = parseSSE();
    const next = vi.fn().mockResolvedValue({ data: stream, headers: {} });

    const response = await policy({ headers: {} } as any, next);
    const events: any[] = [];
    for await (const event of response.data as AsyncIterable<any>) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('hello');
  });

  it('parses numeric retry field and attaches it to the event', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('retry: 2500\ndata: ping\n\n'));
        controller.close();
      },
    });
    const policy = parseSSE();
    const next = vi.fn().mockResolvedValue({ data: stream, headers: {} });

    const response = await policy({ headers: {} } as any, next);
    const events: any[] = [];
    for await (const event of response.data as AsyncIterable<any>) {
      events.push(event);
    }

    expect(events[0].retry).toBe(2500);
    expect(events[0].data).toBe('ping');
  });

  it('ignores a non-numeric retry field', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('retry: notanumber\ndata: msg\n\n'));
        controller.close();
      },
    });
    const policy = parseSSE();
    const next = vi.fn().mockResolvedValue({ data: stream, headers: {} });

    const response = await policy({ headers: {} } as any, next);
    const events: any[] = [];
    for await (const event of response.data as AsyncIterable<any>) {
      events.push(event);
    }

    expect(events[0].retry).toBeUndefined();
    expect(events[0].data).toBe('msg');
  });

  it('skips empty events (double newline without data)', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('\n\ndata: actual\n\n'));
        controller.close();
      },
    });
    const policy = parseSSE();
    const next = vi.fn().mockResolvedValue({ data: stream, headers: {} });

    const response = await policy({ headers: {} } as any, next);
    const events: any[] = [];
    for await (const event of response.data as AsyncIterable<any>) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('actual');
  });

  it('returns an empty async iterable when response data is not a stream', async () => {
    const policy = parseSSE();
    const next = vi.fn().mockResolvedValue({ data: null, headers: {} });

    const response = await policy({ headers: {} } as any, next);
    const events: any[] = [];
    for await (const event of response.data as AsyncIterable<any>) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
  });

  it('adds Accept: text/event-stream header when not already present', async () => {
    const policy = parseSSE();
    let capturedHeaders: Record<string, string> | undefined;
    const next = vi.fn().mockImplementation(async (ctx: any) => {
      capturedHeaders = ctx.headers;
      return { data: null, headers: {} };
    });

    await policy({ headers: {} } as any, next);
    expect(capturedHeaders?.['accept']).toBe('text/event-stream');
  });

  it('preserves an existing Accept header set by the caller', async () => {
    const policy = parseSSE();
    let capturedHeaders: Record<string, string> | undefined;
    const next = vi.fn().mockImplementation(async (ctx: any) => {
      capturedHeaders = ctx.headers;
      return { data: null, headers: {} };
    });

    await policy({ headers: { accept: 'application/json' } } as any, next);
    expect(capturedHeaders?.['accept']).toBe('application/json');
  });
});