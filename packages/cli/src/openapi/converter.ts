/**
 * Swagger 2.0 to OpenAPI 3.1 Converter
 * @module openapi/converter
 */

import { upgrade } from '@scalar/openapi-parser';
import { consola } from 'consola';
import type { OpenAPIDocument } from './types.js';

/**
 * Conversion warning types
 */
export interface ConversionWarning {
  type: 'security' | 'produces' | 'consumes' | 'formData' | 'file' | 'collectionFormat' | 'conversion_error';
  message: string;
  field?: string;
}

/**
 * Result of Swagger 2.0 conversion
 */
export interface ConversionResult {
  document: OpenAPIDocument;
  converted: boolean;
  warnings: ConversionWarning[];
}

/**
 * Check if a document is Swagger 2.0
 * @param document - Parsed document
 * @returns true if Swagger 2.0
 */
export function isSwagger2(document: unknown): boolean {
  if (!document || typeof document !== 'object') {
    return false;
  }
  const doc = document as Record<string, unknown>;
  return doc['swagger'] === '2.0';
}

/**
 * Analyze Swagger 2.0 document for features that may not convert fully
 * @param swagger - Swagger 2.0 document
 * @returns List of conversion warnings
 */
function analyzeSwaggerFeatures(swagger: Record<string, unknown>): ConversionWarning[] {
  const warnings: ConversionWarning[] = [];

  // Security definitions (experimental in @scalar/openapi-parser)
  if (swagger['securityDefinitions']) {
    warnings.push({
      type: 'security',
      message: 'Security definitions may not be fully converted. Verify security schemes after conversion.',
      field: 'securityDefinitions',
    });
  }

  // Global consumes/produces may not map correctly to all operations
  if (swagger['consumes']) {
    warnings.push({
      type: 'consumes',
      message: 'Global "consumes" converted to request body content types. Verify requestBody schemas.',
      field: 'consumes',
    });
  }

  if (swagger['produces']) {
    warnings.push({
      type: 'produces',
      message: 'Global "produces" converted to response content types. Verify response schemas.',
      field: 'produces',
    });
  }

  // Check for formData parameters
  const paths = swagger['paths'] as Record<string, Record<string, unknown>> | undefined;
  if (paths) {
    let hasFormData = false;
    let hasFileUpload = false;
    let hasCollectionFormat = false;

    for (const pathItem of Object.values(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const operation of Object.values(pathItem)) {
        if (!operation || typeof operation !== 'object') continue;
        const op = operation as Record<string, unknown>;
        const parameters = op['parameters'] as Array<Record<string, unknown>> | undefined;

        if (parameters) {
          for (const param of parameters) {
            if (param['in'] === 'formData') hasFormData = true;
            if (param['type'] === 'file') hasFileUpload = true;
            if (param['collectionFormat']) hasCollectionFormat = true;
          }
        }
      }
    }

    if (hasFormData) {
      warnings.push({
        type: 'formData',
        message: 'formData parameters converted to requestBody. Verify multipart/form-data handling.',
      });
    }

    if (hasFileUpload) {
      warnings.push({
        type: 'file',
        message: 'File upload parameters converted. Verify binary content handling.',
      });
    }

    if (hasCollectionFormat) {
      warnings.push({
        type: 'collectionFormat',
        message: 'collectionFormat converted to style/explode. Verify array parameter serialization.',
      });
    }
  }

  return warnings;
}

/**
 * Display conversion warnings to the user
 * @param warnings - List of warnings to display
 */
export function displayConversionWarnings(warnings: ConversionWarning[]): void {
  if (warnings.length === 0) return;

  consola.warn('Swagger 2.0 → OpenAPI 3.1 conversion warnings:');
  for (const warning of warnings) {
    consola.warn(`  ⚠ ${warning.message}`);
  }
}

/**
 * Convert Swagger 2.0 to OpenAPI 3.1
 * Uses @scalar/openapi-parser upgrade function
 *
 * @param document - Swagger 2.0 document
 * @returns Conversion result with document and warnings
 */
export function convertSwagger2ToOpenAPI3(document: unknown): OpenAPIDocument {
  if (!isSwagger2(document)) {
    // Not Swagger 2.0, return as-is
    return document as OpenAPIDocument;
  }

  const swagger = document as Record<string, unknown>;

  // Analyze for potential conversion issues
  const warnings = analyzeSwaggerFeatures(swagger);

  try {
    // Cast to Record<string, unknown> which is compatible with AnyObject
    const result = upgrade(swagger as Record<string, unknown>);
    consola.info('Swagger 2.0 successfully converted to OpenAPI 3.1');

    // Display warnings if any
    displayConversionWarnings(warnings);

    return result.specification as OpenAPIDocument;
  } catch (error: unknown) {
    const err = error as { message?: string };
    consola.error(`Failed to convert Swagger 2.0: ${err.message || 'unknown error'}`);
    consola.error('The original Swagger 2.0 document will be used. Some features may not work correctly.');
    // Return original document if conversion fails
    return document as OpenAPIDocument;
  }
}

/**
 * Convert Swagger 2.0 to OpenAPI 3.1 with detailed result
 * @param document - Swagger 2.0 document
 * @returns Conversion result with document, status, and warnings
 */
export function convertSwagger2ToOpenAPI3WithResult(document: unknown): ConversionResult {
  if (!isSwagger2(document)) {
    return {
      document: document as OpenAPIDocument,
      converted: false,
      warnings: [],
    };
  }

  const swagger = document as Record<string, unknown>;
  const warnings = analyzeSwaggerFeatures(swagger);

  try {
    // Cast to Record<string, unknown> which is compatible with AnyObject
    const result = upgrade(swagger as Record<string, unknown>);
    return {
      document: result.specification as OpenAPIDocument,
      converted: true,
      warnings,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    warnings.push({
      type: 'conversion_error',
      message: `Conversion failed: ${err.message || 'unknown error'}. Using original document.`,
    });
    return {
      document: document as OpenAPIDocument,
      converted: false,
      warnings,
    };
  }
}
