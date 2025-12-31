/**
 * Variable interpolation module
 *
 * @module workspace/variables
 */

// Errors
export {
  CircularReferenceError,
  MaxRecursionError,
  VariableError,
  VariableNotFoundError,
} from './errors.js';
// Parser
export { hasVariables, isKnownType, parseVariables, unescapeVariables } from './parser.js';
// Resolver
export { interpolate, interpolateAsync } from './resolver.js';
// Types
export type { InterpolationContext, InterpolationOptions, VariableMatch, VariableType } from './types.js';
export { DEFAULT_INTERPOLATION_OPTIONS } from './types.js';
