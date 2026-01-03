/**
 * Types for HTTP defaults source tracking
 */

import type { HttpMethodName, HttpOutputDefaults } from '../config/types.js';

/**
 * Source of a default value
 */
export type DefaultSource =
  | 'built-in'
  | 'workspace'
  | `workspace.${HttpMethodName}`
  | `profile:${string}`
  | `profile:${string}.${HttpMethodName}`
  | 'session';

/**
 * A resolved default value with its source
 */
export interface ResolvedDefault<T = unknown> {
  key: keyof HttpOutputDefaults;
  value: T;
  source: DefaultSource;
}

/**
 * All resolved defaults with source tracking
 */
export interface ResolvedDefaults {
  includeHeaders: ResolvedDefault<boolean>;
  outputMode: ResolvedDefault<'pretty' | 'json' | 'raw'>;
  showSummary: ResolvedDefault<boolean>;
  trace: ResolvedDefault<boolean>;
  showSecrets: ResolvedDefault<boolean>;
  hideBody: ResolvedDefault<boolean>;
}

/**
 * Valid keys for HTTP output defaults
 */
export const HTTP_OUTPUT_DEFAULT_KEYS = [
  'includeHeaders',
  'outputMode',
  'showSummary',
  'trace',
  'showSecrets',
  'hideBody',
] as const;

/**
 * Type for HTTP output default key
 */
export type HttpOutputDefaultKey = (typeof HTTP_OUTPUT_DEFAULT_KEYS)[number];

/**
 * Check if a string is a valid HTTP output default key
 */
export function isValidDefaultKey(key: string): key is HttpOutputDefaultKey {
  return HTTP_OUTPUT_DEFAULT_KEYS.includes(key as HttpOutputDefaultKey);
}

/**
 * Valid values for outputMode
 */
export const OUTPUT_MODE_VALUES = ['pretty', 'json', 'raw'] as const;

/**
 * Type for output mode values
 */
export type OutputModeValue = (typeof OUTPUT_MODE_VALUES)[number];

/**
 * Check if a string is a valid output mode value
 */
export function isValidOutputMode(value: string): value is OutputModeValue {
  return OUTPUT_MODE_VALUES.includes(value as OutputModeValue);
}
