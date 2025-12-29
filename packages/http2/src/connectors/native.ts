/**
 * HTTP/2 connector using Node.js native http2 module
 */

import * as http from 'node:http';
import * as http2 from 'node:http2';
import type { Connector, RequestContext, Response } from '@unireq/core';

export interface Http2ConnectorOptions {
  readonly enablePush?: boolean;
  readonly sessionTimeout?: number;
}

/**
 * Session cache entry with the session and its state
 */
interface SessionCacheEntry {
  session: http2.ClientHttp2Session;
  destroyed: boolean;
}

export class Http2Connector implements Connector {
  private readonly sessionCache = new Map<string, SessionCacheEntry>();

  constructor(private readonly options: Http2ConnectorOptions = {}) {}

  connect(uri: string) {
    return { baseUrl: uri };
  }

  /**
   * Get or create an HTTP/2 session for the given origin
   */
  private getOrCreateSession(origin: string): http2.ClientHttp2Session {
    const { sessionTimeout = 30000 } = this.options;

    // Check if we have a cached session that's still valid
    const cached = this.sessionCache.get(origin);
    if (cached && !cached.destroyed) {
      return cached.session;
    }

    // Create a new session
    const session = http2.connect(origin, {
      timeout: sessionTimeout,
    });

    const entry: SessionCacheEntry = {
      session,
      destroyed: false,
    };

    // Cache the session
    this.sessionCache.set(origin, entry);

    // Handle session lifecycle events to remove from cache
    const cleanupSession = () => {
      entry.destroyed = true;
      this.sessionCache.delete(origin);
    };

    session.on('close', cleanupSession);
    session.on('goaway', cleanupSession);
    session.on('error', cleanupSession);
    session.on('timeout', cleanupSession);

    // Unref the session so it doesn't prevent process exit
    session.unref();

    return session;
  }

  async request(_client: unknown, ctx: RequestContext): Promise<Response> {
    const { url, method, headers, body, signal } = ctx;

    return new Promise((resolve, reject) => {
      const parsedURL = new URL(url);

      const session = this.getOrCreateSession(parsedURL.origin);

      // Only add error handler for this request, not globally
      const sessionErrorHandler = (err: Error) => reject(err);
      session.on('error', sessionErrorHandler);

      signal?.addEventListener('abort', () => {
        reject(new Error('Request aborted'));
      });

      const h2Headers: http2.OutgoingHttpHeaders = {
        ':method': method,
        ':path': parsedURL.pathname + parsedURL.search,
        ':scheme': parsedURL.protocol.slice(0, -1),
        ...headers,
      };

      const req = session.request(h2Headers, {
        endStream: body === undefined,
      });

      if (body !== undefined) {
        if (typeof body === 'string') {
          req.write(body);
        } else if (body instanceof Buffer) {
          req.write(body);
        } else if (body instanceof ArrayBuffer) {
          req.write(Buffer.from(body));
        } else if (ArrayBuffer.isView(body)) {
          // Handle TypedArrays (Uint8Array, Int32Array, etc.) and DataView
          req.write(Buffer.from(body.buffer, body.byteOffset, body.byteLength));
        } else if (typeof body === 'object' && body !== null) {
          // Plain objects and arrays
          req.write(JSON.stringify(body));
        } else {
          // Fallback for primitives (numbers, booleans) - convert to string
          req.write(String(body));
        }
        req.end();
      }

      let responseData = Buffer.alloc(0);
      const responseHeaders: Record<string, string> = {};
      let status = 200;
      let statusText = 'OK';

      req.on('response', (h2ResponseHeaders) => {
        status = (h2ResponseHeaders[':status'] as number) || 200;
        statusText = http.STATUS_CODES[status] || 'OK';

        for (const [key, value] of Object.entries(h2ResponseHeaders)) {
          if (!key.startsWith(':')) {
            responseHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
          }
        }
      });

      req.on('data', (chunk: Buffer) => {
        responseData = Buffer.concat([responseData, chunk]);
      });

      req.on('end', () => {
        // Remove the request-specific error handler
        session.off('error', sessionErrorHandler);

        const contentType = responseHeaders['content-type'] || '';
        let data: unknown;

        if (contentType.includes('application/json')) {
          data = JSON.parse(responseData.toString());
        } else if (contentType.includes('text/')) {
          data = responseData.toString();
        } else {
          // Use slice() to create a copy of only the used portion of the ArrayBuffer
          // This prevents exposure of garbage data from previous allocations
          data = responseData.buffer.slice(responseData.byteOffset, responseData.byteOffset + responseData.byteLength);
        }

        resolve({
          status,
          statusText,
          headers: responseHeaders,
          data,
          ok: status >= 200 && status < 300,
        });
      });

      req.on('error', (err) => {
        // Remove the request-specific error handler
        session.off('error', sessionErrorHandler);
        reject(err);
      });
    });
  }

  disconnect() {
    // Close all cached sessions
    for (const entry of this.sessionCache.values()) {
      if (!entry.destroyed) {
        entry.session.close();
        entry.destroyed = true;
      }
    }
    this.sessionCache.clear();
  }
}
