/**
 * HTTP(S) transport using Node.js built-in fetch (undici)
 * @see https://undici.nodejs.org
 */

import type { Connector, RequestContext, Response, TransportWithCapabilities } from '@unireq/core';
import { policy } from '@unireq/core';
import { UndiciConnector } from './connectors/undici.js';

function createDefaultHttpConnector(): Connector {
  return new UndiciConnector();
}

/**
 * Creates an HTTP(S) transport using connector
 * Supports streams, multipart form data, and random access (range requests)
 *
 * @param uri - Optional base URI for the transport
 * @param connector - Optional connector instance (defaults to UndiciConnector)
 * @returns Transport with capabilities
 */
export function http(uri?: string, connector?: Connector): TransportWithCapabilities {
  let client: unknown;
  const actualConnector = connector ?? createDefaultHttpConnector();

  const transport = policy(
    async (ctx: RequestContext): Promise<Response> => {
      // Connect once if URI provided
      if (uri && !client) {
        client = await actualConnector.connect(uri);
      }

      // Build final URL: if uri provided and ctx.url is relative, combine them
      const finalUrl = uri && ctx.url.startsWith('/') ? `${uri}${ctx.url}` : ctx.url;

      return actualConnector.request(client, { ...ctx, url: finalUrl });
    },
    {
      name: 'http',
      kind: 'transport',
      options: uri ? { uri } : undefined,
    },
  );

  return {
    transport,
    capabilities: {
      streams: true,
      multipartFormData: true,
      randomAccess: true, // Range requests supported
    },
  };
}
