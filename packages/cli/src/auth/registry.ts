/**
 * Auth provider registry functions
 */

import type { AuthConfig, AuthProviderConfig } from './types.js';

/**
 * List all provider names in the auth config
 *
 * @param config - Auth configuration
 * @returns Array of provider names
 */
export function listProviders(config: AuthConfig): string[] {
  return Object.keys(config.providers);
}

/**
 * Get a specific provider by name
 *
 * @param config - Auth configuration
 * @param name - Provider name to get
 * @returns Provider config or undefined if not found
 */
export function getProvider(config: AuthConfig, name: string): AuthProviderConfig | undefined {
  return config.providers[name];
}

/**
 * Check if a provider exists
 *
 * @param config - Auth configuration
 * @param name - Provider name to check
 * @returns true if provider exists
 */
export function providerExists(config: AuthConfig, name: string): boolean {
  return name in config.providers;
}

/**
 * Get the active provider name
 * Priority: explicit active > first provider > undefined
 *
 * @param config - Auth configuration
 * @returns Active provider name or undefined
 */
export function getActiveProviderName(config: AuthConfig): string | undefined {
  const providerNames = Object.keys(config.providers);

  if (providerNames.length === 0) {
    return undefined;
  }

  // Explicit active provider
  if (config.active && providerNames.includes(config.active)) {
    return config.active;
  }

  // Fallback to first provider
  return providerNames[0];
}

/**
 * Get the active provider configuration
 *
 * @param config - Auth configuration
 * @returns Active provider config or undefined
 */
export function getActiveProvider(config: AuthConfig): AuthProviderConfig | undefined {
  const name = getActiveProviderName(config);
  if (!name) {
    return undefined;
  }
  return config.providers[name];
}
