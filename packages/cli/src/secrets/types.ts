/**
 * Secrets vault type definitions
 */

/**
 * Supported KDF algorithms
 */
export type KdfAlgorithm = 'scrypt' | 'argon2id';

/**
 * Scrypt KDF parameters (LEGACY - for existing vaults only)
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
 * Default scrypt parameters (LEGACY)
 * N=16384 (2^14), r=8, p=1 - good balance of security and performance
 */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32, // 256 bits for AES-256
};

/**
 * Argon2id KDF parameters (BASELINE - 2025 standard)
 *
 * Parameters follow OWASP/NIST recommendations:
 * - Memory: 64 MB (65536 KB)
 * - Iterations: 3
 * - Parallelism: 4
 */
export interface Argon2idParams {
  /** Memory cost in KB */
  memoryCost: number;
  /** Time cost (iterations) */
  timeCost: number;
  /** Degree of parallelism */
  parallelism: number;
  /** Derived key length in bytes */
  outputLen: number;
}

/**
 * Default Argon2id parameters (OWASP 2025 recommendations)
 */
export const DEFAULT_ARGON2ID_PARAMS: Argon2idParams = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32, // 256 bits for AES-256
};

/**
 * Vault metadata stored in vault.meta.json (Version 1 - scrypt)
 */
export interface VaultMetadataV1 {
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
 * Vault metadata stored in vault.meta.json (Version 2 - argon2id)
 */
export interface VaultMetadataV2 {
  /** Version of the vault format */
  version: 2;
  /** KDF algorithm identifier */
  kdf: 'argon2id';
  /** Salt for key derivation (base64) */
  salt: string;
  /** Argon2id parameters used */
  argon2id: Argon2idParams;
  /** Timestamp of last modification */
  modifiedAt: string;
}

/**
 * Union type for all vault metadata versions
 */
export type VaultMetadata = VaultMetadataV1 | VaultMetadataV2;

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

/**
 * Error thrown when keychain is forced but unavailable
 */
export class KeychainUnavailableError extends Error {
  constructor(reason?: string) {
    super(
      `Keychain is not available${reason ? `: ${reason}` : ''}. ` +
        'Set secrets.backend to "vault" or "auto" to use vault fallback.',
    );
    this.name = 'KeychainUnavailableError';
  }
}
