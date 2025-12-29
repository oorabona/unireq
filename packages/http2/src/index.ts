/**
 * @unireq/http2 - HTTP/2 transport using Node.js http2 module with ALPN
 *
 * ## Why a dedicated HTTP/2 transport?
 *
 * Node.js built-in `fetch` (undici) defaults to HTTP/1.1, even when the server supports HTTP/2.
 * While undici can negotiate HTTP/2 via ALPN, it requires explicit configuration and doesn't
 * happen automatically with the global `fetch` API.
 *
 * This package provides a dedicated HTTP/2 transport using `node:http2` for scenarios where:
 * - HTTP/2 is required (not optional)
 * - Server push is needed
 * - Multiplexing over a single connection is critical
 * - ALPN negotiation must be explicit
 *
 * @see https://undici.nodejs.org
 * @see https://nodejs.org/api/http2.html
 */

import type { Connector, RequestContext, Response, TransportWithCapabilities } from '@unireq/core';
import { Http2Connector } from './connectors/native.js';

function createDefaultHttp2Connector(): Connector {
  return new Http2Connector();
}

/**
 * Creates an HTTP/2 transport using node:http2 with ALPN
 *
 * @param uri - Optional base URI for the transport
 * @param connector - Optional connector instance (defaults to Http2Connector)
 * @returns Transport with capabilities
 *
 * @example
 * ```ts
 * const h2api = client(http2('https://api.example.com'), json());
 * ```
 */
export function http2(uri?: string, connector?: Connector): TransportWithCapabilities {
  let client: unknown;
  const actualConnector = connector ?? createDefaultHttp2Connector();

  const transport = async (ctx: RequestContext): Promise<Response> => {
    // Connect once if URI provided
    if (uri && !client) {
      client = await actualConnector.connect(uri);
    }

    // Build final URL: if uri provided and ctx.url is relative, combine them
    const finalUrl = uri && ctx.url.startsWith('/') ? `${uri}${ctx.url}` : ctx.url;

    return actualConnector.request(client, { ...ctx, url: finalUrl });
  };

  return {
    transport,
    capabilities: {
      streams: true,
      http2: true,
      serverPush: true,
    },
  };
}

export type { Http2ConnectorOptions } from './connectors/native.js';
export { Http2Connector } from './connectors/native.js';
