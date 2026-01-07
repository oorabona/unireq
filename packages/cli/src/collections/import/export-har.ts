/**
 * HAR 1.2 Exporter
 * Converts unireq collections to HTTP Archive (HAR) format
 * @see https://w3c.github.io/web-performance/specs/HAR/Overview.html
 */

import type { Collection, CollectionItem } from '../types.js';
import type {
  ExportFormat,
  ExportResult,
  HarArchive,
  HarContent,
  HarEntry,
  HarNameValue,
  HarPostData,
  HarQueryParam,
  HarRequest,
  HarResponse,
  HarTimings,
} from './types.js';

/**
 * Export options for HAR format
 */
export interface HarExportOptions {
  /** Base URL to prepend to paths (default: 'http://localhost') */
  baseUrl?: string;
  /** Creator name for HAR metadata (default: 'unireq') */
  creatorName?: string;
  /** Creator version for HAR metadata (default: '1.0.0') */
  creatorVersion?: string;
  /** Include mock response in entries (default: true) */
  includeResponse?: boolean;
}

/**
 * Convert ${var} to literal string (HAR doesn't support variables)
 * Returns the text and whether any variables were found
 */
export function expandVariables(text: string): { result: string; hasVariables: boolean } {
  const pattern = /\$\{([^}]+)\}/g;
  const hasVariables = pattern.test(text);
  // Reset regex state
  pattern.lastIndex = 0;
  // Replace ${var} with :var placeholder (common REST convention)
  const result = text.replace(pattern, ':$1');
  return { result, hasVariables };
}

/**
 * Export unireq collections to HAR 1.2 format
 *
 * @param collections - Collections to export
 * @param options - Export options
 * @returns Export result with HAR JSON
 */
export function exportToHar(collections: Collection[], options: HarExportOptions = {}): ExportResult {
  const {
    baseUrl = 'http://localhost',
    creatorName = 'unireq',
    creatorVersion = '1.0.0',
    includeResponse = true,
  } = options;

  if (collections.length === 0) {
    return {
      format: 'har' as ExportFormat,
      data: createEmptyHarArchive(creatorName, creatorVersion),
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
  let hasVariables = false;

  const entries: HarEntry[] = [];
  const startTime = new Date().toISOString();

  for (const collection of collections) {
    totalItems += collection.items.length;

    for (const item of collection.items) {
      try {
        const entry = convertCollectionItem(item, baseUrl, includeResponse, startTime);
        entries.push(entry);
        exportedItems++;

        // Check for variables in request
        if (checkForVariables(item)) {
          hasVariables = true;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        warnings.push(`Skipped "${item.name}": ${errorMessage}`);
      }
    }
  }

  if (hasVariables) {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: documentation message showing variable syntax
    warnings.push('Variables converted from ${var} to :var placeholder (HAR does not support variables)');
  }

  const harArchive: HarArchive = {
    log: {
      version: '1.2',
      creator: {
        name: creatorName,
        version: creatorVersion,
      },
      entries,
    },
  };

  return {
    format: 'har' as ExportFormat,
    data: harArchive,
    warnings,
    stats: {
      totalItems,
      exportedItems,
      skippedItems: totalItems - exportedItems,
    },
  };
}

/**
 * Create an empty HAR archive
 */
function createEmptyHarArchive(creatorName: string, creatorVersion: string): HarArchive {
  return {
    log: {
      version: '1.2',
      creator: {
        name: creatorName,
        version: creatorVersion,
      },
      entries: [],
    },
  };
}

/**
 * Convert a unireq CollectionItem to HAR entry
 */
function convertCollectionItem(
  item: CollectionItem,
  baseUrl: string,
  includeResponse: boolean,
  startedDateTime: string,
): HarEntry {
  const request = item.request;
  const { result: expandedBaseUrl } = expandVariables(baseUrl);
  const { result: expandedPath } = expandVariables(request.path);

  // Build full URL
  const fullUrl = buildFullUrl(expandedBaseUrl, expandedPath, request.query);

  const harRequest: HarRequest = {
    method: request.method,
    url: fullUrl,
    httpVersion: 'HTTP/1.1',
    headers: convertHeaders(request.headers),
    queryString: convertQueryParams(request.query),
    cookies: [],
    headersSize: -1,
    bodySize: request.body ? request.body.length : 0,
  };

  // Add post data if present
  if (request.body) {
    harRequest.postData = convertBody(request.body, request.headers);
  }

  const entry: HarEntry = {
    startedDateTime,
    time: 0,
    request: harRequest,
    response: includeResponse ? createMockResponse() : createMinimalResponse(),
    cache: {},
    timings: createMockTimings(),
  };

  // Add comment with item name
  if (item.name) {
    entry.comment = item.name;
  }

  return entry;
}

/**
 * Build full URL from base, path, and query params
 */
function buildFullUrl(baseUrl: string, path: string, query?: string[]): string {
  // Ensure baseUrl doesn't end with slash and path starts with slash
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${cleanBase}${cleanPath}`;

  if (query && query.length > 0) {
    const queryParts: string[] = [];
    for (const param of query) {
      const { result: expandedParam } = expandVariables(param);
      queryParts.push(expandedParam);
    }
    url += `?${queryParts.join('&')}`;
  }

  return url;
}

/**
 * Convert unireq headers to HAR format
 */
function convertHeaders(headers?: string[]): HarNameValue[] {
  if (!headers || headers.length === 0) {
    return [];
  }

  const result: HarNameValue[] = [];
  for (const header of headers) {
    const colonIndex = header.indexOf(':');
    if (colonIndex === -1) continue;

    const name = header.substring(0, colonIndex).trim();
    const value = header.substring(colonIndex + 1).trim();

    const { result: expandedName } = expandVariables(name);
    const { result: expandedValue } = expandVariables(value);

    result.push({
      name: expandedName,
      value: expandedValue,
    });
  }
  return result;
}

/**
 * Convert unireq query params to HAR format
 */
function convertQueryParams(query?: string[]): HarQueryParam[] {
  if (!query || query.length === 0) {
    return [];
  }

  const result: HarQueryParam[] = [];
  for (const param of query) {
    const [key, ...valueParts] = param.split('=');
    const value = valueParts.join('=');

    const { result: expandedKey } = expandVariables(key || '');
    const { result: expandedValue } = expandVariables(value);

    result.push({
      name: expandedKey,
      value: expandedValue,
    });
  }
  return result;
}

/**
 * Convert unireq body to HAR postData format
 */
function convertBody(body: string, headers?: string[]): HarPostData {
  const { result: expandedBody } = expandVariables(body);

  // Detect content type from headers
  const contentType =
    headers
      ?.find((h) => h.toLowerCase().startsWith('content-type:'))
      ?.split(':')[1]
      ?.trim() || 'text/plain';

  return {
    mimeType: contentType,
    text: expandedBody,
  };
}

/**
 * Create a mock response (HAR requires a response object)
 */
function createMockResponse(): HarResponse {
  return {
    status: 200,
    statusText: 'OK',
    httpVersion: 'HTTP/1.1',
    headers: [],
    cookies: [],
    content: createMockContent(),
    redirectURL: '',
    headersSize: -1,
    bodySize: 0,
  };
}

/**
 * Create a minimal response (for when includeResponse is false)
 */
function createMinimalResponse(): HarResponse {
  return {
    status: 0,
    statusText: '',
    httpVersion: 'HTTP/1.1',
    headers: [],
    cookies: [],
    content: { size: 0, mimeType: 'text/plain' },
    redirectURL: '',
    headersSize: -1,
    bodySize: -1,
  };
}

/**
 * Create mock content for response
 */
function createMockContent(): HarContent {
  return {
    size: 0,
    mimeType: 'text/plain',
  };
}

/**
 * Create mock timings (HAR requires timings object)
 */
function createMockTimings(): HarTimings {
  return {
    blocked: -1,
    dns: -1,
    connect: -1,
    send: 0,
    wait: 0,
    receive: 0,
    ssl: -1,
  };
}

/**
 * Check if a collection item contains variables
 */
function checkForVariables(item: CollectionItem): boolean {
  const pattern = /\$\{[^}]+\}/;
  const request = item.request;

  if (pattern.test(request.path)) return true;
  if (request.body && pattern.test(request.body)) return true;
  if (request.headers?.some((h) => pattern.test(h))) return true;
  if (request.query?.some((q) => pattern.test(q))) return true;
  return false;
}

/**
 * Export a single collection to HAR format
 */
export function exportCollectionToHar(collection: Collection, options: HarExportOptions = {}): ExportResult {
  return exportToHar([collection], options);
}
