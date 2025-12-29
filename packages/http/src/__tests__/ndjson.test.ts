import type { RequestContext, Response } from '@unireq/core';
import { describe, expect, it, vi } from 'vitest';
import { parseNDJSON } from '../ndjson.js';

describe('parseNDJSON', () => {
  const createMockNext = (response: Partial<Response>) => {
    return vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/x-ndjson' },
      ok: true,
      ...response,
    });
  };

  const createMockContext = (): RequestContext => ({
    url: 'https://api.example.com/events',
    method: 'GET',
    headers: {},
  });

  it('parses NDJSON string response', async () => {
    const ndjsonData = '{"id":1,"name":"Alice"}\n{"id":2,"name":"Bob"}\n{"id":3,"name":"Charlie"}';
    const policy = parseNDJSON();
    const next = createMockNext({ data: ndjsonData });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: unknown; line: number }>) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ data: { id: 1, name: 'Alice' }, line: 1 });
    expect(events[1]).toEqual({ data: { id: 2, name: 'Bob' }, line: 2 });
    expect(events[2]).toEqual({ data: { id: 3, name: 'Charlie' }, line: 3 });
  });

  it('parses NDJSON stream response', async () => {
    // Simulate streaming where JSON is split across chunks
    // Split {"id":2} in the middle: {"id": | 2}
    const encoder = new TextEncoder();
    const chunks = [encoder.encode('{"id":1}\n{"id":'), encoder.encode('2}\n{"id":3}\n')];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const policy = parseNDJSON();
    const next = createMockNext({ data: stream });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: unknown; line: number }>) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]?.data).toEqual({ id: 1 });
    expect(events[1]?.data).toEqual({ id: 2 });
    expect(events[2]?.data).toEqual({ id: 3 });
  });

  it('skips empty lines by default', async () => {
    const ndjsonData = '{"id":1}\n\n{"id":2}\n\n\n{"id":3}';
    const policy = parseNDJSON();
    const next = createMockNext({ data: ndjsonData });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: unknown; line: number }>) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
  });

  it('handles malformed JSON with error callback', async () => {
    const ndjsonData = '{"id":1}\ninvalid json\n{"id":2}';
    const onError = vi.fn();
    const policy = parseNDJSON({ onError });
    const next = createMockNext({ data: ndjsonData });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: unknown; line: number }>) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('invalid json', expect.any(Error));
  });

  it('applies transform function', async () => {
    interface User {
      id: number;
      name: string;
    }

    const ndjsonData = '{"id":1,"name":"Alice"}\n{"id":2,"name":"Bob"}';
    const transform = (data: unknown) => {
      const user = data as User;
      return { ...user, name: user.name.toUpperCase() };
    };
    const policy = parseNDJSON<User>({ transform });
    const next = createMockNext({ data: ndjsonData });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: User; line: number }>) {
      events.push(event);
    }

    expect(events[0]?.data.name).toBe('ALICE');
    expect(events[1]?.data.name).toBe('BOB');
  });

  it('sets accept header if not present', async () => {
    const policy = parseNDJSON();
    const next = createMockNext({ data: '{}' });

    await policy(createMockContext(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: 'application/x-ndjson',
        }),
      }),
    );
  });

  it('preserves existing accept header', async () => {
    const policy = parseNDJSON();
    const ctx: RequestContext = {
      url: 'https://api.example.com/events',
      method: 'GET',
      headers: { accept: 'application/json' },
    };
    const next = createMockNext({ data: '{}' });

    await policy(ctx, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { accept: 'application/json' },
      }),
    );
  });

  it('handles Blob response', async () => {
    const ndjsonData = '{"id":1}\n{"id":2}';
    const blob = new Blob([ndjsonData], { type: 'application/x-ndjson' });
    const policy = parseNDJSON();
    const next = createMockNext({ data: blob });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: unknown; line: number }>) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
  });

  it('handles ArrayBuffer response', async () => {
    const ndjsonData = '{"id":1}\n{"id":2}';
    const buffer = new TextEncoder().encode(ndjsonData).buffer;
    const policy = parseNDJSON();
    const next = createMockNext({ data: buffer });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: unknown; line: number }>) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
  });

  it('returns empty generator for non-stream data', async () => {
    const policy = parseNDJSON();
    const next = createMockNext({ data: null });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: unknown; line: number }>) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
  });

  it('handles trailing newline', async () => {
    const ndjsonData = '{"id":1}\n{"id":2}\n';
    const policy = parseNDJSON();
    const next = createMockNext({ data: ndjsonData });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: unknown; line: number }>) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
  });

  it('handles incomplete trailing line', async () => {
    const ndjsonData = '{"id":1}\n{"id":2}'; // No trailing newline
    const policy = parseNDJSON();
    const next = createMockNext({ data: ndjsonData });

    const response = await policy(createMockContext(), next);

    const events = [];
    for await (const event of response.data as AsyncIterable<{ data: unknown; line: number }>) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[1]?.data).toEqual({ id: 2 });
  });
});
