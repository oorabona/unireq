/**
 * Response parsers namespace
 * Provides composable response parsers with Accept header support
 */

import type { Policy } from '@unireq/core';
import { getHeader, policy, SerializationError, setHeader } from '@unireq/core';
import { parseNDJSON } from './ndjson.js';
import { parseSSE, parseStream } from './stream.js';

/**
 * Response parsers namespace
 * Each parser sets the appropriate Accept header and parses the response
 */
export const parse = {
  /**
   * Parse JSON responses with Accept header
   * @returns Policy that sets Accept: application/json and parses JSON
   *
   * @example
   * ```ts
   * api.get('/users', parse.json())
   * ```
   */
  json: (): Policy =>
    policy(
      async (ctx, next) => {
        // Only set Accept if not already present (case-insensitive check)
        const hasAccept = getHeader(ctx.headers, 'accept');
        const response = await next({
          ...ctx,
          headers: hasAccept ? ctx.headers : setHeader(ctx.headers, 'accept', 'application/json'),
        });

        // Parse JSON from text or buffer
        try {
          if (typeof response.data === 'string') {
            return {
              ...response,
              data: JSON.parse(response.data),
            };
          }

          if (response.data instanceof ArrayBuffer) {
            const text = new TextDecoder().decode(response.data);
            return {
              ...response,
              data: JSON.parse(text),
            };
          }

          if (response.data instanceof Blob) {
            const text = await response.data.text();
            return {
              ...response,
              data: JSON.parse(text),
            };
          }
          /* v8 ignore start - SerializationError wrapping */
        } catch (error) {
          throw new SerializationError(`Failed to parse JSON response: ${(error as Error).message}`, error);
        }
        /* v8 ignore stop */

        // If data is already parsed object, return as-is
        /* v8 ignore next 3 - defensive check, JSON parsing always produces result above */
        if (typeof response.data === 'object' && response.data !== null) {
          return response;
        }

        return response;
      },
      {
        name: 'json',
        kind: 'parser',
        options: { accept: 'application/json' },
      },
    ),

  /**
   * Parse plain text responses with Accept header
   * @returns Policy that sets Accept: text/plain and parses text
   *
   * @example
   * ```ts
   * api.get('/readme.txt', parse.text())
   * ```
   */
  text: (): Policy =>
    policy(
      async (ctx, next) => {
        const hasAccept = getHeader(ctx.headers, 'accept');
        const response = await next({
          ...ctx,
          headers: hasAccept ? ctx.headers : setHeader(ctx.headers, 'accept', 'text/plain'),
        });

        // If data is already text, return as-is
        if (typeof response.data === 'string') {
          return response;
        }

        // Convert buffer to text
        if (response.data instanceof ArrayBuffer) {
          return {
            ...response,
            data: new TextDecoder().decode(response.data),
          };
        }

        // Convert Blob to text
        if (response.data instanceof Blob) {
          return {
            ...response,
            data: await response.data.text(),
          };
        }

        return response;
      },
      {
        name: 'text',
        kind: 'parser',
        options: { accept: 'text/plain' },
      },
    ),

  /**
   * Return raw binary response data
   * @returns Policy that sets Accept: application/octet-stream and returns raw data
   *
   * @example
   * ```ts
   * api.get('/file.bin', parse.binary())
   * ```
   */
  binary: (): Policy =>
    policy(
      async (ctx, next) => {
        const hasAccept = getHeader(ctx.headers, 'accept');
        const response = await next({
          ...ctx,
          headers: hasAccept ? ctx.headers : setHeader(ctx.headers, 'accept', 'application/octet-stream'),
        });

        // If already ArrayBuffer, return as-is
        if (response.data instanceof ArrayBuffer) {
          return response;
        }

        // Convert Blob to ArrayBuffer
        if (response.data instanceof Blob) {
          return {
            ...response,
            data: await response.data.arrayBuffer(),
          };
        }

        // Convert string to ArrayBuffer
        if (typeof response.data === 'string') {
          return {
            ...response,
            data: new TextEncoder().encode(response.data).buffer,
          };
        }

        return response;
      },
      {
        name: 'binary',
        kind: 'parser',
        options: { accept: 'application/octet-stream' },
      },
    ),

  /**
   * Pass through response without parsing
   * @returns Policy that returns raw response data
   *
   * @example
   * ```ts
   * api.get('/unknown', parse.raw())
   * ```
   */
  raw: (): Policy =>
    policy(
      async (ctx, next) => {
        const hasAccept = getHeader(ctx.headers, 'accept');
        return next({
          ...ctx,
          headers: hasAccept ? ctx.headers : setHeader(ctx.headers, 'accept', '*/*'),
        });
      },
      {
        name: 'raw',
        kind: 'parser',
        options: { accept: '*/*' },
      },
    ),

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
  stream: parseStream,

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
  sse: parseSSE,

  /**
   * Parse NDJSON (Newline Delimited JSON) stream
   * Converts NDJSON stream into async iterable of parsed objects
   * Commonly used for AI/LLM streaming APIs
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
   * interface ChatEvent { role: string; content: string; }
   * const response = await api.get('/ai/chat', parse.ndjson<ChatEvent>());
   * for await (const event of response.data) {
   *   console.log(event.data.content); // Typed!
   * }
   *
   * // With error handling for malformed lines
   * const response = await api.get('/events', parse.ndjson({
   *   onError: (line, error) => console.warn('Malformed:', line),
   * }));
   * ```
   */
  ndjson: parseNDJSON,
};
