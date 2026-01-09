/**
 * Postman v2.1 Exporter
 * Converts unireq collections to Postman format
 */

import type { Collection, CollectionItem, SavedRequest } from '../types.js';
import type {
  ExportFormat,
  ExportResult,
  PostmanBody,
  PostmanCollection,
  PostmanHeader,
  PostmanItem,
  PostmanQueryParam,
  PostmanRequest,
  PostmanUrl,
} from './types.js';

/**
 * Export options for Postman format
 */
export interface PostmanExportOptions {
  /** Base URL to prepend to paths (default: '{{baseUrl}}') */
  baseUrl?: string;
  /** Include example responses (default: false) */
  includeResponses?: boolean;
}

/**
 * Export unireq collections to Postman v2.1 format
 *
 * @param collections - Collections to export
 * @param options - Export options
 * @returns Export result with Postman JSON
 */
export function exportToPostman(collections: Collection[], options: PostmanExportOptions = {}): ExportResult {
  const { baseUrl = '{{baseUrl}}' } = options;

  if (collections.length === 0) {
    return {
      format: 'postman' as ExportFormat,
      data: createEmptyPostmanCollection('Empty Collection'),
      warnings: ['No collections to export'],
      stats: {
        totalItems: 0,
        exportedItems: 0,
        skippedItems: 0,
      },
    };
  }

  const warnings: string[] = [];
  let totalItems = 0;
  let exportedItems = 0;

  // If multiple collections, merge them into one Postman collection with folders
  const [primaryCollection] = collections;
  if (!primaryCollection) {
    // This should never happen due to the length check above, but satisfies type checker
    throw new Error('Unexpected: collections array is empty after length check');
  }
  const postmanItems: PostmanItem[] = [];

  for (const collection of collections) {
    totalItems += collection.items.length;

    if (collections.length > 1) {
      // Create a folder for each collection
      const folderItems: PostmanItem[] = [];

      for (const item of collection.items) {
        try {
          folderItems.push(convertCollectionItem(item, baseUrl));
          exportedItems++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          warnings.push(`Skipped "${item.name}": ${errorMessage}`);
        }
      }

      postmanItems.push({
        name: collection.name,
        description: collection.description,
        item: folderItems,
      });
    } else {
      // Single collection - add items directly
      for (const item of collection.items) {
        try {
          postmanItems.push(convertCollectionItem(item, baseUrl));
          exportedItems++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          warnings.push(`Skipped "${item.name}": ${errorMessage}`);
        }
      }
    }
  }

  const postmanCollection: PostmanCollection = {
    info: {
      name: primaryCollection.name,
      description: primaryCollection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: postmanItems,
  };

  // Add warning about variable conversion
  const variablePattern = /\$\{[^}]+\}/;
  let hasVariables = false;
  for (const collection of collections) {
    for (const item of collection.items) {
      if (checkForVariables(item.request, variablePattern)) {
        hasVariables = true;
        break;
      }
    }
    if (hasVariables) break;
  }

  if (hasVariables) {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: documentation message showing variable syntax
    warnings.push('Variables converted from ${...} to {{...}} syntax');
  }

  return {
    format: 'postman' as ExportFormat,
    data: postmanCollection,
    warnings,
    stats: {
      totalItems,
      exportedItems,
      skippedItems: totalItems - exportedItems,
    },
  };
}

/**
 * Create an empty Postman collection
 */
function createEmptyPostmanCollection(name: string): PostmanCollection {
  return {
    info: {
      name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [],
  };
}

/**
 * Convert a unireq CollectionItem to Postman format
 */
function convertCollectionItem(item: CollectionItem, baseUrl: string): PostmanItem {
  const request = item.request;

  const postmanRequest: PostmanRequest = {
    method: request.method,
    url: convertUrl(request.path, request.query, baseUrl),
    header: convertHeaders(request.headers),
    body: convertBody(request.body, request.headers),
    description: item.description,
  };

  return {
    name: item.name,
    description: item.description,
    request: postmanRequest,
    response: [],
  };
}

/**
 * Convert unireq path and query to Postman URL
 */
function convertUrl(path: string, query: string[] | undefined, baseUrl: string): PostmanUrl {
  // Convert ${var} to {{var}}
  const convertedPath = convertVariableSyntax(path);
  const convertedBaseUrl = convertVariableSyntax(baseUrl);

  // Parse path segments
  const pathSegments = convertedPath.split('/').filter((s) => s);

  // Build raw URL
  let raw = `${convertedBaseUrl}${convertedPath}`;

  // Convert query params
  const queryParams: PostmanQueryParam[] = [];
  if (query && query.length > 0) {
    const queryParts: string[] = [];
    for (const param of query) {
      const [key, ...valueParts] = param.split('=');
      const value = valueParts.join('=');
      const convertedKey = convertVariableSyntax(key || '');
      const convertedValue = convertVariableSyntax(value);
      queryParams.push({
        key: convertedKey,
        value: convertedValue,
      });
      queryParts.push(`${convertedKey}=${convertedValue}`);
    }
    raw += `?${queryParts.join('&')}`;
  }

  return {
    raw,
    host: [convertedBaseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')],
    path: pathSegments,
    query: queryParams.length > 0 ? queryParams : undefined,
  };
}

/**
 * Convert unireq headers to Postman format
 */
function convertHeaders(headers: string[] | undefined): PostmanHeader[] {
  if (!headers || headers.length === 0) {
    return [];
  }

  const result: PostmanHeader[] = [];
  for (const header of headers) {
    const colonIndex = header.indexOf(':');
    if (colonIndex === -1) continue;

    const key = header.substring(0, colonIndex).trim();
    const value = header.substring(colonIndex + 1).trim();

    result.push({
      key: convertVariableSyntax(key),
      value: convertVariableSyntax(value),
      type: 'text',
    });
  }
  return result;
}

/**
 * Convert unireq body to Postman format
 */
function convertBody(body: string | undefined, headers?: string[]): PostmanBody | undefined {
  if (!body) return undefined;

  const convertedBody = convertVariableSyntax(body);

  // Detect content type from headers
  const contentType = headers?.find((h) => h.toLowerCase().startsWith('content-type:'));
  const mimeType = contentType?.split(':')[1]?.trim().toLowerCase() || '';

  if (mimeType.includes('application/json') || isJsonLike(convertedBody)) {
    return {
      mode: 'raw',
      raw: convertedBody,
      options: {
        raw: {
          language: 'json',
        },
      },
    };
  }

  if (mimeType.includes('application/x-www-form-urlencoded')) {
    // Parse URL encoded body
    const params = convertedBody.split('&').map((param) => {
      const [key, ...valueParts] = param.split('=');
      return {
        key: decodeURIComponent(key || ''),
        value: decodeURIComponent(valueParts.join('=')),
        type: 'text' as const,
      };
    });

    return {
      mode: 'urlencoded',
      urlencoded: params,
    };
  }

  // Default to raw
  return {
    mode: 'raw',
    raw: convertedBody,
  };
}

/**
 * Check if a string looks like JSON
 */
function isJsonLike(text: string): boolean {
  const trimmed = text.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

/**
 * Convert unireq ${variable} syntax to Postman {{variable}} syntax
 */
export function convertVariableSyntax(text: string): string {
  return text.replace(/\$\{([^}]+)\}/g, '{{$1}}');
}

/**
 * Check if a request contains variables
 */
function checkForVariables(request: SavedRequest, pattern: RegExp): boolean {
  if (pattern.test(request.path)) return true;
  if (request.body && pattern.test(request.body)) return true;
  if (request.headers?.some((h) => pattern.test(h))) return true;
  if (request.query?.some((q) => pattern.test(q))) return true;
  return false;
}

/**
 * Export a single collection to Postman format
 */
export function exportCollectionToPostman(collection: Collection, options: PostmanExportOptions = {}): ExportResult {
  return exportToPostman([collection], options);
}
