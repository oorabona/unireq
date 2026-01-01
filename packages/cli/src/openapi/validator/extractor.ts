/**
 * OpenAPI Parameter Extractor
 * Extracts parameter values from request data
 * @module openapi/validator/extractor
 */

import type { OpenAPIOperation, OpenAPIParameter } from '../types.js';
import type { ExtractedParams, ResolvedParameter } from './types.js';
import { normalizePath } from './utils.js';

/**
 * Extract path parameters from URL by matching against path template
 * @param actualPath - The actual URL path (e.g., '/users/123')
 * @param pathTemplate - The OpenAPI path template (e.g., '/users/{id}')
 * @returns Map of parameter names to values
 */
export function extractPathParams(actualPath: string, pathTemplate: string): Map<string, string> {
  const result = new Map<string, string>();

  // Normalize paths (remove trailing slash, ensure leading slash)
  const normActual = normalizePath(actualPath);
  const normTemplate = normalizePath(pathTemplate);

  const actualSegments = normActual.split('/').filter(Boolean);
  const templateSegments = normTemplate.split('/').filter(Boolean);

  // If segment counts don't match, can't extract (may be a different path)
  if (actualSegments.length !== templateSegments.length) {
    return result;
  }

  for (let i = 0; i < templateSegments.length; i++) {
    const templateSeg = templateSegments[i];
    const actualSeg = actualSegments[i];

    if (!templateSeg || !actualSeg) continue;

    // Check if this is a path parameter (e.g., {id})
    const match = templateSeg.match(/^\{([^}]+)\}$/);
    if (match?.[1]) {
      result.set(match[1], actualSeg);
    }
  }

  return result;
}

/**
 * Extract query parameters from query string pairs
 * @param queryParams - Array of 'key=value' strings
 * @returns Map of parameter names to values
 */
export function extractQueryParams(queryParams: string[]): Map<string, string> {
  const result = new Map<string, string>();

  for (const param of queryParams) {
    const equalsIndex = param.indexOf('=');
    if (equalsIndex === -1) {
      // Key without value
      result.set(param.trim(), '');
    } else {
      const key = param.slice(0, equalsIndex).trim();
      const value = param.slice(equalsIndex + 1).trim();
      if (key) {
        result.set(key, value);
      }
    }
  }

  return result;
}

/**
 * Extract header parameters from header pairs
 * @param headerParams - Array of 'key:value' strings
 * @returns Map of parameter names to values (lowercase keys)
 */
export function extractHeaderParams(headerParams: string[]): Map<string, string> {
  const result = new Map<string, string>();

  for (const header of headerParams) {
    const colonIndex = header.indexOf(':');
    if (colonIndex === -1) continue;

    const key = header.slice(0, colonIndex).trim().toLowerCase();
    const value = header.slice(colonIndex + 1).trim();
    if (key) {
      result.set(key, value);
    }
  }

  return result;
}

/**
 * Extract all parameters from request data
 * @param actualPath - The actual URL path
 * @param pathTemplate - The OpenAPI path template
 * @param queryParams - Array of query string pairs
 * @param headerParams - Array of header pairs
 * @returns Extracted parameters by location
 */
export function extractAllParams(
  actualPath: string,
  pathTemplate: string,
  queryParams: string[],
  headerParams: string[],
): ExtractedParams {
  return {
    path: extractPathParams(actualPath, pathTemplate),
    query: extractQueryParams(queryParams),
    header: extractHeaderParams(headerParams),
  };
}

/**
 * Resolve OpenAPI parameters to a flat list with schemas
 * Handles both operation-level and path-level parameters
 * @param operation - OpenAPI operation object
 * @param pathParameters - Path-level parameters (from PathItem)
 * @returns Array of resolved parameters
 */
export function resolveParameters(
  operation: OpenAPIOperation,
  pathParameters?: OpenAPIParameter[],
): ResolvedParameter[] {
  const result: ResolvedParameter[] = [];
  const seen = new Set<string>();

  // Operation parameters take precedence over path parameters
  const allParams = [...(operation.parameters ?? []), ...(pathParameters ?? [])];

  for (const param of allParams) {
    // Skip if we've already seen this parameter (operation overrides path)
    const key = `${param.in}:${param.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Skip cookie parameters (not commonly used in CLI)
    if (param.in === 'cookie') continue;

    result.push({
      name: param.name,
      in: param.in as 'path' | 'query' | 'header',
      required: param.required ?? param.in === 'path', // Path params are implicitly required
      schema: param.schema,
      deprecated: param.deprecated,
    });
  }

  return result;
}
