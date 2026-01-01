/**
 * Secret backend abstraction types
 *
 * Provides a unified interface for different secret storage backends:
 * - OS Keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
 * - Encrypted Vault (local file with passphrase)
 */

/**
 * Backend type identifier
 */
export type BackendType = 'keychain' | 'vault';

/**
 * Backend configuration from workspace
 */
export type BackendConfigValue = 'auto' | 'keychain' | 'vault';

/**
 * Secret backend interface
 *
 * Abstraction layer for different secret storage mechanisms.
 * All methods are async to support both keychain and vault backends.
 */
export interface ISecretBackend {
  /**
   * Get backend type identifier
   */
  readonly type: BackendType;

  /**
   * Check if this backend is available and ready to use
   *
   * For keychain: checks if native bindings loaded
   * For vault: always true (vault is always available)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Check if backend requires initialization (e.g., vault needs passphrase)
   */
  requiresInit(): Promise<boolean>;

  /**
   * Initialize the backend (e.g., create vault with passphrase)
   *
   * @param passphrase - Optional passphrase for vault backend
   */
  initialize(passphrase?: string): Promise<void>;

  /**
   * Unlock the backend (e.g., unlock vault with passphrase)
   *
   * @param passphrase - Optional passphrase for vault backend
   */
  unlock(passphrase?: string): Promise<void>;

  /**
   * Lock the backend (e.g., lock vault)
   */
  lock(): void;

  /**
   * Check if backend is unlocked/ready for operations
   */
  isUnlocked(): boolean;

  /**
   * Get a secret value
   *
   * @param name - Secret name
   * @returns Secret value or undefined if not found
   */
  get(name: string): Promise<string | undefined>;

  /**
   * Set a secret value
   *
   * @param name - Secret name
   * @param value - Secret value
   */
  set(name: string, value: string): Promise<void>;

  /**
   * Delete a secret
   *
   * @param name - Secret name
   * @returns true if secret was deleted, false if not found
   */
  delete(name: string): Promise<boolean>;

  /**
   * List all secret names
   *
   * @returns Array of secret names
   */
  list(): Promise<string[]>;
}

/**
 * Secret resolver configuration
 */
export interface SecretResolverConfig {
  /**
   * Backend selection mode
   * - 'auto': Try keychain first, fallback to vault
   * - 'keychain': Force keychain, error if unavailable
   * - 'vault': Force vault, ignore keychain
   */
  backend: BackendConfigValue;

  /**
   * Vault directory path (for vault backend)
   */
  vaultDir?: string;
}
