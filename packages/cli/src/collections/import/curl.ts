/**
 * cURL Command Importer
 * Parses cURL commands and converts to unireq format
 *
 * Supports common cURL flags:
 * - -X/--request: HTTP method
 * - -H/--header: Request headers
 * - -d/--data/--data-raw/--data-binary/--data-urlencode: Request body
 * - -F/--form: Form data (multipart)
 * - -u/--user: Basic auth (converted to header)
 * - -A/--user-agent: User-Agent header
 * - -e/--referer: Referer header
 * - -b/--cookie: Cookie header
 * - -L/--location: Follow redirects (noted in warning)
 * - -k/--insecure: Ignore SSL (noted in warning)
 * - --compressed: Accept-Encoding (noted in warning)
 */

import type { Collection, CollectionItem, SavedRequest } from '../types.js';
import { slugify } from './postman.js';
import type { ImportedCollection, ImportedItem } from './types.js';
import { ImportError } from './types.js';

/**
 * Import options for cURL commands
 */
export interface CurlImportOptions {
  /** Collection name (default: 'cURL Import') */
  collectionName?: string;
  /** Prefix for generated IDs (default: '') */
  idPrefix?: string;
  /** Request name (default: derived from URL path) */
  requestName?: string;
}

/**
 * Parsed cURL command components
 */
export interface ParsedCurl {
  url: string;
  method: string;
  headers: Array<{ name: string; value: string }>;
  data?: string;
  formData?: Array<{ name: string; value: string; type: 'text' | 'file' }>;
  basicAuth?: { user: string; password: string };
  flags: {
    location: boolean;
    insecure: boolean;
    compressed: boolean;
  };
}

/**
 * Parse a cURL command string into components
 *
 * @param command - cURL command string (may include 'curl' prefix)
 * @returns Parsed cURL components
 * @throws ImportError if command is invalid
 */
export function parseCurlCommand(command: string): ParsedCurl {
  const tokens = tokenize(command);

  if (tokens.length === 0) {
    throw new ImportError('INVALID_JSON', 'Empty cURL command');
  }

  // Skip 'curl' if present
  let startIndex = 0;
  if (tokens[0]?.toLowerCase() === 'curl') {
    startIndex = 1;
  }

  const result: ParsedCurl = {
    url: '',
    method: 'GET',
    headers: [],
    flags: {
      location: false,
      insecure: false,
      compressed: false,
    },
  };

  const dataChunks: string[] = [];
  let i = startIndex;

  while (i < tokens.length) {
    const token = tokens[i];
    if (!token) {
      i++;
      continue;
    }

    // Check for flags
    if (token.startsWith('-')) {
      const flag = normalizeFlag(token);
      const nextToken = tokens[i + 1];

      switch (flag) {
        case '-X':
        case '--request':
          if (nextToken) {
            result.method = nextToken.toUpperCase();
            i += 2;
          } else {
            throw new ImportError('INVALID_JSON', `Missing value for ${token}`);
          }
          break;

        case '-H':
        case '--header':
          if (nextToken) {
            const header = parseHeader(nextToken);
            if (header) {
              result.headers.push(header);
            }
            i += 2;
          } else {
            throw new ImportError('INVALID_JSON', `Missing value for ${token}`);
          }
          break;

        case '-d':
        case '--data':
        case '--data-raw':
        case '--data-binary':
          if (nextToken) {
            dataChunks.push(nextToken);
            i += 2;
          } else {
            throw new ImportError('INVALID_JSON', `Missing value for ${token}`);
          }
          break;

        case '--data-urlencode':
          if (nextToken) {
            // URL-encode the value
            const encoded = encodeDataUrlencode(nextToken);
            dataChunks.push(encoded);
            i += 2;
          } else {
            throw new ImportError('INVALID_JSON', `Missing value for ${token}`);
          }
          break;

        case '-F':
        case '--form':
          if (nextToken) {
            const formField = parseFormField(nextToken);
            if (!result.formData) {
              result.formData = [];
            }
            result.formData.push(formField);
            i += 2;
          } else {
            throw new ImportError('INVALID_JSON', `Missing value for ${token}`);
          }
          break;

        case '-u':
        case '--user':
          if (nextToken) {
            result.basicAuth = parseBasicAuth(nextToken);
            i += 2;
          } else {
            throw new ImportError('INVALID_JSON', `Missing value for ${token}`);
          }
          break;

        case '-A':
        case '--user-agent':
          if (nextToken) {
            result.headers.push({ name: 'User-Agent', value: nextToken });
            i += 2;
          } else {
            throw new ImportError('INVALID_JSON', `Missing value for ${token}`);
          }
          break;

        case '-e':
        case '--referer':
          if (nextToken) {
            result.headers.push({ name: 'Referer', value: nextToken });
            i += 2;
          } else {
            throw new ImportError('INVALID_JSON', `Missing value for ${token}`);
          }
          break;

        case '-b':
        case '--cookie':
          if (nextToken) {
            result.headers.push({ name: 'Cookie', value: nextToken });
            i += 2;
          } else {
            throw new ImportError('INVALID_JSON', `Missing value for ${token}`);
          }
          break;

        case '-L':
        case '--location':
          result.flags.location = true;
          i += 1;
          break;

        case '-k':
        case '--insecure':
          result.flags.insecure = true;
          i += 1;
          break;

        case '--compressed':
          result.flags.compressed = true;
          i += 1;
          break;

        // Flags with required values that we ignore but need to skip
        case '-o':
        case '--output':
        case '-O':
        case '--remote-name':
        case '--connect-timeout':
        case '-m':
        case '--max-time':
        case '--retry':
        case '-w':
        case '--write-out':
        case '-c':
        case '--cookie-jar':
        case '--cacert':
        case '--cert':
        case '--key':
        case '-x':
        case '--proxy':
          // Skip flag and its value
          i += 2;
          break;

        // Flags without values that we ignore
        case '-s':
        case '--silent':
        case '-S':
        case '--show-error':
        case '-v':
        case '--verbose':
        case '-i':
        case '--include':
        case '-I':
        case '--head':
        case '-g':
        case '--globoff':
          i += 1;
          break;

        default:
          // Unknown flag - might be combined short flags like -sS
          if (token.startsWith('-') && !token.startsWith('--') && token.length > 2) {
            // Expand combined flags
            i += 1;
          } else {
            // Skip unknown flag
            i += 1;
          }
      }
    } else if (!result.url && isUrl(token)) {
      // URL (first non-flag token that looks like a URL)
      result.url = token;
      i += 1;
    } else {
      // Unknown positional argument - might be URL
      if (!result.url) {
        result.url = token;
      }
      i += 1;
    }
  }

  // Validate URL was found
  if (!result.url) {
    throw new ImportError('INVALID_JSON', 'No URL found in cURL command');
  }

  // Combine data chunks
  if (dataChunks.length > 0) {
    result.data = dataChunks.join('&');
    // If data is present and method is GET, change to POST
    if (result.method === 'GET') {
      result.method = 'POST';
    }
  }

  // If form data is present and method is GET, change to POST
  if (result.formData && result.formData.length > 0 && result.method === 'GET') {
    result.method = 'POST';
  }

  // Add basic auth header if present
  if (result.basicAuth) {
    const credentials = btoa(`${result.basicAuth.user}:${result.basicAuth.password}`);
    result.headers.push({ name: 'Authorization', value: `Basic ${credentials}` });
  }

  return result;
}

/**
 * Tokenize a cURL command string
 * Handles quoted strings and escape sequences
 */
function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  let i = 0;

  // Normalize line continuations (backslash followed by newline)
  const normalized = command
    .replace(/\\\n\s*/g, ' ')
    .replace(/\\\r\n\s*/g, ' ')
    .trim();

  while (i < normalized.length) {
    const char = normalized[i];
    if (!char) {
      i++;
      continue;
    }
    const nextChar = normalized[i + 1];

    if (escaped) {
      current += char;
      escaped = false;
      i++;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      if (nextChar === "'" || nextChar === '"' || nextChar === '\\' || nextChar === ' ') {
        escaped = true;
        i++;
        continue;
      }
      current += char;
      i++;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      i++;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      i++;
      continue;
    }

    if ((char === ' ' || char === '\t' || char === '\n') && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Normalize a flag (handle =value syntax)
 */
function normalizeFlag(token: string): string {
  const eqIndex = token.indexOf('=');
  if (eqIndex > 0) {
    return token.slice(0, eqIndex);
  }
  return token;
}

/**
 * Parse a header string (name: value)
 */
function parseHeader(headerStr: string): { name: string; value: string } | null {
  const colonIndex = headerStr.indexOf(':');
  if (colonIndex <= 0) {
    return null;
  }

  const name = headerStr.slice(0, colonIndex).trim();
  const value = headerStr.slice(colonIndex + 1).trim();

  return { name, value };
}

/**
 * Parse basic auth string (user:password)
 */
function parseBasicAuth(authStr: string): { user: string; password: string } {
  const colonIndex = authStr.indexOf(':');
  if (colonIndex === -1) {
    return { user: authStr, password: '' };
  }

  return {
    user: authStr.slice(0, colonIndex),
    password: authStr.slice(colonIndex + 1),
  };
}

/**
 * Parse form field (name=value or name=@file)
 */
function parseFormField(fieldStr: string): { name: string; value: string; type: 'text' | 'file' } {
  const eqIndex = fieldStr.indexOf('=');
  if (eqIndex <= 0) {
    return { name: fieldStr, value: '', type: 'text' };
  }

  const name = fieldStr.slice(0, eqIndex);
  const value = fieldStr.slice(eqIndex + 1);

  if (value.startsWith('@')) {
    return { name, value: value.slice(1), type: 'file' };
  }

  return { name, value, type: 'text' };
}

/**
 * Encode data for --data-urlencode
 */
function encodeDataUrlencode(str: string): string {
  const eqIndex = str.indexOf('=');
  if (eqIndex === -1) {
    // Entire string is URL-encoded
    return encodeURIComponent(str);
  }

  // name=value - encode the value
  const name = str.slice(0, eqIndex);
  const value = str.slice(eqIndex + 1);
  return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
}

/**
 * Check if a string looks like a URL
 */
function isUrl(str: string): boolean {
  return (
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.startsWith('//') ||
    // Variable URLs like {{baseUrl}}/path or ${baseUrl}/path
    str.includes('{{') ||
    str.includes('${')
  );
}

/**
 * Import a cURL command into unireq format
 *
 * @param command - cURL command string
 * @param options - Import options
 * @returns Imported collection with metadata
 */
export function importCurlCommand(command: string, options: CurlImportOptions = {}): ImportedCollection {
  const { collectionName = 'cURL Import', idPrefix = '', requestName } = options;

  const parsed = parseCurlCommand(command);
  const warnings: string[] = [];

  // Extract URL components
  const { path, query, host } = extractUrlComponents(parsed.url);

  // Generate name from method and path if not provided
  const name = requestName || generateName(parsed.method, path);

  // Generate ID
  const baseId = generateId(parsed.method, path, idPrefix);

  // Convert headers
  const headers: string[] = parsed.headers.map((h) => `${h.name}: ${h.value}`);

  // Build body
  let body: string | undefined;
  if (parsed.data) {
    body = parsed.data;
  } else if (parsed.formData && parsed.formData.length > 0) {
    // Convert form data to JSON for now (multipart not fully supported)
    const formObj: Record<string, string> = {};
    for (const field of parsed.formData) {
      if (field.type === 'text') {
        formObj[field.name] = field.value;
      } else {
        warnings.push(`File upload field "${field.name}" (${field.value}) cannot be imported. Use manual upload.`);
      }
    }
    body = JSON.stringify(formObj);
    // Add Content-Type if not present
    if (!headers.some((h) => h.toLowerCase().startsWith('content-type:'))) {
      headers.push('Content-Type: application/json');
    }
  }

  // Add warnings for ignored flags
  if (parsed.flags.location) {
    warnings.push('Flag -L/--location (follow redirects) is ignored. unireq always follows redirects.');
  }
  if (parsed.flags.insecure) {
    warnings.push('Flag -k/--insecure (skip SSL verification) is not supported for security reasons.');
  }
  if (parsed.flags.compressed) {
    warnings.push('Flag --compressed is ignored. Compression is handled automatically.');
  }

  // Build saved request
  const method = parsed.method as SavedRequest['method'];

  const savedRequest: SavedRequest = {
    method,
    path,
    ...(headers.length > 0 && { headers }),
    ...(body && { body }),
    ...(query.length > 0 && { query }),
  };

  const collectionItem: CollectionItem = {
    id: baseId,
    name,
    request: savedRequest,
  };

  const importedItem: ImportedItem = {
    id: baseId,
    name,
    method,
    path,
    headers: Object.fromEntries(parsed.headers.map((h) => [h.name, h.value])),
    body,
    queryParams: Object.fromEntries(query.map((q) => [q.split('=')[0] || '', q.split('=').slice(1).join('=')])),
    item: collectionItem,
    sourceId: `curl-${Date.now()}`,
  };

  const collectionId = slugify(collectionName);

  const collection: Collection = {
    id: collectionId,
    name: collectionName,
    description: host ? `Imported from cURL (${host})` : 'Imported from cURL command',
    items: [collectionItem],
  };

  return {
    format: 'curl',
    version: '1.0',
    collections: [collection],
    items: [importedItem],
    warnings,
    stats: {
      totalItems: 1,
      convertedItems: 1,
      skippedItems: 0,
    },
  };
}

/**
 * Extract URL components
 */
function extractUrlComponents(url: string): { path: string; query: string[]; host: string } {
  try {
    // Handle variable URLs
    if (url.includes('{{') || url.includes('${')) {
      // Extract path portion after variable
      const match = url.match(/(?:{{[^}]+}}|\${[^}]+})(.*)$/);
      if (match?.[1]) {
        const pathPart = match[1];
        const [pathWithoutQuery, queryString] = pathPart.split('?');
        return {
          path: pathWithoutQuery || '/',
          query: queryString ? queryString.split('&') : [],
          host: '',
        };
      }
      return { path: '/', query: [], host: '' };
    }

    const parsed = new URL(url);
    const query: string[] = [];

    parsed.searchParams.forEach((value, key) => {
      query.push(`${key}=${value}`);
    });

    return {
      path: parsed.pathname || '/',
      query,
      host: parsed.host,
    };
  } catch {
    // If URL parsing fails, treat as path
    const [pathPart, queryString] = url.split('?');
    return {
      path: pathPart || '/',
      query: queryString ? queryString.split('&') : [],
      host: '',
    };
  }
}

/**
 * Generate a name from method and path
 */
function generateName(method: string, path: string): string {
  const pathPart = path === '/' ? 'root' : path;
  return `${method.toUpperCase()} ${pathPart}`;
}

/**
 * Generate an ID from method and path
 */
function generateId(method: string, path: string, prefix: string): string {
  const methodSlug = method.toLowerCase();
  const pathSlug = slugify(path.replace(/^\//, '').replace(/\//g, '-')) || 'root';

  return prefix ? `${prefix}-${methodSlug}-${pathSlug}` : `${methodSlug}-${pathSlug}`;
}

/**
 * Check if input looks like a cURL command
 */
export function isCurlCommand(input: string): boolean {
  const trimmed = input.trim();
  // Must start with 'curl' (case-insensitive) or be a cURL-like command
  return trimmed.toLowerCase().startsWith('curl ') || trimmed.toLowerCase() === 'curl';
}
