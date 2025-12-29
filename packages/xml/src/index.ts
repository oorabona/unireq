/**
 * @unireq/xml - XML parser policy using fast-xml-parser
 */

import type { BodyDescriptor, Policy } from '@unireq/core';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

/** XML parser options (fast-xml-parser X2jOptions) */
export interface XMLParserOptions {
  readonly ignoreAttributes?: boolean;
  readonly attributeNamePrefix?: string;
  readonly textNodeName?: string;
  readonly [key: string]: unknown;
}

/** XML builder options (fast-xml-parser XmlBuilderOptions) */
export interface XMLBuilderOptions {
  readonly ignoreAttributes?: boolean;
  readonly attributeNamePrefix?: string;
  readonly textNodeName?: string;
  readonly format?: boolean;
  readonly indentBy?: string;
  readonly [key: string]: unknown;
}

/**
 * Creates an XML parser policy
 * @param options - fast-xml-parser options
 * @returns Policy that parses XML responses
 *
 * @example
 * ```ts
 * const xmlPolicy = xml({
 *   ignoreAttributes: false,
 *   attributeNamePrefix: '@_'
 * });
 * ```
 */
export function xml(options: XMLParserOptions = {}): Policy {
  return async (ctx, next) => {
    const response = await next(ctx);

    // Only parse if content-type is XML
    const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';

    if (!contentType.includes('xml')) {
      return response;
    }

    // Get XML text
    let xmlText: string;
    if (typeof response.data === 'string') {
      xmlText = response.data;
    } else if (response.data instanceof ArrayBuffer) {
      xmlText = new TextDecoder().decode(response.data);
    } else {
      return response;
    }

    // Parse XML
    const parser = new XMLParser(options);
    const parsed = parser.parse(xmlText);

    return {
      ...response,
      data: parsed,
    };
  };
}

/**
 * Create an XML body descriptor
 * Serializes an object to XML string using fast-xml-parser
 *
 * @param data - Data to serialize as XML
 * @param options - fast-xml-parser builder options
 * @returns BodyDescriptor for XML content
 *
 * @example
 * ```ts
 * import { xmlBody } from '@unireq/xml';
 * import { client } from '@unireq/core';
 * import { http } from '@unireq/http';
 *
 * const api = client(http('https://api.example.com'));
 * const response = await api.post('/users', xmlBody({ user: { name: 'John', email: 'john@example.com' } }));
 * ```
 */
export function xmlBody<T>(data: T, options: XMLBuilderOptions = {}): BodyDescriptor {
  return {
    __brand: 'BodyDescriptor',
    data,
    contentType: 'application/xml',
    serialize: () => {
      const builder = new XMLBuilder(options);
      return builder.build(data);
    },
  };
}
