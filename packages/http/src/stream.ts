/**
 * Streaming support for request/response bodies
 * Implements ReadableStream support for efficient large data handling
 */

import type { BodyDescriptor, Policy } from '@unireq/core';
import { getHeader, setHeader } from '@unireq/core';

/**
 * Stream event for Server-Sent Events (SSE)
 */
export interface SSEEvent {
  readonly id?: string;
  readonly event?: string;
  readonly data: string;
  readonly retry?: number;
}

/**
 * Stream options for body.stream()
 */
export interface StreamBodyOptions {
  /** Content-Type header (default: application/octet-stream) */
  readonly contentType?: string;
  /** Content-Length if known (enables progress tracking) */
  readonly contentLength?: number;
}

/**
 * Stream parser options for parse.stream()
 */
export interface StreamParseOptions {
  /** Expected content type */
  readonly accept?: string;
  /** High water mark for buffering (bytes) */
  readonly highWaterMark?: number;
}

/**
 * SSE parser options
 */
export interface SSEParseOptions extends StreamParseOptions {
  /** Reconnection time in milliseconds */
  readonly reconnectionTime?: number;
}

/**
 * Create a streaming request body descriptor
 * Supports ReadableStream for efficient large file uploads
 *
 * @param stream - ReadableStream containing the data
 * @param options - Stream configuration options
 * @returns BodyDescriptor for streaming content
 *
 * @example
 * ```ts
 * const fileStream = file.stream();
 * api.post('/upload', body.stream(fileStream, { contentType: 'video/mp4', contentLength: file.size }))
 * ```
 */
export function stream(stream: ReadableStream<Uint8Array>, options: StreamBodyOptions = {}): BodyDescriptor {
  const { contentType = 'application/octet-stream', contentLength } = options;

  return {
    __brand: 'BodyDescriptor',
    data: stream,
    contentType,
    serialize: () => stream as ReadableStream<Uint8Array>,
    ...(contentLength !== undefined && { contentLength }),
  };
}

/**
 * Parse streaming response as ReadableStream
 * Returns response.data as ReadableStream<Uint8Array> for manual consumption
 *
 * @param options - Stream parsing options
 * @returns Policy that returns streaming response
 *
 * @example
 * ```ts
 * const response = await api.get('/large-file', parse.stream());
 * const reader = response.data.getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   console.log('Received chunk:', value.length, 'bytes');
 * }
 * ```
 */
export function parseStream(options: StreamParseOptions = {}): Policy {
  const { accept = 'application/octet-stream', highWaterMark } = options;

  return async (ctx, next) => {
    const hasAccept = getHeader(ctx.headers, 'accept');
    const response = await next({
      ...ctx,
      headers: hasAccept ? ctx.headers : setHeader(ctx.headers, 'accept', accept),
      /* v8 ignore next - highWaterMark conditional spread */
      ...(highWaterMark !== undefined && { streamHighWaterMark: highWaterMark }),
    });

    // If response.data is already a ReadableStream, return as-is
    if (response.data && typeof response.data === 'object' && 'getReader' in response.data) {
      return response;
    }

    // If Blob, convert to stream
    if (response.data instanceof Blob) {
      return {
        ...response,
        data: response.data.stream(),
      };
    }

    // If ArrayBuffer, create stream
    if (response.data instanceof ArrayBuffer) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(response.data as ArrayBuffer));
          controller.close();
        },
      });
      return {
        ...response,
        data: stream,
      };
    }

    // If string, encode and create stream
    if (typeof response.data === 'string') {
      const encoded = new TextEncoder().encode(response.data);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoded);
          controller.close();
        },
      });
      return {
        ...response,
        data: stream,
      };
    }

    return response;
  };
}

/**
 * Parse Server-Sent Events (SSE) stream
 * Converts SSE stream into async iterable of parsed events
 *
 * @param options - SSE parsing options
 * @returns Policy that returns async iterable of SSE events
 *
 * @example
 * ```ts
 * const response = await api.get('/events', parse.sse());
 * for await (const event of response.data) {
 *   console.log('Event:', event.event, 'Data:', event.data);
 * }
 * ```
 */
export function parseSSE(options: SSEParseOptions = {}): Policy {
  const { accept = 'text/event-stream', reconnectionTime = 3000 } = options;

  return async (ctx, next) => {
    const hasAccept = getHeader(ctx.headers, 'accept');
    const response = await next({
      ...ctx,
      headers: hasAccept ? ctx.headers : setHeader(ctx.headers, 'accept', accept),
    });

    // Get readable stream from response
    let stream: ReadableStream<Uint8Array>;

    if (response.data && typeof response.data === 'object' && 'getReader' in response.data) {
      stream = response.data as ReadableStream<Uint8Array>;
    } else if (response.data instanceof Blob) {
      stream = response.data.stream();
    } else if (response.data instanceof ArrayBuffer) {
      stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(response.data as ArrayBuffer));
          controller.close();
        },
      });
    } else if (typeof response.data === 'string') {
      const encoded = new TextEncoder().encode(response.data);
      stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoded);
          controller.close();
        },
      });
    } else {
      // No stream available, return empty async iterable
      // biome-ignore lint/correctness/useYield: Empty generator intentionally has no yield
      const emptyGenerator = (async function* (): AsyncGenerator<SSEEvent, void, unknown> {
        // Empty generator for no-stream case - immediately returns without yielding
        return;
      })();

      return {
        ...response,
        data: emptyGenerator,
      };
    }

    // Create async iterable that parses SSE events
    const asyncIterable = parseSSEStream(stream, reconnectionTime);

    return {
      ...response,
      data: asyncIterable,
    };
  };
}

/**
 * Parse SSE stream into async iterable of events
 * @internal
 */
async function* parseSSEStream(stream: ReadableStream<Uint8Array>, _reconnectionTime: number): AsyncIterable<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent: Partial<SSEEvent> = {};

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Yield final event if any
        if (currentEvent.data !== undefined) {
          yield currentEvent as SSEEvent;
        }
        break;
      }

      // Decode and append to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        // Empty line = end of event
        if (line.trim() === '') {
          if (currentEvent.data !== undefined) {
            yield currentEvent as SSEEvent;
            currentEvent = {};
          }
          continue;
        }

        // Comment line (ignore)
        if (line.startsWith(':')) {
          continue;
        }

        // Parse field
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
          continue;
        }

        const field = line.slice(0, colonIndex);
        const value = line.slice(colonIndex + 1).trimStart();

        switch (field) {
          case 'id':
            currentEvent = { ...currentEvent, id: value };
            break;
          case 'event':
            currentEvent = { ...currentEvent, event: value };
            break;
          case 'data':
            // Concatenate multiple data fields with newline
            currentEvent = {
              ...currentEvent,
              data: currentEvent.data ? `${currentEvent.data}\n${value}` : value,
            };
            break;
          case 'retry': {
            const retry = Number.parseInt(value, 10);
            if (!Number.isNaN(retry)) {
              currentEvent = { ...currentEvent, retry };
            }
            break;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Body and parse streaming namespace extensions
 */
export const bodyStream = {
  stream,
};

export const parseStreamers = {
  stream: parseStream,
  sse: parseSSE,
};
