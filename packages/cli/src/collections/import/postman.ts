/**
 * Postman v2.1 Collection Importer
 * Converts Postman collections to unireq format
 */

import type { Collection, CollectionItem, SavedRequest } from '../types.js';
import type { ImportedCollection, ImportedItem, PostmanCollection, PostmanItem, PostmanRequest } from './types.js';
import { ImportError } from './types.js';

/**
 * Import options for Postman collections
 */
export interface PostmanImportOptions {
  /** Base URL to use when Postman URL has no host (default: '') */
  baseUrl?: string;
  /** Preserve folder structure as nested collections (default: true) */
  preserveFolders?: boolean;
  /** Prefix for generated IDs (default: '') */
  idPrefix?: string;
}

/**
 * Convert Postman collection to unireq format
 *
 * @param data - Validated Postman collection data
 * @param options - Import options
 * @returns Imported collection with metadata
 */
export function importPostmanCollection(
  data: PostmanCollection,
  options: PostmanImportOptions = {},
): ImportedCollection {
  const { baseUrl = '', preserveFolders = true, idPrefix = '' } = options;

  const collectionId = slugify(data.info.name);
  const collectionName = data.info.name;
  const description = typeof data.info.description === 'string' ? data.info.description : undefined;

  const items: ImportedItem[] = [];
  const warnings: string[] = [];

  // Process items recursively
  processItems(data.item, items, warnings, {
    baseUrl,
    preserveFolders,
    idPrefix,
    folderPath: [],
  });

  // Check for variable usage and add warning
  const variableCount = countVariables(data);
  if (variableCount > 0) {
    warnings.push(
      `Found ${variableCount} Postman variable(s) using {{...}} syntax. ` +
        `Converted to \${...} syntax. Ensure variables are defined in your unireq profile.`,
    );
  }

  // Warn about ignored features
  if (data.auth) {
    warnings.push('Collection-level authentication was ignored. Configure auth in unireq profiles.');
  }
  if (data.event?.length) {
    warnings.push('Pre-request/test scripts were ignored. unireq uses declarative assertions.');
  }
  if (data.variable?.length) {
    warnings.push(`Collection variables (${data.variable.length}) were ignored. Define variables in unireq profiles.`);
  }

  const collection: Collection = {
    id: collectionId,
    name: collectionName,
    description,
    items: items.map((item) => item.item),
  };

  return {
    format: 'postman',
    version: extractVersion(data.info.schema),
    collections: [collection],
    items,
    warnings,
    stats: {
      totalItems: items.length,
      convertedItems: items.length,
      skippedItems: 0,
    },
  };
}

/**
 * Context for recursive item processing
 */
interface ProcessContext {
  baseUrl: string;
  preserveFolders: boolean;
  idPrefix: string;
  folderPath: string[];
}

/**
 * Process Postman items recursively (handles nested folders)
 */
function processItems(items: PostmanItem[], result: ImportedItem[], warnings: string[], context: ProcessContext): void {
  for (const item of items) {
    if (isFolder(item)) {
      // Folder - recurse into sub-items
      const newPath = [...context.folderPath, item.name];
      if (item.item) {
        processItems(item.item, result, warnings, {
          ...context,
          folderPath: newPath,
        });
      }
    } else if (item.request) {
      // Request item
      try {
        const converted = convertPostmanRequest(item, context);
        result.push(converted);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        warnings.push(`Skipped "${item.name}": ${errorMessage}`);
      }
    }
  }
}

/**
 * Check if item is a folder (has sub-items but no request)
 */
function isFolder(item: PostmanItem): boolean {
  return Array.isArray(item.item) && item.item.length > 0;
}

/**
 * Convert a single Postman request to unireq format
 */
function convertPostmanRequest(item: PostmanItem, context: ProcessContext): ImportedItem {
  const request = item.request;
  if (!request) {
    throw new ImportError('CONVERSION_ERROR', `Item "${item.name}" has no request`);
  }

  // Handle request that might be a string (raw URL)
  const reqObj = typeof request === 'string' ? parseRawRequest(request) : request;

  // Build ID from folder path + item name
  const pathPrefix = context.folderPath.length > 0 ? `${context.folderPath.map(slugify).join('-')}-` : '';
  const fullPrefix = context.idPrefix ? `${context.idPrefix}-${pathPrefix}` : pathPrefix;
  const id = `${fullPrefix}${slugify(item.name)}`;

  // Extract URL components
  const { path, query } = extractUrlComponents(reqObj.url, context.baseUrl);

  // Convert headers
  const headers = convertHeaders(reqObj.header);

  // Convert body
  const body = convertBody(reqObj.body);

  // Get method (default to GET)
  const method = (reqObj.method?.toUpperCase() || 'GET') as SavedRequest['method'];

  const savedRequest: SavedRequest = {
    method,
    path: convertVariableSyntax(path),
    ...(headers.length > 0 && { headers: headers.map(convertVariableSyntax) }),
    ...(body && { body: convertVariableSyntax(body) }),
    ...(query.length > 0 && { query: query.map(convertVariableSyntax) }),
  };

  // Build tags from folder path - take first folder as tag
  const firstTag = context.folderPath.length > 0 ? context.folderPath[0] : undefined;

  const collectionItem: CollectionItem = {
    id,
    name: item.name,
    ...(typeof item.description === 'string' && { description: item.description }),
    request: savedRequest,
    ...(firstTag && { tags: [firstTag] }),
  };

  // Access _postman_id from the extended item if present
  const postmanId = (item as unknown as Record<string, unknown>)['_postman_id'];
  const sourceId = typeof postmanId === 'string' ? postmanId : undefined;

  return {
    id,
    name: item.name,
    method,
    path,
    headers: Object.fromEntries(headers.map((h) => [h.split(':')[0]?.trim() || '', h.split(':').slice(1).join(':').trim()])),
    body,
    queryParams: Object.fromEntries(query.map((q) => [q.split('=')[0] || '', q.split('=').slice(1).join('=')])),
    item: collectionItem,
    sourceId,
    sourcePath: context.folderPath.length > 0 ? context.folderPath.join('/') : undefined,
  };
}

/**
 * Parse a raw URL string as a simple GET request
 */
function parseRawRequest(url: string): PostmanRequest {
  return {
    method: 'GET',
    url: { raw: url },
  };
}

/**
 * Extract path and query parameters from Postman URL
 */
function extractUrlComponents(url: PostmanRequest['url'], baseUrl: string): { path: string; query: string[] } {
  if (!url) {
    return { path: '/', query: [] };
  }

  // Handle string URL
  if (typeof url === 'string') {
    return parseUrlString(url, baseUrl);
  }

  // Build path from URL object
  let path: string;

  if (url.path) {
    // Use path array
    const pathStr = Array.isArray(url.path) ? url.path.join('/') : url.path;
    path = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
  } else if (url.raw) {
    // Parse from raw URL
    const parsed = parseUrlString(url.raw, baseUrl);
    path = parsed.path;
  } else {
    path = '/';
  }

  // Extract query parameters
  const query: string[] = [];
  if (url.query) {
    for (const param of url.query) {
      if (param.disabled) continue;
      const key = param.key || '';
      const value = param.value ?? '';
      query.push(`${key}=${value}`);
    }
  }

  return { path, query };
}

/**
 * Parse a raw URL string to extract path and query
 */
function parseUrlString(rawUrl: string, _baseUrl: string): { path: string; query: string[] } {
  try {
    // Handle Postman variable in URL
    let urlToParse = rawUrl;

    // If URL is just a path (starts with /), prepend base
    if (rawUrl.startsWith('/')) {
      urlToParse = `http://placeholder${rawUrl}`;
    } else if (!rawUrl.match(/^https?:\/\//i) && !rawUrl.startsWith('{{')) {
      // Relative path without protocol
      urlToParse = `http://placeholder/${rawUrl}`;
    } else if (rawUrl.startsWith('{{')) {
      // Variable-based URL like {{baseUrl}}/path
      // Extract the path part after the variable
      const match = rawUrl.match(/^{{[^}]+}}(.*)$/);
      if (match?.[1]) {
        const pathPart = match[1];
        const pathBeforeQuery = pathPart.split('?')[0] || '';
        return {
          path: pathBeforeQuery.startsWith('/') ? pathBeforeQuery : `/${pathBeforeQuery}`,
          query: extractQueryFromString(rawUrl),
        };
      }
      return { path: '/', query: [] };
    }

    const parsed = new URL(urlToParse);
    const path = parsed.pathname || '/';
    const query: string[] = [];

    parsed.searchParams.forEach((value, key) => {
      query.push(`${key}=${value}`);
    });

    return { path, query };
  } catch {
    // Fallback: try to extract path manually
    const pathMatch = rawUrl.match(/^(?:https?:\/\/[^/]+)?(\/.*)$/);
    if (pathMatch?.[1]) {
      const pathWithQuery = pathMatch[1].split('?')[0] || '/';
      return {
        path: pathWithQuery,
        query: extractQueryFromString(rawUrl),
      };
    }
    return { path: '/', query: [] };
  }
}

/**
 * Extract query string parameters from a raw URL
 */
function extractQueryFromString(url: string): string[] {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return [];

  const queryString = url.substring(queryStart + 1);
  const query: string[] = [];

  for (const part of queryString.split('&')) {
    if (part) {
      const [key, ...valueParts] = part.split('=');
      const value = valueParts.join('=');
      query.push(`${key}=${value}`);
    }
  }

  return query;
}

/**
 * Convert Postman headers to unireq format
 */
function convertHeaders(headers: PostmanRequest['header']): string[] {
  if (!headers || !Array.isArray(headers)) {
    return [];
  }

  const result: string[] = [];
  for (const header of headers) {
    if (header.disabled) continue;
    const key = header.key || '';
    const value = header.value ?? '';
    result.push(`${key}: ${value}`);
  }
  return result;
}

/**
 * Convert Postman body to string
 */
function convertBody(body: PostmanRequest['body']): string | undefined {
  if (!body) return undefined;

  switch (body.mode) {
    case 'raw':
      return body.raw || undefined;

    case 'urlencoded':
      if (!body.urlencoded) return undefined;
      return body.urlencoded
        .filter((p) => !p.disabled)
        .map((p) => `${encodeURIComponent(p.key || '')}=${encodeURIComponent(p.value ?? '')}`)
        .join('&');

    case 'formdata': {
      // Form data can't be represented as a string body easily
      // Convert to JSON representation with a warning
      if (!body.formdata) return undefined;
      const formObj: Record<string, string> = {};
      for (const p of body.formdata) {
        if (p.disabled || p.type === 'file') continue;
        formObj[p.key || ''] = p.value ?? '';
      }
      return JSON.stringify(formObj);
    }

    case 'graphql':
      // GraphQL body
      if (!body.graphql) return undefined;
      return JSON.stringify({
        query: body.graphql.query,
        ...(body.graphql.variables && { variables: body.graphql.variables }),
      });

    default:
      return undefined;
  }
}

/**
 * Convert Postman {{variable}} syntax to unireq ${variable} syntax
 */
export function convertVariableSyntax(text: string): string {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional replacement pattern for variable conversion
  return text.replace(/\{\{([^}]+)\}\}/g, '${$1}');
}

/**
 * Count Postman variables in the collection
 */
function countVariables(data: PostmanCollection): number {
  let count = 0;
  const variablePattern = /\{\{[^}]+\}\}/g;

  function countInString(str: string | undefined): void {
    if (str) {
      const matches = str.match(variablePattern);
      if (matches) count += matches.length;
    }
  }

  function countInRequest(request: PostmanRequest | string | undefined): void {
    if (!request) return;
    if (typeof request === 'string') {
      countInString(request);
      return;
    }

    // URL
    if (request.url) {
      if (typeof request.url === 'string') {
        countInString(request.url);
      } else {
        countInString(request.url.raw);
        request.url.query?.forEach((q) => {
          countInString(q.key);
          countInString(q.value);
        });
      }
    }

    // Headers
    request.header?.forEach((h) => {
      countInString(h.key);
      countInString(h.value);
    });

    // Body
    if (request.body) {
      countInString(request.body.raw);
      request.body.urlencoded?.forEach((p) => {
        countInString(p.key);
        countInString(p.value);
      });
      request.body.formdata?.forEach((p) => {
        countInString(p.key);
        countInString(p.value);
      });
    }
  }

  function countInItems(items: PostmanItem[]): void {
    for (const item of items) {
      countInRequest(item.request);
      if (item.item) {
        countInItems(item.item);
      }
    }
  }

  countInItems(data.item);
  return count;
}

/**
 * Extract version from Postman schema URL
 */
function extractVersion(schema: string): string {
  const match = schema.match(/v(\d+\.\d+\.\d+)/);
  return match?.[1] ?? '2.1.0';
}

/**
 * Convert a string to a valid ID (slug)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end
}
