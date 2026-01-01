/**
 * OpenAPI Input Validation Types
 * @module openapi/validator/types
 */

import type { OpenAPIOperation, OpenAPISchema } from '../types.js';

/**
 * Parameter location types
 */
export type ParameterLocation = 'path' | 'query' | 'header';

/**
 * Validation warning severity levels
 */
export type WarningSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation warning
 */
export interface ValidationWarning {
  /** Warning severity */
  severity: WarningSeverity;
  /** Parameter location (path, query, header) */
  location: ParameterLocation | 'body';
  /** Parameter name (or 'body' for request body) */
  param: string;
  /** Human-readable warning message */
  message: string;
}

/**
 * Result of validating a request
 */
export interface ValidationResult {
  /** List of validation warnings */
  warnings: ValidationWarning[];
  /** Whether validation was skipped (no spec, no operation, etc.) */
  skipped: boolean;
  /** Reason for skipping (if skipped) */
  skipReason?: string;
}

/**
 * Context for validation
 */
export interface ValidatorContext {
  /** OpenAPI operation definition */
  operation: OpenAPIOperation;
  /** Path template from spec (e.g., '/users/{id}') */
  pathTemplate: string;
  /** Actual URL path provided by user */
  actualPath: string;
  /** Query parameters provided (key=value pairs) */
  queryParams: string[];
  /** Header parameters provided (key:value pairs) */
  headerParams: string[];
  /** Whether request body is provided */
  hasBody: boolean;
}

/**
 * Extracted parameter values from request
 */
export interface ExtractedParams {
  /** Path parameters extracted from URL */
  path: Map<string, string>;
  /** Query parameters extracted from -q options */
  query: Map<string, string>;
  /** Header parameters extracted from -H options */
  header: Map<string, string>;
}

/**
 * Parameter definition with resolved schema
 */
export interface ResolvedParameter {
  /** Parameter name */
  name: string;
  /** Parameter location */
  in: ParameterLocation;
  /** Whether parameter is required */
  required: boolean;
  /** Parameter schema (if defined) */
  schema?: OpenAPISchema;
  /** Deprecated flag */
  deprecated?: boolean;
}
