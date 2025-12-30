/**
 * Undici connector for HTTP transport using Node.js built-in fetch
 */

import type { Connector, RequestContext, Response } from '@unireq/core';
import { NetworkError, SerializationError, TimeoutError } from '@unireq/core';

export interface UndiciConnectorOptions {
  readonly keepAlive?: boolean;
  readonly timeout?: number;
}

/**
 * Symbol key for body timeout configuration
 * Used by timeout policy to pass body-specific timeout to the connector
 */
export const BODY_TIMEOUT_KEY = Symbol.for('unireq:bodyTimeout');

export class UndiciConnector implements Connector {
  // biome-ignore lint/complexity/noUselessConstructor: Options reserved for future use
  // biome-ignore lint/suspicious/noEmptyBlockStatements: empty constructor intentional for future options
  constructor(_options: UndiciConnectorOptions = {}) {}

  /* v8 ignore next 3 - connect used by transport layer */
  connect(uri: string) {
    return { baseUrl: uri };
  }

  async request(_client: unknown, ctx: RequestContext): Promise<Response> {
    const { url, method, headers, body, signal } = ctx;

    // Extract body timeout if specified by timeout policy
    const bodyTimeoutMs = (ctx as unknown as Record<symbol, unknown>)[BODY_TIMEOUT_KEY] as number | undefined;

    // For FormData, remove Content-Type header so fetch can set it with boundary
    let requestHeaders = headers;
    if (body instanceof FormData) {
      const { 'content-type': _ct, 'Content-Type': _CT, ...rest } = headers;
      requestHeaders = rest;
    }

    const init: RequestInit = {
      method,
      headers: requestHeaders,
      signal,
    };

    if (body !== undefined) {
      if (body instanceof FormData || body instanceof ReadableStream || body instanceof Blob) {
        init.body = body as BodyInit;
      } else if (typeof body === 'string') {
        init.body = body;
      } else {
        init.body = JSON.stringify(body);
        if (!requestHeaders['content-type'] && !requestHeaders['Content-Type']) {
          (init.headers as Record<string, string>)['content-type'] = 'application/json';
        }
      }
    }

    let response: globalThis.Response;

    try {
      response = await fetch(url, init);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(0, error); // Timeout duration unknown here
      }
      throw new NetworkError(`Request failed: ${(error as Error).message}`, error);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    try {
      // Read body with optional timeout - uses streaming for true interruption
      if (bodyTimeoutMs != null && bodyTimeoutMs > 0) {
        data = await readBodyWithTimeout(response, contentType, bodyTimeoutMs);
      } else {
        data = await readBody(response, contentType);
      }
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw new SerializationError(`Failed to parse response body: ${(error as Error).message}`, error);
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      ok: response.ok,
    };
  }

  /* v8 ignore next 3 - disconnect is no-op for fetch */
  disconnect() {
    // Fetch doesn't require explicit disconnect
  }
}

/**
 * Read and parse response body based on content type (no timeout)
 */
async function readBody(response: globalThis.Response, contentType: string): Promise<unknown> {
  if (contentType.includes('application/json')) {
    return response.json();
  }
  if (contentType.includes('text/')) {
    return response.text();
  }
  return response.arrayBuffer();
}

/**
 * Read body with timeout using streaming - can truly interrupt the download
 * Uses ReadableStream reader with cancel() for proper resource cleanup
 */
async function readBodyWithTimeout(
  response: globalThis.Response,
  contentType: string,
  timeoutMs: number,
): Promise<unknown> {
  const body = response.body;

  // No body to read
  if (!body) {
    return undefined;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  let timeoutFired = false;

  // Timer that cancels the reader on timeout
  const timeoutId = setTimeout(() => {
    timeoutFired = true;
    /* v8 ignore next 2 -- @preserve reader.cancel() never rejects in practice */
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op catch
    reader.cancel('Body download timeout').catch(() => {});
  }, timeoutMs);

  try {
    // Read chunks until done or cancelled
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }
  } catch (error) {
    /* v8 ignore next 5 -- @preserve defensive: cancel causes read to return done not throw */
    if (timeoutFired) {
      const timeoutError = new TimeoutError(timeoutMs);
      timeoutError.message = `Body download timed out after ${timeoutMs}ms`;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  // Check if loop exited due to timeout (reader.cancel() causes read() to return done:true)
  if (timeoutFired) {
    const timeoutError = new TimeoutError(timeoutMs);
    timeoutError.message = `Body download timed out after ${timeoutMs}ms`;
    throw timeoutError;
  }

  // Combine all chunks into single buffer
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Parse based on content-type
  if (contentType.includes('application/json')) {
    const text = new TextDecoder().decode(combined);
    return JSON.parse(text);
  }
  if (contentType.includes('text/')) {
    return new TextDecoder().decode(combined);
  }
  return combined.buffer;
}
