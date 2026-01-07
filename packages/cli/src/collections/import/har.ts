/**
 * HAR 1.2 Importer
 * Converts HTTP Archive files to unireq format
 */

import type { Collection, CollectionItem, SavedRequest } from '../types.js';
import { slugify } from './postman.js';
import type { HarArchive, HarEntry, HarRequest, ImportedCollection, ImportedItem } from './types.js';

/**
 * Import options for HAR archives
 */
export interface HarImportOptions {
  /** Base URL to strip from paths (e.g., 'https://api.example.com') */
  baseUrl?: string;
  /** Only include requests to this domain (e.g., 'api.example.com') */
  filterDomain?: string;
  /** Prefix for generated IDs (default: '') */
  idPrefix?: string;
  /** Skip static assets like images, fonts, scripts, styles (default: true) */
  skipStatic?: boolean;
  /** Collection name (default: 'HAR Import') */
  collectionName?: string;
}

/** MIME types considered as static assets */
const STATIC_MIME_TYPES = [
  'image/',
  'font/',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'application/font',
];

/** File extensions considered as static assets */
const STATIC_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.map',
];

/**
 * Convert HAR archive to unireq format
 *
 * @param data - Validated HAR archive data
 * @param options - Import options
 * @returns Imported collection with metadata
 */
export function importHarArchive(data: HarArchive, options: HarImportOptions = {}): ImportedCollection {
  const { baseUrl = '', filterDomain, idPrefix = '', skipStatic = true, collectionName = 'HAR Import' } = options;

  const items: ImportedItem[] = [];
  const warnings: string[] = [];
  let skippedStatic = 0;
  let skippedDomain = 0;

  // Track used IDs for deduplication
  const usedIds = new Set<string>();

  for (const entry of data.log.entries) {
    const request = entry.request;

    // Check if we should filter by domain
    if (filterDomain && !matchesDomain(request.url, filterDomain)) {
      skippedDomain++;
      continue;
    }

    // Check if this is a static asset
    if (skipStatic && isStaticAsset(request.url, entry.response?.content?.mimeType)) {
      skippedStatic++;
      continue;
    }

    try {
      const converted = convertHarEntry(entry, {
        baseUrl,
        idPrefix,
        usedIds,
      });
      items.push(converted);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      warnings.push(`Skipped request to "${request.url}": ${errorMessage}`);
    }
  }

  // Add warnings for skipped entries
  if (skippedStatic > 0) {
    warnings.push(`Skipped ${skippedStatic} static asset(s) (images, scripts, styles, fonts).`);
  }
  if (skippedDomain > 0) {
    warnings.push(`Skipped ${skippedDomain} request(s) not matching domain filter "${filterDomain}".`);
  }

  // Add creator info
  const creatorInfo = data.log.creator;
  if (creatorInfo) {
    warnings.push(`Imported from: ${creatorInfo.name} v${creatorInfo.version}`);
  }

  const collectionId = slugify(collectionName);

  const collection: Collection = {
    id: collectionId,
    name: collectionName,
    description: `Imported from HAR archive (${data.log.entries.length} entries)`,
    items: items.map((i) => i.item),
  };

  return {
    format: 'har',
    version: data.log.version,
    collections: [collection],
    items,
    warnings,
    stats: {
      totalItems: data.log.entries.length,
      convertedItems: items.length,
      skippedItems: data.log.entries.length - items.length,
    },
  };
}

/**
 * Check if a URL matches a domain filter
 */
function matchesDomain(url: string, domain: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

/**
 * Check if a request is for a static asset
 */
function isStaticAsset(url: string, mimeType?: string): boolean {
  // Check MIME type
  if (mimeType) {
    for (const staticMime of STATIC_MIME_TYPES) {
      if (mimeType.startsWith(staticMime)) {
        return true;
      }
    }
  }

  // Check file extension
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    for (const ext of STATIC_EXTENSIONS) {
      if (pathname.endsWith(ext)) {
        return true;
      }
    }
  } catch {
    // If URL parsing fails, check the raw URL
    const lowerUrl = url.toLowerCase();
    for (const ext of STATIC_EXTENSIONS) {
      if (lowerUrl.includes(ext)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Context for entry conversion
 */
interface ConvertContext {
  baseUrl: string;
  idPrefix: string;
  usedIds: Set<string>;
}

/**
 * Convert a single HAR entry to unireq format
 */
function convertHarEntry(entry: HarEntry, context: ConvertContext): ImportedItem {
  const request = entry.request;

  // Extract URL components
  const { path, query } = extractUrlComponents(request.url, context.baseUrl);

  // Generate unique ID
  const baseId = generateId(request.method, path, context.idPrefix);
  const id = makeUniqueId(baseId, context.usedIds);
  context.usedIds.add(id);

  // Generate name from method and path
  const name = generateName(request.method, path);

  // Convert headers (exclude standard browser headers)
  const headers = convertHeaders(request.headers);

  // Convert body
  const body = convertBody(request.postData);

  // Build saved request
  const method = (request.method.toUpperCase() || 'GET') as SavedRequest['method'];

  const savedRequest: SavedRequest = {
    method,
    path,
    ...(headers.length > 0 && { headers }),
    ...(body && { body }),
    ...(query.length > 0 && { query }),
  };

  const collectionItem: CollectionItem = {
    id,
    name,
    request: savedRequest,
  };

  return {
    id,
    name,
    method,
    path,
    headers: Object.fromEntries(
      headers.map((h) => [h.split(':')[0]?.trim() || '', h.split(':').slice(1).join(':').trim()]),
    ),
    body,
    queryParams: Object.fromEntries(query.map((q) => [q.split('=')[0] || '', q.split('=').slice(1).join('=')])),
    item: collectionItem,
    sourceId: `${entry.startedDateTime}-${request.method}-${request.url}`,
    sourcePath: undefined,
  };
}

/**
 * Extract path and query from HAR URL
 */
function extractUrlComponents(
  url: string,
  baseUrl: string,
): {
  path: string;
  query: string[];
} {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname || '/';

    // Strip baseUrl if provided
    if (baseUrl) {
      try {
        const baseParsed = new URL(baseUrl);
        if (parsed.hostname === baseParsed.hostname) {
          // Remove base path prefix if present
          if (baseParsed.pathname !== '/' && path.startsWith(baseParsed.pathname)) {
            path = path.slice(baseParsed.pathname.length) || '/';
          }
        }
      } catch {
        // Invalid baseUrl, ignore
      }
    }

    // Convert query params
    const query: string[] = [];
    parsed.searchParams.forEach((value, key) => {
      query.push(`${key}=${value}`);
    });

    return { path, query };
  } catch {
    return { path: '/', query: [] };
  }
}

/**
 * Generate a slug ID from method and path
 */
function generateId(method: string, path: string, prefix: string): string {
  const methodSlug = method.toLowerCase();
  const pathSlug = slugify(path.replace(/^\//, '').replace(/\//g, '-')) || 'root';

  return prefix ? `${prefix}-${methodSlug}-${pathSlug}` : `${methodSlug}-${pathSlug}`;
}

/**
 * Make an ID unique by appending a suffix if needed
 */
function makeUniqueId(baseId: string, usedIds: Set<string>): string {
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  while (usedIds.has(`${baseId}-${counter}`)) {
    counter++;
  }
  return `${baseId}-${counter}`;
}

/**
 * Generate a human-readable name from method and path
 */
function generateName(method: string, path: string): string {
  const methodUpper = method.toUpperCase();
  const pathPart = path === '/' ? 'root' : path;
  return `${methodUpper} ${pathPart}`;
}

/** Headers to exclude from conversion (browser-added) */
const EXCLUDED_HEADERS = new Set([
  'accept-encoding',
  'accept-language',
  'cache-control',
  'connection',
  'cookie',
  'host',
  'origin',
  'pragma',
  'referer',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
  'upgrade-insecure-requests',
  'user-agent',
]);

/**
 * Convert HAR headers to unireq format
 */
function convertHeaders(headers: HarRequest['headers']): string[] {
  if (!headers || !Array.isArray(headers)) {
    return [];
  }

  const result: string[] = [];
  for (const header of headers) {
    const name = header.name || '';
    const lowerName = name.toLowerCase();

    // Skip excluded headers
    if (EXCLUDED_HEADERS.has(lowerName)) {
      continue;
    }

    const value = header.value ?? '';
    result.push(`${name}: ${value}`);
  }
  return result;
}

/**
 * Convert HAR postData to string body
 */
function convertBody(postData: HarRequest['postData']): string | undefined {
  if (!postData) return undefined;

  // If we have text content, use it directly
  if (postData.text) {
    return postData.text;
  }

  // If we have form params, encode them
  if (postData.params && Array.isArray(postData.params) && postData.params.length > 0) {
    const mimeType = postData.mimeType || '';

    if (mimeType.includes('application/x-www-form-urlencoded')) {
      return postData.params
        .map((p) => `${encodeURIComponent(p.name || '')}=${encodeURIComponent(p.value ?? '')}`)
        .join('&');
    }

    // For other types, try to build JSON
    if (mimeType.includes('json') || mimeType.includes('multipart')) {
      const obj: Record<string, string> = {};
      for (const param of postData.params) {
        if (param.name) {
          obj[param.name] = param.value ?? '';
        }
      }
      return JSON.stringify(obj);
    }
  }

  return undefined;
}
