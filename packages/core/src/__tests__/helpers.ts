/**
 * Test helpers library for @unireq
 * Provides reusable mocks, factories, and utilities for testing
 */

import type { Logger, Policy, RequestContext, Response } from '../types.js';

/**
 * Creates a mock RequestContext with sensible defaults
 * @param overrides - Partial context to override defaults
 */
export function createMockContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    url: 'https://example.com/api/test',
    method: 'GET',
    headers: {},
    ...overrides,
  };
}

/**
 * Creates a mock Response with sensible defaults
 * @param overrides - Partial response to override defaults
 */
export function createMockResponse<T = unknown>(overrides: Partial<Response<T>> = {}): Response<T> {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    data: null as T,
    ok: true,
    ...overrides,
  };
}

/**
 * Creates a mock transport function
 * @param response - Response to return, or function to generate response
 */
export function createMockTransport(
  response: Response | ((ctx: RequestContext) => Response | Promise<Response>),
): (ctx: RequestContext) => Promise<Response> {
  return async (ctx: RequestContext) => {
    if (typeof response === 'function') {
      return response(ctx);
    }
    return response;
  };
}

/**
 * Creates a transport that fails N times before succeeding
 * @param failures - Number of times to fail
 * @param error - Error to throw (or function to generate error)
 * @param successResponse - Response to return after failures
 */
export function createFlakyTransport(
  failures: number,
  error: Error | (() => Error) = new Error('Transient failure'),
  successResponse: Response = createMockResponse(),
): { transport: (ctx: RequestContext) => Promise<Response>; getAttempts: () => number } {
  let attempts = 0;

  const transport = async (_ctx: RequestContext): Promise<Response> => {
    attempts++;
    if (attempts <= failures) {
      throw typeof error === 'function' ? error() : error;
    }
    return successResponse;
  };

  return {
    transport,
    getAttempts: () => attempts,
  };
}

/**
 * Creates a transport that returns different responses based on attempt
 * @param responses - Array of responses/errors in order
 */
export function createSequentialTransport(responses: Array<Response | Error>): {
  transport: (ctx: RequestContext) => Promise<Response>;
  getAttempts: () => number;
} {
  let attempts = 0;

  const transport = async (_ctx: RequestContext): Promise<Response> => {
    const response = responses[attempts] ?? responses[responses.length - 1];
    attempts++;

    if (response instanceof Error) {
      throw response;
    }
    return response as Response;
  };

  return {
    transport,
    getAttempts: () => attempts,
  };
}

/**
 * Creates a slow transport that delays for specified time
 * @param delayMs - Delay in milliseconds
 * @param response - Response to return after delay
 */
export function createSlowTransport(
  delayMs: number,
  response: Response = createMockResponse(),
): (ctx: RequestContext) => Promise<Response> {
  return async (_ctx: RequestContext) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return response;
  };
}

/**
 * Creates a transport that respects AbortSignal
 * @param delayMs - Delay before returning response
 * @param response - Response to return if not aborted
 */
export function createAbortableTransport(
  delayMs: number,
  response: Response = createMockResponse(),
): (ctx: RequestContext) => Promise<Response> {
  return async (ctx: RequestContext) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => resolve(response), delayMs);

      if (ctx.signal) {
        if (ctx.signal.aborted) {
          clearTimeout(timeoutId);
          reject(new DOMException('Request aborted', 'AbortError'));
          return;
        }

        ctx.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new DOMException('Request aborted', 'AbortError'));
        });
      }
    });
  };
}

/**
 * Creates a mock Logger that captures all log calls
 */
export function createMockLogger(): Logger & {
  calls: Array<{ level: string; message: string; meta?: Record<string, unknown> }>;
  clear: () => void;
} {
  const calls: Array<{ level: string; message: string; meta?: Record<string, unknown> }> = [];

  return {
    calls,
    clear: () => {
      calls.length = 0;
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      calls.push({ level: 'debug', message, meta });
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      calls.push({ level: 'info', message, meta });
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      calls.push({ level: 'warn', message, meta });
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      calls.push({ level: 'error', message, meta });
    },
  };
}

/**
 * Creates a ReadableStream from chunks with optional delay
 * @param chunks - Array of Uint8Array chunks
 * @param delayMs - Optional delay between chunks
 */
export function createMockStream(chunks: Uint8Array[], delayMs = 0): ReadableStream<Uint8Array> {
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      controller.enqueue(chunks[index]);
      index++;
    },
  });
}

/**
 * Creates a ReadableStream that errors after N chunks
 * @param chunks - Chunks to emit before error
 * @param error - Error to throw
 */
export function createErrorStream(
  chunks: Uint8Array[],
  error: Error = new Error('Stream error'),
): ReadableStream<Uint8Array> {
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.error(error);
        return;
      }

      controller.enqueue(chunks[index]);
      index++;
    },
  });
}

/**
 * Collects all chunks from a ReadableStream
 * @param stream - Stream to collect
 */
export async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return chunks;
}

/**
 * Creates a policy that tracks execution order
 * @param name - Name of the policy for tracking
 * @param tracker - Array to push execution events to
 */
export function createTrackingPolicy(name: string, tracker: string[]): Policy {
  return async (ctx, next) => {
    tracker.push(`${name}-before`);
    const response = await next(ctx);
    tracker.push(`${name}-after`);
    return response;
  };
}

/**
 * Waits for a condition to be true with timeout
 * @param condition - Function that returns true when condition is met
 * @param timeoutMs - Maximum time to wait
 * @param intervalMs - Polling interval
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 10,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`waitFor timeout after ${timeoutMs}ms`);
}

/**
 * Creates an SSE stream from events
 * @param events - Array of SSE events to emit
 */
export function createSSEStream(
  events: Array<{ event?: string; data: string; id?: string }>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= events.length) {
        controller.close();
        return;
      }

      const event = events[index];
      if (!event) {
        return;
      }
      let sseText = '';

      if (event.id) sseText += `id: ${event.id}\n`;
      if (event.event) sseText += `event: ${event.event}\n`;
      sseText += `data: ${event.data}\n\n`;

      controller.enqueue(encoder.encode(sseText));
      index++;
    },
  });
}
