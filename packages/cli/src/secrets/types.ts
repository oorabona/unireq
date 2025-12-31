/**
 * Secrets vault type definitions
 */

/**
 * Scrypt KDF parameters
 */
export interface ScryptParams {
  /** CPU/memory cost parameter (N) */
  N: number;
  /** Block size parameter (r) */
  r: number;
  /** Parallelization parameter (p) */
  p: number;
  /** Derived key length in bytes */
  keyLen: number;
}

/**
 * Default scrypt parameters
 * N=16384 (2^14), r=8, p=1 - good balance of security and performance
 */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32, // 256 bits for AES-256
};

/**
 * Vault metadata stored in vault.meta.json
 */
export interface VaultMetadata {
  /** Version of the vault format */
  version: 1;
  /** Salt for key derivation (base64) */
  salt: string;
  /** Scrypt parameters used */
  scrypt: ScryptParams;
  /** Timestamp of last modification */
  modifiedAt: string;
}

/**
 * Encrypted vault data stored in vault.enc
 */
export interface EncryptedVault {
  /** Initialization vector / nonce (base64, 12 bytes) */
  iv: string;
  /** Encrypted data (base64) */
  ciphertext: string;
  /** Authentication tag (base64, 16 bytes) */
  authTag: string;
}

/**
 * Decrypted vault contents
 */
export interface VaultContents {
  /** Map of secret names to values */
  secrets: Record<string, string>;
}

/**
 * Vault state
 */
export type VaultState = 'locked' | 'unlocked' | 'not_initialized';

/**
 * Vault instance interface
 */
export interface IVault {
  /** Get current vault state */
  getState(): VaultState;
  /** Initialize a new vault with passphrase */
  initialize(passphrase: string): Promise<void>;
  /** Unlock existing vault with passphrase */
  unlock(passphrase: string): Promise<void>;
  /** Lock the vault (clear decrypted data from memory) */
  lock(): void;
  /** Get a secret value (vault must be unlocked) */
  get(name: string): string | undefined;
  /** Set a secret value (vault must be unlocked) */
  set(name: string, value: string): Promise<void>;
  /** Delete a secret (vault must be unlocked) */
  delete(name: string): Promise<void>;
  /** List all secret names (vault must be unlocked) */
  list(): string[];
  /** Check if vault exists */
  exists(): Promise<boolean>;
}

/**
 * Error thrown when vault is locked but operation requires unlocked state
 */
export class VaultLockedError extends Error {
  constructor() {
    super('Vault is locked. Unlock with passphrase first.');
    this.name = 'VaultLockedError';
  }
}

/**
 * Error thrown when vault is not initialized
 */
export class VaultNotInitializedError extends Error {
  constructor() {
    super('Vault is not initialized. Initialize with a passphrase first.');
    this.name = 'VaultNotInitializedError';
  }
}

/**
 * Error thrown when vault already exists during initialization
 */
export class VaultAlreadyExistsError extends Error {
  constructor() {
    super('Vault already exists. Use unlock instead of initialize.');
    this.name = 'VaultAlreadyExistsError';
  }
}

/**
 * Error thrown when passphrase is incorrect
 */
export class InvalidPassphraseError extends Error {
  constructor() {
    super('Invalid passphrase. Decryption failed.');
    this.name = 'InvalidPassphraseError';
  }
}

/**
 * Error thrown when secret is not found
 */
export class SecretNotFoundError extends Error {
  constructor(name: string) {
    super(`Secret not found: ${name}`);
    this.name = 'SecretNotFoundError';
  }
}
