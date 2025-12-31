/**
 * Secret resolver for variable interpolation
 *
 * Creates a resolver function that can be used with InterpolationContext.
 */

import type { IVault } from './types.js';

/**
 * Create a secret resolver function for use with interpolation
 *
 * The resolver returns the secret value if found, or throws if not found.
 *
 * @param vault - Unlocked vault instance
 * @returns Resolver function compatible with InterpolationContext.secretResolver
 *
 * @example
 * const vault = createVault();
 * await vault.unlock('passphrase');
 * const resolver = createSecretResolver(vault);
 *
 * const context = { vars: {}, secretResolver: resolver };
 * const result = interpolate('Token: ${secret:apiKey}', context);
 */
export function createSecretResolver(vault: IVault): (name: string) => string {
  return (name: string): string => {
    const value = vault.get(name);
    if (value === undefined) {
      throw new Error(`Secret not found: ${name}`);
    }
    return value;
  };
}

/**
 * Create a safe secret resolver that returns placeholder for missing secrets
 *
 * Useful for dry-run or preview scenarios where missing secrets shouldn't fail.
 *
 * @param vault - Vault instance (can be locked)
 * @returns Resolver function that never throws
 */
export function createSafeSecretResolver(vault: IVault): (name: string) => string {
  return (name: string): string => {
    try {
      const value = vault.get(name);
      if (value !== undefined) {
        return value;
      }
    } catch {
      // Vault locked or other error
    }
    return `<secret:${name}>`;
  };
}
