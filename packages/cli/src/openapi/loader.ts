/**
 * OpenAPI Spec Loader
 * @module openapi/loader
 */

import { readFile } from 'node:fs/promises';
import { dereference } from '@scalar/openapi-parser';
import { consola } from 'consola';
import { parse as parseYaml } from 'yaml';
import { cacheFileSpec, getCachedFileSpec } from './cache/file-cache.js';
import { cacheUrlSpec, getCachedUrlSpec } from './cache/url-cache.js';
import { SpecLoadError, SpecNotFoundError, SpecParseError } from './errors.js';
import type { LoadedSpec, LoadOptions, OpenAPIDocument } from './types.js';
import { DEFAULT_LOAD_OPTIONS } from './types.js';
import { detectFormat, detectVersion, isSecureUrl, isUrl } from './utils.js';

/**
 * Parse content string into an object based on format
 * @param content - Raw content string
 * @param format - Format type ('json' or 'yaml')
 * @param source - Source path for error messages
 * @returns Parsed object
 * @throws SpecParseError on parse failure
 */
function parseContent(content: string, format: 'json' | 'yaml', source: string): unknown {
  try {
    if (format === 'json') {
      return JSON.parse(content);
    }
    return parseYaml(content);
  } catch (error: unknown) {
    const err = error as { message?: string; linePos?: Array<{ line: number; col: number }> };
    const lineInfo = err.linePos?.[0];
    throw new SpecParseError(
      source,
      `invalid ${format.toUpperCase()} syntax: ${err.message || 'parse error'}`,
      lineInfo ? { line: lineInfo.line, column: lineInfo.col } : undefined,
    );
  }
}

/**
 * Process parsed content: detect version and dereference
 * @param content - Raw content string (for dereferencing)
 * @param parsed - Parsed object (for version detection)
 * @param source - Source path for error messages
 * @returns LoadedSpec result
 * @throws SpecParseError on validation/dereference failure
 */
async function processSpec(content: string, parsed: unknown, source: string): Promise<LoadedSpec> {
  // Detect version
  let versionInfo: { version: LoadedSpec['version']; versionFull: string };
  try {
    versionInfo = detectVersion(parsed);
  } catch (error: unknown) {
    const err = error as { message?: string };
    throw new SpecParseError(source, err.message || 'not a valid OpenAPI specification');
  }

  // Dereference $refs
  let document: OpenAPIDocument;
  try {
    const result = await dereference(content, {
      throwOnError: true,
    });
    document = result.schema as OpenAPIDocument;
  } catch (error: unknown) {
    const err = error as { message?: string };
    throw new SpecParseError(source, `failed to resolve references: ${err.message || 'unknown error'}`);
  }

  return {
    version: versionInfo.version,
    versionFull: versionInfo.versionFull,
    source,
    document,
  };
}

/**
 * Load and parse an OpenAPI specification from file or URL
 * @param source - File path or URL to the spec
 * @param options - Load options
 * @returns Parsed and dereferenced spec
 * @throws SpecNotFoundError if source not found
 * @throws SpecLoadError if network/IO error
 * @throws SpecParseError if content is invalid
 */
export async function loadSpec(source: string, options?: LoadOptions): Promise<LoadedSpec> {
  const opts = { ...DEFAULT_LOAD_OPTIONS, ...options };
  const workspace = opts.workspace || undefined;

  if (isUrl(source)) {
    return loadFromUrl(source, opts, workspace);
  }
  return loadFromFile(source, opts, workspace);
}

/**
 * Load spec from local file
 */
async function loadFromFile(source: string, opts: Required<LoadOptions>, workspace?: string): Promise<LoadedSpec> {
  // Try cache first (unless disabled)
  if (!opts.noCache) {
    try {
      const cached = await getCachedFileSpec(source, workspace);
      if (cached) {
        consola.debug(`Using cached spec for ${source}`);
        return cached;
      }
    } catch (error: unknown) {
      // Cache error - continue without cache
      consola.debug(`Cache read error: ${(error as Error).message}`);
    }
  }

  // Read file content
  let content: string;
  try {
    content = await readFile(source, 'utf-8');
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new SpecNotFoundError(source);
    }
    if (err.code === 'EACCES') {
      throw new SpecLoadError(source, 'permission denied', err);
    }
    throw new SpecLoadError(source, err.message || 'failed to read file', err);
  }

  // Check for empty file
  if (!content.trim()) {
    throw new SpecParseError(source, 'file is empty');
  }

  // Parse and process
  const format = detectFormat(source);
  const parsed = parseContent(content, format, source);
  const spec = await processSpec(content, parsed, source);

  // Cache the result (unless disabled)
  if (!opts.noCache) {
    try {
      await cacheFileSpec(source, spec, workspace);
    } catch (error: unknown) {
      // Cache write error - continue without caching
      consola.debug(`Cache write error: ${(error as Error).message}`);
    }
  }

  return spec;
}

/**
 * Load spec from URL
 */
async function loadFromUrl(source: string, opts: Required<LoadOptions>, workspace?: string): Promise<LoadedSpec> {
  // Security check: require HTTPS unless localhost
  if (!isSecureUrl(source, opts.allowInsecureLocalhost)) {
    throw new SpecLoadError(source, 'HTTPS required for remote URLs (HTTP allowed only for localhost)');
  }

  // Try cache first (unless disabled)
  if (!opts.noCache) {
    try {
      const cached = await getCachedUrlSpec(source, workspace);
      if (cached) {
        consola.debug(`Using cached spec for ${source}`);
        return cached;
      }
    } catch (error: unknown) {
      // Cache error - continue without cache
      consola.debug(`Cache read error: ${(error as Error).message}`);
    }
  }

  // Fetch with timeout
  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

    response = await fetch(source, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/yaml, application/x-yaml, text/yaml, text/plain',
      },
    });

    clearTimeout(timeoutId);
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === 'AbortError') {
      throw new SpecLoadError(source, `timeout after ${opts.timeout}ms`);
    }
    throw new SpecLoadError(source, err.message || 'network error', error as Error);
  }

  // Check response status
  if (response.status === 404) {
    throw new SpecNotFoundError(source, 'HTTP 404');
  }
  if (!response.ok) {
    throw new SpecLoadError(source, `HTTP ${response.status} ${response.statusText}`);
  }

  // Get content
  let content: string;
  try {
    content = await response.text();
  } catch (error: unknown) {
    const err = error as { message?: string };
    throw new SpecLoadError(source, `failed to read response: ${err.message || 'unknown error'}`);
  }

  // Check for empty content
  if (!content.trim()) {
    throw new SpecParseError(source, 'response body is empty');
  }

  // Parse and process using shared helpers
  const contentType = response.headers.get('content-type') || '';
  const format = contentType.includes('json') ? 'json' : detectFormat(source);
  const parsed = parseContent(content, format, source);
  const spec = await processSpec(content, parsed, source);

  // Cache the result (unless disabled)
  if (!opts.noCache) {
    try {
      await cacheUrlSpec(source, spec, response.headers, workspace);
    } catch (error: unknown) {
      // Cache write error - continue without caching
      consola.debug(`Cache write error: ${(error as Error).message}`);
    }
  }

  return spec;
}
