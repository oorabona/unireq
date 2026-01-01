/**
 * Secrets Vault implementation
 *
 * Provides encrypted storage for secrets using AES-256-GCM.
 *
 * Version 2 uses Argon2id for key derivation (BASELINE 2025).
 * Version 1 uses scrypt (LEGACY - for backward compatibility).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { decrypt, encrypt } from './crypto.js';
import { deriveKey, generateSalt } from './kdf.js';
import { deriveKeyArgon2id, getArgon2idParams } from './kdf-argon2.js';
import {
  type EncryptedVault,
  InvalidPassphraseError,
  type IVault,
  VaultAlreadyExistsError,
  type VaultContents,
  VaultLockedError,
  type VaultMetadata,
  type VaultMetadataV2,
  VaultNotInitializedError,
  type VaultState,
} from './types.js';

/**
 * Default vault directory (relative to home)
 */
const DEFAULT_VAULT_DIR = '.unireq';

/**
 * Vault file names
 */
const VAULT_DATA_FILE = 'vault.enc';
const VAULT_META_FILE = 'vault.meta.json';

/**
 * Get default vault path
 */
function getDefaultVaultPath(): string {
  const home = process.env['HOME'] || process.env['USERPROFILE'] || '';
  return join(home, DEFAULT_VAULT_DIR);
}

/**
 * Secrets Vault
 *
 * Manages encrypted storage for secrets.
 * Must be unlocked with passphrase before reading/writing secrets.
 */
export class Vault implements IVault {
  private readonly vaultDir: string;
  private state: VaultState = 'not_initialized';
  private contents: VaultContents | null = null;
  private key: Buffer | null = null;
  private metadata: VaultMetadata | null = null;

  /**
   * Create a new Vault instance
   *
   * @param vaultDir - Directory to store vault files (default: ~/.unireq)
   */
  constructor(vaultDir?: string) {
    this.vaultDir = vaultDir ?? getDefaultVaultPath();
  }

  /**
   * Get path to vault data file
   */
  private get dataPath(): string {
    return join(this.vaultDir, VAULT_DATA_FILE);
  }

  /**
   * Get path to vault metadata file
   */
  private get metaPath(): string {
    return join(this.vaultDir, VAULT_META_FILE);
  }

  /**
   * Get current vault state
   */
  getState(): VaultState {
    return this.state;
  }

  /**
   * Check if vault exists on disk
   */
  async exists(): Promise<boolean> {
    try {
      await readFile(this.metaPath, 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load metadata and check state
   */
  private async loadMetadata(): Promise<VaultMetadata | null> {
    try {
      const metaJson = await readFile(this.metaPath, 'utf8');
      return JSON.parse(metaJson) as VaultMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Save metadata to disk
   */
  private async saveMetadata(metadata: VaultMetadata): Promise<void> {
    await mkdir(dirname(this.metaPath), { recursive: true });
    await writeFile(this.metaPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  /**
   * Load encrypted vault data
   */
  private async loadEncrypted(): Promise<EncryptedVault | null> {
    try {
      const dataJson = await readFile(this.dataPath, 'utf8');
      return JSON.parse(dataJson) as EncryptedVault;
    } catch {
      return null;
    }
  }

  /**
   * Save encrypted vault data
   */
  private async saveEncrypted(encrypted: EncryptedVault): Promise<void> {
    await mkdir(dirname(this.dataPath), { recursive: true });
    await writeFile(this.dataPath, JSON.stringify(encrypted), 'utf8');
  }

  /**
   * Persist current contents to disk
   */
  private async persist(): Promise<void> {
    if (!this.contents || !this.key || !this.metadata) {
      throw new VaultLockedError();
    }

    // Update modification timestamp
    this.metadata.modifiedAt = new Date().toISOString();
    await this.saveMetadata(this.metadata);

    // Encrypt and save
    const encrypted = encrypt(this.contents, this.key);
    await this.saveEncrypted(encrypted);
  }

  /**
   * Initialize a new vault with passphrase
   *
   * Uses Argon2id (BASELINE 2025) for key derivation.
   *
   * @param passphrase - Master passphrase for the vault
   * @throws VaultAlreadyExistsError if vault already exists
   */
  async initialize(passphrase: string): Promise<void> {
    // Check if vault already exists
    if (await this.exists()) {
      throw new VaultAlreadyExistsError();
    }

    // Generate salt and derive key using Argon2id (BASELINE 2025)
    const salt = generateSalt();
    const argon2idParams = getArgon2idParams();
    this.key = await deriveKeyArgon2id(passphrase, salt, argon2idParams);

    // Create empty vault
    this.contents = { secrets: {} };

    // Create metadata (version 2 with Argon2id)
    const metadata: VaultMetadataV2 = {
      version: 2,
      kdf: 'argon2id',
      salt: salt.toString('base64'),
      argon2id: argon2idParams,
      modifiedAt: new Date().toISOString(),
    };
    this.metadata = metadata;

    // Persist to disk
    await this.persist();

    // Update state
    this.state = 'unlocked';
  }

  /**
   * Unlock existing vault with passphrase
   *
   * Automatically detects vault version and uses appropriate KDF:
   * - Version 2: Argon2id (BASELINE 2025)
   * - Version 1: scrypt (LEGACY)
   *
   * @param passphrase - Master passphrase for the vault
   * @throws VaultNotInitializedError if vault doesn't exist
   * @throws InvalidPassphraseError if passphrase is wrong
   */
  async unlock(passphrase: string): Promise<void> {
    // Load metadata
    this.metadata = await this.loadMetadata();
    if (!this.metadata) {
      throw new VaultNotInitializedError();
    }

    // Derive key from passphrase using appropriate KDF based on version
    const salt = Buffer.from(this.metadata.salt, 'base64');

    if (this.metadata.version === 2) {
      // Version 2: Use Argon2id (BASELINE 2025)
      this.key = await deriveKeyArgon2id(passphrase, salt, this.metadata.argon2id);
    } else {
      // Version 1: Use scrypt (LEGACY)
      this.key = await deriveKey(passphrase, salt, this.metadata.scrypt);
    }

    // Load and decrypt vault
    const encrypted = await this.loadEncrypted();
    if (!encrypted) {
      throw new VaultNotInitializedError();
    }

    try {
      this.contents = decrypt(encrypted, this.key);
    } catch {
      // Clear sensitive data
      this.key = null;
      this.metadata = null;
      throw new InvalidPassphraseError();
    }

    // Update state
    this.state = 'unlocked';
  }

  /**
   * Lock the vault (clear decrypted data from memory)
   */
  lock(): void {
    this.contents = null;
    this.key = null;
    this.state = this.metadata ? 'locked' : 'not_initialized';
  }

  /**
   * Get a secret value
   *
   * @param name - Secret name
   * @returns Secret value or undefined if not found
   * @throws VaultLockedError if vault is locked
   */
  get(name: string): string | undefined {
    if (!this.contents) {
      throw new VaultLockedError();
    }
    return this.contents.secrets[name];
  }

  /**
   * Set a secret value
   *
   * @param name - Secret name
   * @param value - Secret value
   * @throws VaultLockedError if vault is locked
   */
  async set(name: string, value: string): Promise<void> {
    if (!this.contents) {
      throw new VaultLockedError();
    }
    this.contents.secrets[name] = value;
    await this.persist();
  }

  /**
   * Delete a secret
   *
   * @param name - Secret name
   * @throws VaultLockedError if vault is locked
   */
  async delete(name: string): Promise<void> {
    if (!this.contents) {
      throw new VaultLockedError();
    }
    delete this.contents.secrets[name];
    await this.persist();
  }

  /**
   * List all secret names
   *
   * @returns Array of secret names
   * @throws VaultLockedError if vault is locked
   */
  list(): string[] {
    if (!this.contents) {
      throw new VaultLockedError();
    }
    return Object.keys(this.contents.secrets);
  }
}

/**
 * Create a new Vault instance
 *
 * @param vaultDir - Optional custom vault directory
 * @returns Vault instance
 */
export function createVault(vaultDir?: string): IVault {
  return new Vault(vaultDir);
}
