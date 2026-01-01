/**
 * OpenAPI Input Validators
 * Core validation logic for parameters and request body
 * @module openapi/validator/validators
 */

import type { OpenAPISchema } from '../types.js';
import type { ParameterLocation, ResolvedParameter, ValidationWarning } from './types.js';

/**
 * Validate that all required parameters are provided
 * @param params - List of parameter definitions
 * @param provided - Map of provided parameter values
 * @param location - Parameter location (path, query, header)
 * @returns Array of warnings for missing required parameters
 */
export function validateRequired(
  params: ResolvedParameter[],
  provided: Map<string, string>,
  location: ParameterLocation,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const param of params) {
    if (param.in !== location) continue;
    if (!param.required) continue;

    const value = provided.get(param.name);
    if (value === undefined || value === '') {
      warnings.push({
        severity: 'warning',
        location,
        param: param.name,
        message: `Missing required ${location} parameter: ${param.name}`,
      });
    }
  }

  return warnings;
}

/**
 * Check if a string value can be parsed as an integer
 */
function isValidInteger(value: string): boolean {
  if (value === '') return false;
  const num = Number(value);
  return Number.isInteger(num);
}

/**
 * Check if a string value can be parsed as a number
 */
function isValidNumber(value: string): boolean {
  if (value === '') return false;
  const num = Number(value);
  return !Number.isNaN(num) && Number.isFinite(num);
}

/**
 * Check if a string value is a valid boolean
 */
function isValidBoolean(value: string): boolean {
  const lower = value.toLowerCase();
  return lower === 'true' || lower === 'false' || lower === '1' || lower === '0';
}

/**
 * Validate parameter type against schema
 * @param schema - OpenAPI schema definition
 * @param value - Provided value as string
 * @param paramName - Parameter name for error messages
 * @param location - Parameter location
 * @returns Warning if type mismatch, undefined otherwise
 */
export function validateType(
  schema: OpenAPISchema | undefined,
  value: string,
  paramName: string,
  location: ParameterLocation,
): ValidationWarning | undefined {
  if (!schema || !schema.type) return undefined;
  if (value === '') return undefined; // Empty values handled by required check

  const schemaType = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (schemaType) {
    case 'integer':
      if (!isValidInteger(value)) {
        return {
          severity: 'warning',
          location,
          param: paramName,
          message: `${capitalize(location)} parameter '${paramName}' should be integer, got '${truncate(value)}'`,
        };
      }
      break;

    case 'number':
      if (!isValidNumber(value)) {
        return {
          severity: 'warning',
          location,
          param: paramName,
          message: `${capitalize(location)} parameter '${paramName}' should be number, got '${truncate(value)}'`,
        };
      }
      break;

    case 'boolean':
      if (!isValidBoolean(value)) {
        return {
          severity: 'warning',
          location,
          param: paramName,
          message: `${capitalize(location)} parameter '${paramName}' should be boolean, got '${truncate(value)}'`,
        };
      }
      break;

    // string and array types accept any value
    case 'string':
    case 'array':
      break;

    default:
      // Unknown type, skip validation
      break;
  }

  return undefined;
}

/**
 * Validate parameter value against enum constraint
 * @param schema - OpenAPI schema definition
 * @param value - Provided value as string
 * @param paramName - Parameter name for error messages
 * @param location - Parameter location
 * @returns Warning if value not in enum, undefined otherwise
 */
export function validateEnum(
  schema: OpenAPISchema | undefined,
  value: string,
  paramName: string,
  location: ParameterLocation,
): ValidationWarning | undefined {
  if (!schema || !schema.enum || schema.enum.length === 0) return undefined;
  if (value === '') return undefined; // Empty values handled by required check

  const enumValues = schema.enum.map((v) => String(v));

  if (!enumValues.includes(value)) {
    return {
      severity: 'warning',
      location,
      param: paramName,
      message: `${capitalize(location)} parameter '${paramName}' must be one of: ${enumValues.join(', ')}`,
    };
  }

  return undefined;
}

/**
 * Validate parameter format (informational only)
 * @param schema - OpenAPI schema definition
 * @param value - Provided value as string
 * @param paramName - Parameter name for error messages
 * @param location - Parameter location
 * @returns Info-level warning if format hint available, undefined otherwise
 */
export function validateFormat(
  schema: OpenAPISchema | undefined,
  value: string,
  paramName: string,
  location: ParameterLocation,
): ValidationWarning | undefined {
  if (!schema || !schema.format) return undefined;
  if (value === '') return undefined;

  // Only provide hints for commonly misused formats
  const formatHints: Record<string, (v: string) => boolean> = {
    'date-time': (v) => !isValidISODateTime(v),
    date: (v) => !isValidISODate(v),
    email: (v) => !v.includes('@'),
    uuid: (v) => !isValidUUID(v),
  };

  const check = formatHints[schema.format];
  if (check?.(value)) {
    return {
      severity: 'info',
      location,
      param: paramName,
      message: `${capitalize(location)} parameter '${paramName}' should be ${schema.format} format`,
    };
  }

  return undefined;
}

/**
 * Validate a single parameter value
 * @param param - Parameter definition
 * @param value - Provided value (undefined if not provided)
 * @returns Array of warnings for this parameter
 */
export function validateParameter(param: ResolvedParameter, value: string | undefined): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const location = param.in;

  // Required check
  if (param.required && (value === undefined || value === '')) {
    warnings.push({
      severity: 'warning',
      location,
      param: param.name,
      message: `Missing required ${location} parameter: ${param.name}`,
    });
    return warnings; // Skip other checks if missing
  }

  // Skip further validation if no value
  if (value === undefined || value === '') {
    return warnings;
  }

  // Type check
  const typeWarning = validateType(param.schema, value, param.name, location);
  if (typeWarning) {
    warnings.push(typeWarning);
  }

  // Enum check
  const enumWarning = validateEnum(param.schema, value, param.name, location);
  if (enumWarning) {
    warnings.push(enumWarning);
  }

  // Format hint (info level)
  const formatWarning = validateFormat(param.schema, value, param.name, location);
  if (formatWarning) {
    warnings.push(formatWarning);
  }

  // Deprecated warning
  if (param.deprecated) {
    warnings.push({
      severity: 'info',
      location,
      param: param.name,
      message: `${capitalize(location)} parameter '${param.name}' is deprecated`,
    });
  }

  return warnings;
}

// Helper functions

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str: string, maxLen = 20): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}...`;
}

function isValidISODateTime(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && value.includes('T');
}

function isValidISODate(value: string): boolean {
  // Simple check: YYYY-MM-DD format
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
