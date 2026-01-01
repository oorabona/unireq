/**
 * OS Keychain backend implementation
 *
 * Uses @napi-rs/keyring for cross-platform keychain access:
 * - macOS: Keychain Services
 * - Windows: Credential Manager
 * - Linux: Secret Service API (libsecret)
 *
 * This backend is optional - if native bindings fail to load,
 * the system gracefully falls back to the vault backend.
 */

import type { BackendType, ISecretBackend } from './backend-types.js';

/**
 * Service name for keychain entries
 * All secrets are stored under this service name
 */
const KEYCHAIN_SERVICE = 'unireq-cli';

/**
 * Internal registry key used to track all stored secret names
 * Since some keychains don't support listing, we maintain our own list
 */
const REGISTRY_KEY = '__unireq_secret_registry__';

/**
 * Type for dynamically imported keyring module
 */
type KeyringEntry = {
  new (
    service: string,
    user: string,
  ): {
    getPassword(): string | null;
    setPassword(password: string): void;
    deletePassword(): boolean;
  };
};

/**
 * Cached keyring module (or null if unavailable)
 */
let keyringModule: { Entry: KeyringEntry } | null | undefined;

/**
 * Error reason if keyring failed to load
 */
let keyringLoadError: string | undefined;

/**
 * Attempt to load the keyring module
 *
 * @returns The keyring module or null if unavailable
 */
async function loadKeyringModule(): Promise<{ Entry: KeyringEntry } | null> {
  if (keyringModule !== undefined) {
    return keyringModule;
  }

  try {
    // Dynamic import to handle optional dependency
    const mod = await import('@napi-rs/keyring');
    keyringModule = mod;
    return mod;
  } catch (error) {
    keyringLoadError = error instanceof Error ? error.message : 'Unknown error loading keyring';
    keyringModule = null;
    return null;
  }
}

/**
 * Check if keyring is available
 *
 * @returns true if keyring module loaded successfully
 */
export async function isKeychainAvailable(): Promise<boolean> {
  const mod = await loadKeyringModule();
  return mod !== null;
}

/**
 * Get the error reason if keychain is unavailable
 */
export function getKeychainLoadError(): string | undefined {
  return keyringLoadError;
}

/**
 * OS Keychain backend
 *
 * Stores secrets in the OS native credential store.
 * No passphrase required - uses OS authentication.
 */
export class KeychainBackend implements ISecretBackend {
  readonly type: BackendType = 'keychain';
  private keyring: { Entry: KeyringEntry } | null = null;
  private available = false;

  /**
   * Check if keychain is available
   */
  async isAvailable(): Promise<boolean> {
    if (this.keyring !== null) {
      return true;
    }

    this.keyring = await loadKeyringModule();
    this.available = this.keyring !== null;
    return this.available;
  }

  /**
   * Keychain doesn't require initialization
   */
  async requiresInit(): Promise<boolean> {
    return false;
  }

  /**
   * Initialize is a no-op for keychain
   */
  async initialize(_passphrase?: string): Promise<void> {
    // Keychain doesn't need initialization
  }

  /**
   * Unlock is a no-op for keychain (OS handles authentication)
   */
  async unlock(_passphrase?: string): Promise<void> {
    // Keychain doesn't need unlocking - OS handles it
  }

  /**
   * Lock is a no-op for keychain
   */
  lock(): void {
    // Keychain doesn't support explicit locking
  }

  /**
   * Keychain is always "unlocked" once available
   */
  isUnlocked(): boolean {
    return this.available;
  }

  /**
   * Get a secret from the keychain
   *
   * @param name - Secret name
   * @returns Secret value or undefined if not found
   */
  async get(name: string): Promise<string | undefined> {
    if (!this.keyring) {
      return undefined;
    }

    try {
      const entry = new this.keyring.Entry(KEYCHAIN_SERVICE, name);
      const value = entry.getPassword();
      return value ?? undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Set a secret in the keychain
   *
   * @param name - Secret name
   * @param value - Secret value
   */
  async set(name: string, value: string): Promise<void> {
    if (!this.keyring) {
      throw new Error('Keychain not available');
    }

    // Store the secret
    const entry = new this.keyring.Entry(KEYCHAIN_SERVICE, name);
    entry.setPassword(value);

    // Update registry
    await this.addToRegistry(name);
  }

  /**
   * Delete a secret from the keychain
   *
   * @param name - Secret name
   * @returns true if deleted, false if not found
   */
  async delete(name: string): Promise<boolean> {
    if (!this.keyring) {
      return false;
    }

    try {
      const entry = new this.keyring.Entry(KEYCHAIN_SERVICE, name);
      const result = entry.deletePassword();

      // Update registry
      if (result) {
        await this.removeFromRegistry(name);
      }

      return result;
    } catch {
      return false;
    }
  }

  /**
   * List all secret names
   *
   * Uses an internal registry since not all keychains support listing.
   *
   * @returns Array of secret names
   */
  async list(): Promise<string[]> {
    if (!this.keyring) {
      return [];
    }

    const registry = await this.getRegistry();
    return registry;
  }

  /**
   * Get the internal secret registry
   */
  private async getRegistry(): Promise<string[]> {
    if (!this.keyring) {
      return [];
    }

    try {
      const entry = new this.keyring.Entry(KEYCHAIN_SERVICE, REGISTRY_KEY);
      const data = entry.getPassword();
      if (!data) {
        return [];
      }
      return JSON.parse(data) as string[];
    } catch {
      return [];
    }
  }

  /**
   * Save the internal secret registry
   */
  private async saveRegistry(names: string[]): Promise<void> {
    if (!this.keyring) {
      return;
    }

    const entry = new this.keyring.Entry(KEYCHAIN_SERVICE, REGISTRY_KEY);
    entry.setPassword(JSON.stringify(names));
  }

  /**
   * Add a name to the registry
   */
  private async addToRegistry(name: string): Promise<void> {
    const registry = await this.getRegistry();
    if (!registry.includes(name)) {
      registry.push(name);
      await this.saveRegistry(registry);
    }
  }

  /**
   * Remove a name from the registry
   */
  private async removeFromRegistry(name: string): Promise<void> {
    const registry = await this.getRegistry();
    const index = registry.indexOf(name);
    if (index !== -1) {
      registry.splice(index, 1);
      await this.saveRegistry(registry);
    }
  }
}

/**
 * Create a new KeychainBackend instance
 */
export function createKeychainBackend(): KeychainBackend {
  return new KeychainBackend();
}
