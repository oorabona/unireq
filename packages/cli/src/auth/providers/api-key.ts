/**
 * API Key provider resolver
 *
 * Resolves an api_key provider config to a ResolvedCredential
 */

import { interpolate } from '../../workspace/variables/resolver.js';
import type { InterpolationContext } from '../../workspace/variables/types.js';
import type { ApiKeyProviderConfig, ResolvedCredential } from '../types.js';

/**
 * Resolve an API key provider configuration to a credential
 *
 * @param config - The API key provider configuration
 * @param context - Interpolation context for variable resolution
 * @returns Resolved credential ready for request injection
 * @throws VariableNotFoundError if a required variable is not defined
 * @throws CircularReferenceError if circular variable reference detected
 *
 * @example
 * const config = {
 *   type: 'api_key',
 *   location: 'header',
 *   name: 'X-API-Key',
 *   value: '${secret:apiKey}'
 * };
 * const credential = resolveApiKeyProvider(config, { vars: {} });
 * // Returns: { location: 'header', name: 'X-API-Key', value: '<secret:apiKey>' }
 */
export function resolveApiKeyProvider(
  config: ApiKeyProviderConfig,
  context: InterpolationContext = { vars: {} },
): ResolvedCredential {
  // Interpolate the value (handles ${var:...}, ${env:...}, ${secret:...}, ${prompt:...})
  const resolvedValue = interpolate(config.value, context);

  return {
    location: config.location,
    name: config.name,
    value: resolvedValue,
  };
}
