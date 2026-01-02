/**
 * OpenAPI Module
 * @module openapi
 */

// Errors
export {
  SpecError,
  SpecLoadError,
  SpecNotFoundError,
  SpecParseError,
} from './errors';
// Loader
export { loadSpec } from './loader';
export type { HttpMethod, NavigationNode, NavigationTree, OperationInfo } from './navigation/index.js';
// Navigation
export {
  buildNavigationTree,
  getMethods,
  getNode,
  getOperation,
  getOperations,
  HTTP_METHODS,
  listChildren,
  pathExists,
} from './navigation/index.js';
export type { LoadSpecOptions, SpecLoadResult } from './state-loader.js';
// State Loader (for REPL integration)
export {
  clearSpecFromState,
  getSpecInfoString,
  loadSpecIntoState,
} from './state-loader.js';
// Types
export type {
  LoadedSpec,
  LoadOptions,
  OpenAPIDocument,
  OpenAPIInfo,
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPIPathItem,
  OpenAPIRequestBody,
  OpenAPIResponse,
  OpenAPISchema,
  OpenAPIServer,
  SpecVersion,
} from './types';
export { DEFAULT_LOAD_OPTIONS } from './types';
// Utilities
export {
  detectFormat,
  detectVersion,
  isLocalhost,
  isSecureUrl,
  isUrl,
  resolvePath,
} from './utils';
// Validator
export { displayWarnings, formatWarning, formatWarnings, hasWarnings } from './validator/display.js';
export type { ValidationResult, ValidationWarning } from './validator/index.js';
export { validateRequestFull } from './validator/index.js';
