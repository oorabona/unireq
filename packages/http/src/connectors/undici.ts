/**
 * Undici connector for HTTP transport using undici.request()
 * Provides direct access to timing information for DNS, TCP, TLS phases
 */

import * as dns from 'node:dns';
import type { Connector, RequestContext, Response } from '@unireq/core';
import { NetworkError, SerializationError, TimeoutError } from '@unireq/core';
import { Agent, buildConnector, type Dispatcher, getGlobalDispatcher, request } from 'undici';
import { getTimingMarker, type TimingMarker } from '../timing.js';

export interface UndiciConnectorOptions {
  readonly keepAlive?: boolean;
  readonly timeout?: number;
}

/**
 * Symbol key for body timeout configuration
 * Used by timeout policy to pass body-specific timeout to the connector
 */
export const BODY_TIMEOUT_KEY = Symbol.for('unireq:bodyTimeout');

/**
 * HTTP status text lookup (undici doesn't provide statusText)
 */
const STATUS_TEXT: Record<number, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  206: 'Partial Content',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

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
    const bodyTimeoutMs = (ctx as unknown as Record<symbol, unknown>)[BODY_TIMEOUT_KEY] as number | undefined;
    const { requestBody, finalHeaders } = prepareBody(body, headers);
    const agent = selectDispatcher(getTimingMarker(ctx));

    try {
      let response: Dispatcher.ResponseData;
      try {
        response = await request(url, {
          method: method as Dispatcher.HttpMethod,
          headers: finalHeaders,
          body: requestBody,
          signal: signal ?? undefined,
          dispatcher: agent,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new TimeoutError(0, error);
        }
        throw new NetworkError(`Request failed: ${(error as Error).message}`, error);
      }

      const responseHeaders = normalizeResponseHeaders(response.headers);
      const contentType = responseHeaders['content-type'] || '';

      let data: unknown;
      try {
        data =
          bodyTimeoutMs != null && bodyTimeoutMs > 0
            ? await readBodyWithTimeout(response.body, contentType, bodyTimeoutMs)
            : await readBody(response.body, contentType);
      } catch (error) {
        if (error instanceof TimeoutError) throw error;
        throw new SerializationError(`Failed to parse response body: ${(error as Error).message}`, error);
      }

      return {
        status: response.statusCode,
        statusText: STATUS_TEXT[response.statusCode] || 'Unknown Status',
        headers: responseHeaders,
        data,
        ok: response.statusCode >= 200 && response.statusCode < 300,
      };
    } finally {
      if (agent) await agent.close();
    }
  }

  /* v8 ignore next 3 - disconnect is no-op for undici */
  disconnect() {
    // undici doesn't require explicit disconnect for single requests
  }
}

/**
 * Prepare request body and finalize headers.
 * Handles FormData boundary, streaming types, string passthrough, and JSON auto-serialization.
 */
function prepareBody(
  body: unknown,
  headers: Record<string, string>,
): { requestBody: Dispatcher.DispatchOptions['body'] | undefined; finalHeaders: Record<string, string> } {
  // For FormData, remove Content-Type so undici can set it with boundary
  let requestHeaders = headers;
  if (body instanceof FormData) {
    const { 'content-type': _ct, 'Content-Type': _CT, ...rest } = headers;
    requestHeaders = rest;
  }

  let requestBody: Dispatcher.DispatchOptions['body'] | undefined;
  let contentTypeHeader: string | undefined;

  if (body !== undefined) {
    if (body instanceof FormData || body instanceof ReadableStream || body instanceof Blob) {
      requestBody = body as unknown as Dispatcher.DispatchOptions['body'];
    } else if (typeof body === 'string') {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      if (!requestHeaders['content-type'] && !requestHeaders['Content-Type']) {
        contentTypeHeader = 'application/json';
      }
    }
  }

  return {
    requestBody,
    finalHeaders: {
      ...requestHeaders,
      ...(contentTypeHeader ? { 'content-type': contentTypeHeader } : {}),
    },
  };
}

/**
 * Select a dispatcher for timing instrumentation.
 * Returns a timed Agent when a timing marker is present (skips MockAgent in tests).
 */
function selectDispatcher(timingMarker: TimingMarker | undefined): Agent | undefined {
  if (!timingMarker) return undefined;
  const globalDispatcher = getGlobalDispatcher();
  const isMock = typeof (globalDispatcher as { disableNetConnect?: unknown }).disableNetConnect === 'function';
  return isMock ? undefined : createTimedAgent(timingMarker);
}

/**
 * Convert undici IncomingHttpHeaders to a flat Record<string, string>.
 */
function normalizeResponseHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      result[key] = Array.isArray(value) ? value.join(', ') : value;
    }
  }
  return result;
}

/**
 * Read and parse response body based on content type (no timeout)
 */
async function readBody(body: Dispatcher.ResponseData['body'], contentType: string): Promise<unknown> {
  if (contentType.includes('application/json')) {
    return body.json();
  }
  if (contentType.includes('text/')) {
    return body.text();
  }
  return body.arrayBuffer();
}

/**
 * Read body with timeout using streaming - can truly interrupt the download
 * Uses Promise.race() to properly race between body iteration and timeout
 */
async function readBodyWithTimeout(
  body: Dispatcher.ResponseData['body'],
  contentType: string,
  timeoutMs: number,
): Promise<unknown> {
  // Collect chunks during iteration
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  // Use object to hold timeout ID - avoids non-null assertion
  const timeout: { id?: ReturnType<typeof setTimeout> } = {};

  // Create timeout promise that rejects after timeoutMs
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout.id = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });

  // Async function to iterate body and collect chunks
  const iterateBody = async (): Promise<void> => {
    for await (const chunk of body) {
      const uint8Chunk = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      chunks.push(uint8Chunk);
      totalLength += uint8Chunk.length;
    }
  };

  try {
    // Race between body iteration and timeout
    await Promise.race([iterateBody(), timeoutPromise]);
    if (timeout.id) clearTimeout(timeout.id);
  } catch (error) {
    if (timeout.id) clearTimeout(timeout.id);
    if (error instanceof TimeoutError) {
      error.message = `Body download timed out after ${timeoutMs}ms`;
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new TimeoutError(timeoutMs);
      timeoutError.message = `Body download timed out after ${timeoutMs}ms`;
      throw timeoutError;
    }
    throw error;
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

/**
 * Create an Agent with timed DNS lookup and TCP connection
 * Measures both DNS resolution and TCP connection establishment time
 */
function createTimedAgent(timingMarker: TimingMarker): Agent {
  // Track DNS completion time to calculate TCP time
  let dnsCompleteTime = 0;

  // Create timed lookup that measures DNS resolution
  const timedLookup = (
    hostname: string,
    options: dns.LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
  ) => {
    const start = performance.now();

    dns.lookup(hostname, options, (err, address, family) => {
      const elapsed = performance.now() - start;
      dnsCompleteTime = performance.now();
      timingMarker.markDns(elapsed);

      // Call original callback with proper signature
      callback(err, address as string | dns.LookupAddress[], family);
    });
  };

  // Build base connector with timed lookup
  const baseConnector = buildConnector({ lookup: timedLookup });

  // Create custom connect function that measures TCP time
  const timedConnect: buildConnector.connector = (options, callback) => {
    const connectStart = performance.now();

    baseConnector(options, (err, socket) => {
      if (err) {
        // Error case
        callback(err, null);
      } else if (socket) {
        // Success case - measure TCP time
        // Note: dnsCompleteTime may not be set if connection was pooled or cached
        const tcpTime = dnsCompleteTime > 0 ? performance.now() - dnsCompleteTime : performance.now() - connectStart;
        timingMarker.markTcp(tcpTime);
        callback(null, socket);
      }
    });
  };

  return new Agent({ connect: timedConnect });
}
