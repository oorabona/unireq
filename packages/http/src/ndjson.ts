/**
 * NDJSON (Newline Delimited JSON) streaming parser
 * Supports parsing NDJSON streams commonly used in AI/LLM APIs
 */

import type { Policy } from '@unireq/core';
import { getHeader, setHeader } from '@unireq/core';

/**
 * NDJSON parse options
 */
export interface NDJSONParseOptions<T = unknown> {
  /**
   * Expected content type
   * @default 'application/x-ndjson'
   */
  readonly accept?: string;

  /**
   * Error handler for malformed JSON lines
   * @param line - The malformed line
   * @param error - The parse error
   */
  readonly onError?: (line: string, error: Error) => void;

  /**
   * Transform function to apply to each parsed object
   */
  readonly transform?: (data: unknown) => T;

  /**
   * Skip empty lines
   * @default true
   */
  readonly skipEmptyLines?: boolean;
}

/**
 * NDJSON event type
 */
export interface NDJSONEvent<T = unknown> {
  readonly data: T;
  readonly line: number;
}

/**
 * Parse NDJSON stream into async iterable of parsed objects
 *
 * @param options - NDJSON parsing options
 * @returns Policy that returns async iterable of parsed NDJSON objects
 *
 * @example
 * ```ts
 * // Basic usage
 * const response = await api.get('/ai/chat', parse.ndjson());
 * for await (const event of response.data) {
 *   console.log('Data:', event.data);
 * }
 *
 * // With type safety
 * interface ChatEvent {
 *   role: string;
 *   content: string;
 * }
 *
 * const response = await api.get('/ai/chat', parse.ndjson<ChatEvent>());
 * for await (const event of response.data) {
 *   console.log(event.data.content); // Typed!
 * }
 *
 * // With error handling
 * const response = await api.get('/events', parse.ndjson({
 *   onError: (line, error) => console.warn('Malformed line:', line),
 * }));
 * ```
 */
export function parseNDJSON<T = unknown>(options: NDJSONParseOptions<T> = {}): Policy {
  const { accept = 'application/x-ndjson', onError, transform, skipEmptyLines = true } = options;

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
      const emptyGenerator = (async function* (): AsyncGenerator<NDJSONEvent<T>, void, unknown> {
        return;
      })();

      return {
        ...response,
        data: emptyGenerator,
      };
    }

    // Create async iterable that parses NDJSON
    const asyncIterable = parseNDJSONStream<T>(stream, { onError, transform, skipEmptyLines });

    return {
      ...response,
      data: asyncIterable,
    };
  };
}

/**
 * Parse NDJSON stream into async iterable
 * @internal
 */
async function* parseNDJSONStream<T>(
  stream: ReadableStream<Uint8Array>,
  options: Pick<NDJSONParseOptions<T>, 'onError' | 'transform' | 'skipEmptyLines'>,
): AsyncIterable<NDJSONEvent<T>> {
  const { onError, transform, skipEmptyLines } = options;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lineNumber = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process remaining buffer
        if (buffer.trim()) {
          lineNumber++;
          const result = parseLine<T>(buffer, lineNumber, onError, transform);
          /* v8 ignore next 3 -- @preserve defensive: result is null only on parse error */
          if (result) {
            yield result;
          }
        }
        break;
      }

      // Decode and append to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        lineNumber++;

        // Skip empty lines if configured
        if (skipEmptyLines && !line.trim()) {
          continue;
        }

        const result = parseLine<T>(line, lineNumber, onError, transform);
        if (result) {
          yield result;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a single NDJSON line
 * @internal
 */
function parseLine<T>(
  line: string,
  lineNumber: number,
  onError?: (line: string, error: Error) => void,
  transform?: (data: unknown) => T,
): NDJSONEvent<T> | null {
  const trimmed = line.trim();
  /* v8 ignore next 3 -- @preserve empty lines are handled but v8 reports as uncovered */
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    const data = transform ? transform(parsed) : (parsed as T);
    return { data, line: lineNumber };
  } catch (error) {
    /* v8 ignore next 3 -- @preserve defensive: JSON.parse errors are always Error instances */
    if (onError && error instanceof Error) {
      onError(line, error);
    }
    return null;
  }
}

/**
 * Streaming namespace extension for NDJSON
 */
export const ndjsonParser = {
  ndjson: parseNDJSON,
};
