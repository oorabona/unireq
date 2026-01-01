/**
 * Vault backend implementation
 *
 * Wraps the existing Vault class to implement ISecretBackend.
 * This backend is always available as a fallback.
 */

import type { BackendType, ISecretBackend } from './backend-types.js';
import type { IVault } from './types.js';
import { createVault } from './vault.js';

/**
 * Vault backend
 *
 * Provides secret storage using the encrypted vault.
 * Requires passphrase for initialization and unlocking.
 */
export class VaultBackend implements ISecretBackend {
  readonly type: BackendType = 'vault';
  private readonly vault: IVault;

  /**
   * Create a VaultBackend
   *
   * @param vaultDir - Optional custom vault directory
   */
  constructor(vaultDir?: string) {
    this.vault = createVault(vaultDir);
  }

  /**
   * Create with an existing vault instance (for testing)
   */
  static withVault(vault: IVault): VaultBackend {
    const backend = Object.create(VaultBackend.prototype) as VaultBackend;
    Object.defineProperty(backend, 'type', { value: 'vault' as const });
    Object.defineProperty(backend, 'vault', { value: vault });
    return backend;
  }

  /**
   * Get the underlying vault instance
   */
  getVault(): IVault {
    return this.vault;
  }

  /**
   * Vault is always available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Check if vault needs initialization
   */
  async requiresInit(): Promise<boolean> {
    return !(await this.vault.exists());
  }

  /**
   * Initialize a new vault with passphrase
   *
   * @param passphrase - Master passphrase for the vault
   */
  async initialize(passphrase?: string): Promise<void> {
    if (!passphrase) {
      throw new Error('Passphrase is required to initialize vault');
    }
    await this.vault.initialize(passphrase);
  }

  /**
   * Unlock the vault with passphrase
   *
   * @param passphrase - Master passphrase for the vault
   */
  async unlock(passphrase?: string): Promise<void> {
    if (!passphrase) {
      throw new Error('Passphrase is required to unlock vault');
    }
    await this.vault.unlock(passphrase);
  }

  /**
   * Lock the vault
   */
  lock(): void {
    this.vault.lock();
  }

  /**
   * Check if vault is unlocked
   */
  isUnlocked(): boolean {
    return this.vault.getState() === 'unlocked';
  }

  /**
   * Get a secret from the vault
   *
   * @param name - Secret name
   * @returns Secret value or undefined if not found
   */
  async get(name: string): Promise<string | undefined> {
    return this.vault.get(name);
  }

  /**
   * Set a secret in the vault
   *
   * @param name - Secret name
   * @param value - Secret value
   */
  async set(name: string, value: string): Promise<void> {
    await this.vault.set(name, value);
  }

  /**
   * Delete a secret from the vault
   *
   * @param name - Secret name
   * @returns true if deleted (always true for vault)
   */
  async delete(name: string): Promise<boolean> {
    const exists = this.vault.get(name) !== undefined;
    if (exists) {
      await this.vault.delete(name);
      return true;
    }
    return false;
  }

  /**
   * List all secret names
   *
   * @returns Array of secret names
   */
  async list(): Promise<string[]> {
    return this.vault.list();
  }
}

/**
 * Create a new VaultBackend instance
 *
 * @param vaultDir - Optional custom vault directory
 */
export function createVaultBackend(vaultDir?: string): VaultBackend {
  return new VaultBackend(vaultDir);
}
