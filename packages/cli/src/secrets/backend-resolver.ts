/**
 * Secret backend resolver
 *
 * Handles backend selection based on configuration and availability:
 * - 'auto': Try keychain first, fallback to vault
 * - 'keychain': Force keychain, error if unavailable
 * - 'vault': Force vault, ignore keychain
 */

import { createKeychainBackend, getKeychainLoadError, isKeychainAvailable } from './backend-keychain.js';
import type { BackendConfigValue, BackendType, ISecretBackend, SecretResolverConfig } from './backend-types.js';
import { createVaultBackend } from './backend-vault.js';
import { KeychainUnavailableError } from './types.js';

/**
 * Default configuration for secret resolver
 */
export const DEFAULT_RESOLVER_CONFIG: SecretResolverConfig = {
  backend: 'auto',
};

/**
 * Result of backend resolution
 */
export interface ResolvedBackend {
  /** The selected backend instance */
  backend: ISecretBackend;
  /** The actual backend type that was selected */
  type: BackendType;
  /** Whether this was a fallback (only true when auto mode fell back to vault) */
  fallback: boolean;
  /** Reason for fallback (if applicable) */
  fallbackReason?: string;
}

/**
 * Secret backend resolver
 *
 * Responsible for selecting and initializing the appropriate secret backend
 * based on configuration and system availability.
 */
export class SecretBackendResolver {
  private readonly config: SecretResolverConfig;
  private resolvedBackend: ResolvedBackend | null = null;

  constructor(config: Partial<SecretResolverConfig> = {}) {
    this.config = { ...DEFAULT_RESOLVER_CONFIG, ...config };
  }

  /**
   * Get the configured backend mode
   */
  getConfiguredBackend(): BackendConfigValue {
    return this.config.backend;
  }

  /**
   * Resolve and return the active backend
   *
   * This method caches the result after first resolution.
   * Use reset() to force re-resolution.
   *
   * @returns Resolved backend information
   * @throws KeychainUnavailableError if keychain is forced but unavailable
   */
  async resolve(): Promise<ResolvedBackend> {
    if (this.resolvedBackend) {
      return this.resolvedBackend;
    }

    this.resolvedBackend = await this.doResolve();
    return this.resolvedBackend;
  }

  /**
   * Get the active backend instance
   *
   * Convenience method that returns just the backend.
   *
   * @returns The active backend instance
   * @throws KeychainUnavailableError if keychain is forced but unavailable
   */
  async getBackend(): Promise<ISecretBackend> {
    const resolved = await this.resolve();
    return resolved.backend;
  }

  /**
   * Reset resolution to allow re-detecting backends
   *
   * This is useful after configuration changes or for testing.
   */
  reset(): void {
    this.resolvedBackend = null;
  }

  /**
   * Check if keychain is available without resolving
   */
  async isKeychainAvailable(): Promise<boolean> {
    return isKeychainAvailable();
  }

  /**
   * Get keychain load error (if any)
   */
  getKeychainLoadError(): string | undefined {
    return getKeychainLoadError();
  }

  /**
   * Perform the actual resolution logic
   */
  private async doResolve(): Promise<ResolvedBackend> {
    switch (this.config.backend) {
      case 'keychain':
        return this.resolveKeychain();

      case 'vault':
        return this.resolveVault();
      default:
        return this.resolveAuto();
    }
  }

  /**
   * Resolve keychain backend (forced mode)
   *
   * @throws KeychainUnavailableError if keychain is not available
   */
  private async resolveKeychain(): Promise<ResolvedBackend> {
    const keychainAvailable = await isKeychainAvailable();

    if (!keychainAvailable) {
      const reason = getKeychainLoadError();
      throw new KeychainUnavailableError(reason);
    }

    const backend = createKeychainBackend();
    await backend.isAvailable(); // Initialize the backend

    return {
      backend,
      type: 'keychain',
      fallback: false,
    };
  }

  /**
   * Resolve vault backend (forced mode)
   */
  private async resolveVault(): Promise<ResolvedBackend> {
    const backend = createVaultBackend(this.config.vaultDir);

    return {
      backend,
      type: 'vault',
      fallback: false,
    };
  }

  /**
   * Resolve with auto-detection
   *
   * Try keychain first, fallback to vault if unavailable.
   */
  private async resolveAuto(): Promise<ResolvedBackend> {
    const keychainAvailable = await isKeychainAvailable();

    if (keychainAvailable) {
      const backend = createKeychainBackend();
      await backend.isAvailable(); // Initialize the backend

      return {
        backend,
        type: 'keychain',
        fallback: false,
      };
    }

    // Fallback to vault
    const backend = createVaultBackend(this.config.vaultDir);
    const reason = getKeychainLoadError() || 'Keychain not available';

    return {
      backend,
      type: 'vault',
      fallback: true,
      fallbackReason: reason,
    };
  }
}

/**
 * Create a new SecretBackendResolver instance
 *
 * @param config - Optional resolver configuration
 */
export function createBackendResolver(config?: Partial<SecretResolverConfig>): SecretBackendResolver {
  return new SecretBackendResolver(config);
}
