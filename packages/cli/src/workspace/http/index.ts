/**
 * HTTP defaults management with source tracking
 */

export { BUILT_IN_DEFAULTS, getSourceDescription, resolveDefaultsWithSource } from './source-tracker.js';
export {
  type DefaultSource,
  HTTP_OUTPUT_DEFAULT_KEYS,
  type HttpOutputDefaultKey,
  isValidDefaultKey,
  isValidOutputMode,
  OUTPUT_MODE_VALUES,
  type OutputModeValue,
  type ResolvedDefault,
  type ResolvedDefaults,
} from './types.js';
