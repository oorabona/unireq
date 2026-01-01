/**
 * OpenAPI Input Validator
 * Validates request parameters against OpenAPI specification
 * @module openapi/validator
 */

import type { OpenAPIDocument, OpenAPIOperation, OpenAPIParameter, OpenAPIRequestBody } from '../types.js';
import { extractAllParams, resolveParameters } from './extractor.js';
import type { ValidationResult, ValidationWarning, ValidatorContext } from './types.js';
import { normalizePath } from './utils.js';
import { validateParameter } from './validators.js';

// Re-export types
export type {
  ExtractedParams,
  ResolvedParameter,
  ValidationResult,
  ValidationWarning,
  ValidatorContext,
} from './types.js';

/**
 * Validate request body presence
 * @param requestBody - OpenAPI request body definition
 * @param hasBody - Whether body is provided
 * @returns Warning if required body is missing
 */
function validateRequestBody(
  requestBody: OpenAPIRequestBody | undefined,
  hasBody: boolean,
): ValidationWarning | undefined {
  if (!requestBody) return undefined;
  if (!requestBody.required) return undefined;
  if (hasBody) return undefined;

  return {
    severity: 'warning',
    location: 'body',
    param: 'body',
    message: 'Missing required request body',
  };
}

/**
 * Validate a request against an OpenAPI operation
 * @param context - Validation context with operation and request data
 * @returns Validation result with warnings
 */
export function validateRequest(context: ValidatorContext): ValidationResult {
  const warnings: ValidationWarning[] = [];

  // Extract parameters from request
  const extracted = extractAllParams(
    context.actualPath,
    context.pathTemplate,
    context.queryParams,
    context.headerParams,
  );

  // Resolve operation parameters
  const params = resolveParameters(context.operation);

  // Validate each parameter
  for (const param of params) {
    let value: string | undefined;

    switch (param.in) {
      case 'path':
        value = extracted.path.get(param.name);
        break;
      case 'query':
        value = extracted.query.get(param.name);
        break;
      case 'header':
        // Headers are case-insensitive
        value = extracted.header.get(param.name.toLowerCase());
        break;
    }

    const paramWarnings = validateParameter(param, value);
    warnings.push(...paramWarnings);
  }

  // Validate request body
  const bodyWarning = validateRequestBody(context.operation.requestBody, context.hasBody);
  if (bodyWarning) {
    warnings.push(bodyWarning);
  }

  return {
    warnings,
    skipped: false,
  };
}

/**
 * Find path template that matches the given URL
 * @param document - OpenAPI document
 * @param actualPath - Actual URL path
 * @returns Matching path template and path item, or undefined
 */
export function findMatchingPath(
  document: OpenAPIDocument,
  actualPath: string,
): { template: string; pathItem: Record<string, unknown>; pathParameters?: OpenAPIParameter[] } | undefined {
  if (!document.paths) return undefined;

  const normalizedActual = normalizePath(actualPath);
  const actualSegments = normalizedActual.split('/').filter(Boolean);

  for (const [template, pathItem] of Object.entries(document.paths)) {
    if (!pathItem) continue;

    const normalizedTemplate = normalizePath(template);
    const templateSegments = normalizedTemplate.split('/').filter(Boolean);

    // Quick check: segment count must match
    if (actualSegments.length !== templateSegments.length) continue;

    // Check if segments match
    let matches = true;
    for (let i = 0; i < templateSegments.length; i++) {
      const tSeg = templateSegments[i];
      const aSeg = actualSegments[i];

      if (!tSeg || !aSeg) {
        matches = false;
        break;
      }

      // Parameter segments match any value
      if (tSeg.startsWith('{') && tSeg.endsWith('}')) continue;

      // Literal segments must match exactly
      if (tSeg !== aSeg) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return {
        template,
        pathItem: pathItem as Record<string, unknown>,
        pathParameters: (pathItem as { parameters?: OpenAPIParameter[] }).parameters,
      };
    }
  }

  return undefined;
}

/**
 * Get operation from path item by method
 * @param pathItem - OpenAPI path item
 * @param method - HTTP method (lowercase)
 * @returns Operation if found
 */
export function getOperationFromPathItem(
  pathItem: Record<string, unknown>,
  method: string,
): OpenAPIOperation | undefined {
  const lowerMethod = method.toLowerCase();
  const operation = pathItem[lowerMethod];

  if (operation && typeof operation === 'object') {
    return operation as OpenAPIOperation;
  }

  return undefined;
}

/**
 * Full validation flow: find path, get operation, validate
 * @param document - OpenAPI document
 * @param method - HTTP method
 * @param actualPath - Actual URL path
 * @param queryParams - Query parameters
 * @param headerParams - Header parameters
 * @param hasBody - Whether body is provided
 * @returns Validation result
 */
export function validateRequestFull(
  document: OpenAPIDocument | undefined,
  method: string,
  actualPath: string,
  queryParams: string[],
  headerParams: string[],
  hasBody: boolean,
): ValidationResult {
  // No document loaded
  if (!document) {
    return {
      warnings: [],
      skipped: true,
      skipReason: 'No OpenAPI spec loaded',
    };
  }

  // Find matching path
  const pathMatch = findMatchingPath(document, actualPath);
  if (!pathMatch) {
    return {
      warnings: [],
      skipped: true,
      skipReason: 'Path not found in OpenAPI spec',
    };
  }

  // Get operation
  const operation = getOperationFromPathItem(pathMatch.pathItem, method);
  if (!operation) {
    return {
      warnings: [],
      skipped: true,
      skipReason: `Method ${method.toUpperCase()} not defined for this path`,
    };
  }

  // Merge path-level parameters into operation for validation
  if (pathMatch.pathParameters) {
    operation.parameters = [...(operation.parameters ?? []), ...pathMatch.pathParameters];
  }

  // Build context and validate
  const context: ValidatorContext = {
    operation,
    pathTemplate: pathMatch.template,
    actualPath,
    queryParams,
    headerParams,
    hasBody,
  };

  return validateRequest(context);
}
