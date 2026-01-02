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

/**
 * Options for the profile secret resolver
 */
export interface ProfileSecretResolverOptions {
  /** Merged secrets from workspace + profile (profile takes precedence) */
  profileSecrets: Record<string, string>;
  /** Optional vault resolver for ${secret:name} references in values */
  vaultResolver?: (name: string) => string;
}

/**
 * Create a secret resolver that uses profile secrets with optional vault fallback
 *
 * Profile secrets can either be:
 * 1. Direct values: `api-key: "my-value"` → returns "my-value"
 * 2. Vault references: `api-key: "${secret:vault-key}"` → resolves from vault
 *
 * Resolution flow for ${secret:name}:
 * 1. Check profileSecrets for 'name'
 * 2. If found and value contains ${secret:xxx}, resolve xxx from vault
 * 3. If found and value is direct, return value
 * 4. If not found, try vaultResolver with 'name' directly
 *
 * @param options - Profile secrets and optional vault resolver
 * @returns Resolver function compatible with InterpolationContext.secretResolver
 *
 * @example
 * const resolver = createProfileSecretResolver({
 *   profileSecrets: { 'api-key': '${secret:prod-key}' },
 *   vaultResolver: createSecretResolver(vault),
 * });
 * resolver('api-key'); // Returns value of vault secret 'prod-key'
 */
export function createProfileSecretResolver(options: ProfileSecretResolverOptions): (name: string) => string {
  const { profileSecrets, vaultResolver } = options;
  const secretRefRegex = /^\$\{secret:([^}]+)\}$/;

  return (name: string): string => {
    // Check profile secrets first
    const profileValue = profileSecrets[name];

    if (profileValue !== undefined) {
      // Check if the value is a vault reference
      const match = secretRefRegex.exec(profileValue);
      if (match?.[1] && vaultResolver) {
        // Resolve from vault using the referenced name
        return vaultResolver(match[1]);
      }
      // Return direct value
      return profileValue;
    }

    // Fallback to vault lookup with original name
    if (vaultResolver) {
      return vaultResolver(name);
    }

    throw new Error(`Secret not found: ${name}`);
  };
}

/**
 * Create a safe profile secret resolver that returns placeholder for missing secrets
 *
 * @param options - Profile secrets and optional vault resolver
 * @returns Resolver function that never throws
 */
export function createSafeProfileSecretResolver(options: ProfileSecretResolverOptions): (name: string) => string {
  const { profileSecrets, vaultResolver } = options;
  const secretRefRegex = /^\$\{secret:([^}]+)\}$/;

  return (name: string): string => {
    try {
      // Check profile secrets first
      const profileValue = profileSecrets[name];

      if (profileValue !== undefined) {
        // Check if the value is a vault reference
        const match = secretRefRegex.exec(profileValue);
        if (match?.[1] && vaultResolver) {
          // Resolve from vault using the referenced name
          return vaultResolver(match[1]);
        }
        // Return direct value
        return profileValue;
      }

      // Fallback to vault lookup with original name
      if (vaultResolver) {
        return vaultResolver(name);
      }
    } catch {
      // Any error - return placeholder
    }

    return `<secret:${name}>`;
  };
}
