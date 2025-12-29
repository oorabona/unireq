/**
 * Undici connector for HTTP transport using Node.js built-in fetch
 */

import type { Connector, RequestContext, Response } from '@unireq/core';
import { NetworkError, SerializationError, TimeoutError } from '@unireq/core';

export interface UndiciConnectorOptions {
  readonly keepAlive?: boolean;
  readonly timeout?: number;
}

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
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/')) {
        data = await response.text();
      } else {
        data = await response.arrayBuffer();
      }
    } catch (error) {
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
