/**
 * Bearer token provider resolver
 *
 * Resolves a bearer provider config to a ResolvedCredential
 */

import { interpolate } from '../../workspace/variables/resolver.js';
import type { InterpolationContext } from '../../workspace/variables/types.js';
import type { BearerProviderConfig, ResolvedCredential } from '../types.js';

/**
 * Default token prefix
 */
const DEFAULT_PREFIX = 'Bearer';

/**
 * Resolve a Bearer token provider configuration to a credential
 *
 * @param config - The bearer provider configuration
 * @param context - Interpolation context for variable resolution
 * @returns Resolved credential ready for request injection
 * @throws VariableNotFoundError if a required variable is not defined
 * @throws CircularReferenceError if circular variable reference detected
 *
 * @example
 * const config = {
 *   type: 'bearer',
 *   token: '${secret:token}',
 *   prefix: 'Bearer'
 * };
 * const credential = resolveBearerProvider(config, { vars: {} });
 * // Returns: { location: 'header', name: 'Authorization', value: 'Bearer <secret:token>' }
 */
export function resolveBearerProvider(
  config: BearerProviderConfig,
  context: InterpolationContext = { vars: {} },
): ResolvedCredential {
  // Interpolate the token value
  const resolvedToken = interpolate(config.token, context);

  // Use custom prefix or default to "Bearer"
  const prefix = config.prefix ?? DEFAULT_PREFIX;

  return {
    location: 'header',
    name: 'Authorization',
    value: `${prefix} ${resolvedToken}`,
  };
}
