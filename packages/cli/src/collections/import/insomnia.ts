/**
 * Insomnia v4 Export Importer
 * Converts Insomnia exports to unireq format
 */

import type { Collection, CollectionItem, SavedRequest } from '../types.js';
import { slugify } from './postman.js';
import type {
  ImportedCollection,
  ImportedItem,
  InsomniaExport,
  InsomniaRequest,
  InsomniaResourceUnion,
} from './types.js';

/**
 * Import options for Insomnia exports
 */
export interface InsomniaImportOptions {
  /** Base URL to use when request URL has no host (default: '') */
  baseUrl?: string;
  /** Prefix for generated IDs (default: '') */
  idPrefix?: string;
}

/**
 * Convert Insomnia export to unireq format
 *
 * @param data - Validated Insomnia export data
 * @param options - Import options
 * @returns Imported collection with metadata
 */
export function importInsomniaExport(data: InsomniaExport, options: InsomniaImportOptions = {}): ImportedCollection {
  const { baseUrl = '', idPrefix = '' } = options;

  // Build resource index for parent lookups
  const resourceIndex = buildResourceIndex(data.resources);

  // Find workspace(s) - these become collections
  const workspaces = data.resources.filter((r) => r._type === 'workspace');

  // If no workspaces, create a default one
  if (workspaces.length === 0) {
    workspaces.push({
      _id: 'default-workspace',
      _type: 'workspace',
      name: 'Imported Requests',
    });
  }

  const collections: Collection[] = [];
  const items: ImportedItem[] = [];
  const warnings: string[] = [];

  // Find all requests
  const requests = data.resources.filter((r) => r._type === 'request') as InsomniaRequest[];

  for (const workspace of workspaces) {
    const workspaceId = slugify(workspace.name || 'workspace');
    const workspaceName = workspace.name || 'Workspace';

    // Filter requests belonging to this workspace (directly or via request groups)
    const workspaceRequests = requests.filter((req) => {
      return isDescendantOf(req._id, workspace._id, resourceIndex);
    });

    const collectionItems: ImportedItem[] = [];

    for (const request of workspaceRequests) {
      try {
        const converted = convertInsomniaRequest(request, resourceIndex, {
          baseUrl,
          idPrefix,
          workspaceId,
        });
        collectionItems.push(converted);
        items.push(converted);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        warnings.push(`Skipped "${request.name}": ${errorMessage}`);
      }
    }

    collections.push({
      id: workspaceId,
      name: workspaceName,
      description: typeof workspace.description === 'string' ? workspace.description : undefined,
      items: collectionItems.map((i) => i.item),
    });
  }

  // Check for environment variables and warn
  const environments = data.resources.filter((r) => r._type === 'environment');
  if (environments.length > 0) {
    warnings.push(
      `Found ${environments.length} environment(s). Variables are not imported - define them in unireq profiles.`,
    );
  }

  // Check for variable usage and warn
  const variableCount = countVariables(data.resources);
  if (variableCount > 0) {
    warnings.push(`Found ${variableCount} Insomnia variable(s) using {{...}} syntax. Converted to \${...} syntax.`);
  }

  return {
    format: 'insomnia',
    version: String(data.__export_format),
    collections,
    items,
    warnings,
    stats: {
      totalItems: requests.length,
      convertedItems: items.length,
      skippedItems: requests.length - items.length,
    },
  };
}

/**
 * Build an index of resources by ID for quick lookups
 */
function buildResourceIndex(resources: InsomniaResourceUnion[]): Map<string, InsomniaResourceUnion> {
  const index = new Map<string, InsomniaResourceUnion>();
  for (const resource of resources) {
    index.set(resource._id, resource);
  }
  return index;
}

/**
 * Check if a resource is a descendant of a target resource
 */
function isDescendantOf(resourceId: string, targetId: string, index: Map<string, InsomniaResourceUnion>): boolean {
  let current = index.get(resourceId);

  while (current) {
    if (current.parentId === targetId) {
      return true;
    }
    if (!current.parentId) {
      return false;
    }
    current = index.get(current.parentId);
  }

  return false;
}

/**
 * Context for request conversion
 */
interface ConvertContext {
  baseUrl: string;
  idPrefix: string;
  workspaceId: string;
}

/**
 * Convert a single Insomnia request to unireq format
 */
function convertInsomniaRequest(
  request: InsomniaRequest,
  resourceIndex: Map<string, InsomniaResourceUnion>,
  context: ConvertContext,
): ImportedItem {
  // Build folder path from parent request groups
  const folderPath = buildFolderPath(request.parentId ?? undefined, resourceIndex);

  // Get request name with fallback
  const requestName = request.name || 'Unnamed Request';

  // Build ID from folder path + request name
  const pathPrefix = folderPath.length > 0 ? `${folderPath.map(slugify).join('-')}-` : '';
  const fullPrefix = context.idPrefix ? `${context.idPrefix}-${pathPrefix}` : pathPrefix;
  const id = `${fullPrefix}${slugify(requestName)}`;

  // Extract URL components
  const { path, query } = extractUrlComponents(request.url, context.baseUrl);

  // Convert headers
  const headers = convertHeaders(request.headers);

  // Convert body
  const body = convertBody(request.body);

  // Get method (default to GET)
  const method = (request.method?.toUpperCase() || 'GET') as SavedRequest['method'];

  const savedRequest: SavedRequest = {
    method,
    path: convertVariableSyntax(path),
    ...(headers.length > 0 && { headers: headers.map(convertVariableSyntax) }),
    ...(body && { body: convertVariableSyntax(body) }),
    ...(query.length > 0 && { query: query.map(convertVariableSyntax) }),
  };

  // Build tags from folder path - take first folder as tag
  const firstTag = folderPath.length > 0 ? folderPath[0] : undefined;

  const collectionItem: CollectionItem = {
    id,
    name: requestName,
    ...(typeof request.description === 'string' && { description: request.description }),
    request: savedRequest,
    ...(firstTag && { tags: [firstTag] }),
  };

  return {
    id,
    name: requestName,
    method,
    path,
    headers: Object.fromEntries(
      headers.map((h) => [h.split(':')[0]?.trim() || '', h.split(':').slice(1).join(':').trim()]),
    ),
    body,
    queryParams: Object.fromEntries(query.map((q) => [q.split('=')[0] || '', q.split('=').slice(1).join('=')])),
    item: collectionItem,
    sourceId: request._id,
    sourcePath: folderPath.length > 0 ? folderPath.join('/') : undefined,
  };
}

/**
 * Build the folder path by following parent request groups
 */
function buildFolderPath(parentId: string | undefined, index: Map<string, InsomniaResourceUnion>): string[] {
  const path: string[] = [];
  let currentId: string | undefined = parentId;

  while (currentId) {
    const parent = index.get(currentId);
    if (!parent || parent._type !== 'request_group') {
      break;
    }
    path.unshift(parent.name || 'Folder');
    currentId = parent.parentId ?? undefined;
  }

  return path;
}

/**
 * Extract path and query parameters from Insomnia URL
 */
function extractUrlComponents(url: string | undefined, _baseUrl: string): { path: string; query: string[] } {
  if (!url) {
    return { path: '/', query: [] };
  }

  try {
    // Handle Insomnia variable in URL
    let urlToParse = url;

    // If URL is just a path (starts with /), prepend base
    if (url.startsWith('/')) {
      urlToParse = `http://placeholder${url}`;
    } else if (!url.match(/^https?:\/\//i) && !url.startsWith('{{') && !url.startsWith('_.')) {
      // Relative path without protocol
      urlToParse = `http://placeholder/${url}`;
    } else if (url.startsWith('{{') || url.startsWith('_.')) {
      // Variable-based URL like {{baseUrl}}/path or _.baseUrl/path
      const match = url.match(/^(?:{{[^}]+}}|_\.[a-zA-Z0-9_]+)(.*)$/);
      if (match?.[1]) {
        const pathPart = match[1];
        const pathBeforeQuery = pathPart.split('?')[0] || '';
        return {
          path: pathBeforeQuery.startsWith('/') ? pathBeforeQuery : `/${pathBeforeQuery}`,
          query: extractQueryFromString(url),
        };
      }
      return { path: '/', query: [] };
    }

    const parsed = new URL(urlToParse);
    // Decode to preserve variable syntax like {{var}} that gets URL-encoded
    const path = decodeURIComponent(parsed.pathname) || '/';
    const query: string[] = [];

    parsed.searchParams.forEach((value, key) => {
      query.push(`${key}=${value}`);
    });

    return { path, query };
  } catch {
    // Fallback: try to extract path manually
    const pathMatch = url.match(/^(?:https?:\/\/[^/]+)?(\/.*)$/);
    if (pathMatch?.[1]) {
      const pathWithQuery = pathMatch[1].split('?')[0] || '/';
      return {
        path: pathWithQuery,
        query: extractQueryFromString(url),
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
 * Convert Insomnia headers to unireq format
 */
function convertHeaders(headers: InsomniaRequest['headers']): string[] {
  if (!headers || !Array.isArray(headers)) {
    return [];
  }

  const result: string[] = [];
  for (const header of headers) {
    if (header.disabled) continue;
    const key = header.name || '';
    const value = header.value ?? '';
    result.push(`${key}: ${value}`);
  }
  return result;
}

/**
 * Convert Insomnia body to string
 */
function convertBody(body: InsomniaRequest['body']): string | undefined {
  if (!body) return undefined;

  // Handle mimeType-based body detection
  const mimeType = body.mimeType || '';

  if (body.text) {
    // Raw text body
    return body.text;
  }

  if (body.params && Array.isArray(body.params)) {
    if (mimeType.includes('form-urlencoded')) {
      // URL encoded form
      return body.params
        .filter((p) => !p.disabled)
        .map((p) => `${encodeURIComponent(p.name || '')}=${encodeURIComponent(p.value ?? '')}`)
        .join('&');
    }

    if (mimeType.includes('multipart')) {
      // Multipart form - convert to JSON representation
      const formObj: Record<string, string> = {};
      for (const p of body.params) {
        if (p.disabled || p.type === 'file') continue;
        formObj[p.name || ''] = p.value ?? '';
      }
      return JSON.stringify(formObj);
    }
  }

  return undefined;
}

/**
 * Convert Insomnia {{variable}} and _.variable syntax to unireq ${variable} syntax
 */
export function convertVariableSyntax(text: string): string {
  // Convert {{variable}} to ${variable}
  // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional replacement pattern for variable conversion
  let result = text.replace(/\{\{([^}]+)\}\}/g, '${$1}');

  // Convert _.variable to ${variable} (Insomnia template tag syntax)
  // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional replacement pattern for variable conversion
  result = result.replace(/_\.([a-zA-Z0-9_]+)/g, '${$1}');

  return result;
}

/**
 * Count Insomnia variables in the resources
 */
function countVariables(resources: InsomniaResourceUnion[]): number {
  let count = 0;
  const variablePattern = /\{\{[^}]+\}\}|_\.[a-zA-Z0-9_]+/g;

  function countInString(str: string | undefined): void {
    if (str) {
      const matches = str.match(variablePattern);
      if (matches) count += matches.length;
    }
  }

  for (const resource of resources) {
    if (resource._type === 'request') {
      const req = resource as InsomniaRequest;
      countInString(req.url);
      req.headers?.forEach((h) => {
        countInString(h.name);
        countInString(h.value);
      });
      if (req.body) {
        countInString(req.body.text);
        req.body.params?.forEach((p) => {
          countInString(p.name);
          countInString(p.value);
        });
      }
    }
  }

  return count;
}
