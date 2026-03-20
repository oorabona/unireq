/**
 * Tests for Vault implementation
 */

import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  InvalidPassphraseError,
  VaultAlreadyExistsError,
  VaultLockedError,
  type VaultMetadataV1,
  type VaultMetadataV2,
  VaultNotInitializedError,
} from '../types.js';
import { createVault, Vault } from '../vault.js';

describe('Vault', () => {
  let vaultDir: string;
  let vault: Vault;

  beforeEach(() => {
    // Create unique temp directory for each test
    vaultDir = join(tmpdir(), `vault-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    vault = new Vault(vaultDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(vaultDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initial state', () => {
    it('should have state not_initialized for new vault', () => {
      // Assert
      expect(vault.getState()).toBe('not_initialized');
    });

    it('should report not exists for new vault', async () => {
      // Assert
      expect(await vault.exists()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize new vault successfully', async () => {
      // Act
      await vault.initialize('test-passphrase');

      // Assert
      expect(vault.getState()).toBe('unlocked');
      expect(await vault.exists()).toBe(true);
    });

    it('should throw VaultAlreadyExistsError if vault exists', async () => {
      // Arrange
      await vault.initialize('passphrase');

      // Act & Assert
      const newVault = new Vault(vaultDir);
      await expect(newVault.initialize('other-passphrase')).rejects.toThrow(VaultAlreadyExistsError);
    });

    it('should create empty secrets on initialization', async () => {
      // Act
      await vault.initialize('passphrase');

      // Assert
      expect(vault.list()).toEqual([]);
    });
  });

  describe('unlock', () => {
    it('should unlock vault with correct passphrase', async () => {
      // Arrange
      await vault.initialize('correct-passphrase');
      vault.lock();
      expect(vault.getState()).toBe('locked');

      // Act
      await vault.unlock('correct-passphrase');

      // Assert
      expect(vault.getState()).toBe('unlocked');
    });

    it('should throw InvalidPassphraseError with wrong passphrase', async () => {
      // Arrange
      await vault.initialize('correct-passphrase');
      vault.lock();

      // Act & Assert
      await expect(vault.unlock('wrong-passphrase')).rejects.toThrow(InvalidPassphraseError);
    });

    it('should throw VaultNotInitializedError for non-existent vault', async () => {
      // Act & Assert
      await expect(vault.unlock('passphrase')).rejects.toThrow(VaultNotInitializedError);
    });

    it('should preserve secrets after unlock', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('key', 'value');
      vault.lock();

      // Act
      await vault.unlock('passphrase');

      // Assert
      expect(vault.get('key')).toBe('value');
    });
  });

  describe('lock', () => {
    it('should change state to locked', async () => {
      // Arrange
      await vault.initialize('passphrase');

      // Act
      vault.lock();

      // Assert
      expect(vault.getState()).toBe('locked');
    });

    it('should clear secrets from memory', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('key', 'value');

      // Act
      vault.lock();

      // Assert
      expect(() => vault.get('key')).toThrow(VaultLockedError);
    });
  });

  describe('get', () => {
    it('should return secret value when exists', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('apiKey', 'secret-123');

      // Act
      const value = vault.get('apiKey');

      // Assert
      expect(value).toBe('secret-123');
    });

    it('should return undefined when secret not found', async () => {
      // Arrange
      await vault.initialize('passphrase');

      // Act
      const value = vault.get('nonexistent');

      // Assert
      expect(value).toBeUndefined();
    });

    it('should throw VaultLockedError when locked', async () => {
      // Arrange
      await vault.initialize('passphrase');
      vault.lock();

      // Act & Assert
      expect(() => vault.get('key')).toThrow(VaultLockedError);
    });
  });

  describe('set', () => {
    it('should store secret value', async () => {
      // Arrange
      await vault.initialize('passphrase');

      // Act
      await vault.set('newKey', 'newValue');

      // Assert
      expect(vault.get('newKey')).toBe('newValue');
    });

    it('should update existing secret', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('key', 'oldValue');

      // Act
      await vault.set('key', 'newValue');

      // Assert
      expect(vault.get('key')).toBe('newValue');
    });

    it('should persist secrets to disk', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('key', 'value');
      vault.lock();

      // Create new vault instance
      const newVault = new Vault(vaultDir);
      await newVault.unlock('passphrase');

      // Assert
      expect(newVault.get('key')).toBe('value');
    });

    it('should throw VaultLockedError when locked', async () => {
      // Arrange
      await vault.initialize('passphrase');
      vault.lock();

      // Act & Assert
      await expect(vault.set('key', 'value')).rejects.toThrow(VaultLockedError);
    });
  });

  describe('delete', () => {
    it('should remove secret', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('key', 'value');

      // Act
      await vault.delete('key');

      // Assert
      expect(vault.get('key')).toBeUndefined();
    });

    it('should not throw for non-existent secret', async () => {
      // Arrange
      await vault.initialize('passphrase');

      // Act & Assert
      await expect(vault.delete('nonexistent')).resolves.not.toThrow();
    });

    it('should throw VaultLockedError when locked', async () => {
      // Arrange
      await vault.initialize('passphrase');
      vault.lock();

      // Act & Assert
      await expect(vault.delete('key')).rejects.toThrow(VaultLockedError);
    });
  });

  describe('list', () => {
    it('should return empty array for new vault', async () => {
      // Arrange
      await vault.initialize('passphrase');

      // Assert
      expect(vault.list()).toEqual([]);
    });

    it('should return all secret names', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('key1', 'value1');
      await vault.set('key2', 'value2');
      await vault.set('key3', 'value3');

      // Act
      const names = vault.list();

      // Assert
      expect(names.sort()).toEqual(['key1', 'key2', 'key3']);
    });

    it('should throw VaultLockedError when locked', async () => {
      // Arrange
      await vault.initialize('passphrase');
      vault.lock();

      // Act & Assert
      expect(() => vault.list()).toThrow(VaultLockedError);
    });
  });

  describe('round-trip encryption across instances', () => {
    it('should encrypt and decrypt a secret across separate Vault instances', async () => {
      // Arrange — write secret with first instance
      await vault.initialize('my-passphrase');
      await vault.set('db_password', 's3cret!');
      vault.lock();

      // Act — read secret with second instance using same dir
      const vault2 = new Vault(vaultDir);
      await vault2.unlock('my-passphrase');

      // Assert
      expect(vault2.get('db_password')).toBe('s3cret!');
    });

    it('should preserve multiple secrets across separate instances', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('token', 'tok-abc');
      await vault.set('api_key', 'key-xyz');
      await vault.set('client_secret', 'secret-123');
      vault.lock();

      // Act
      const vault2 = new Vault(vaultDir);
      await vault2.unlock('passphrase');

      // Assert
      expect(vault2.get('token')).toBe('tok-abc');
      expect(vault2.get('api_key')).toBe('key-xyz');
      expect(vault2.get('client_secret')).toBe('secret-123');
      expect(vault2.list().sort()).toEqual(['api_key', 'client_secret', 'token']);
    });
  });

  describe('corrupted vault file handling', () => {
    it('should throw InvalidPassphraseError when data file is tampered', async () => {
      // Arrange — initialize and lock vault
      await vault.initialize('passphrase');
      vault.lock();

      // Overwrite vault.enc with garbage
      const dataPath = join(vaultDir, 'vault.enc');
      await writeFile(dataPath, JSON.stringify({ iv: 'AAAA', ciphertext: 'BBBB', authTag: 'CCCC' }), 'utf8');

      // Act & Assert — decryption should fail with InvalidPassphraseError
      const vault2 = new Vault(vaultDir);
      await expect(vault2.unlock('passphrase')).rejects.toThrow(InvalidPassphraseError);
    });

    it('should throw VaultNotInitializedError when meta file is missing', async () => {
      // Arrange — initialize vault, then delete meta file
      await vault.initialize('passphrase');
      vault.lock();

      // Overwrite meta file with empty string so readFile throws JSON parse error
      const metaPath = join(vaultDir, 'vault.meta.json');
      await writeFile(metaPath, '', 'utf8');

      // Act & Assert
      const vault2 = new Vault(vaultDir);
      await expect(vault2.unlock('passphrase')).rejects.toThrow(VaultNotInitializedError);
    });

    it('should throw VaultNotInitializedError when data file is missing', async () => {
      // Arrange — initialize vault, then replace data file with non-parseable content
      await vault.initialize('passphrase');
      vault.lock();

      // Overwrite vault.enc with non-JSON so JSON.parse fails → loadEncrypted returns null
      const dataPath = join(vaultDir, 'vault.enc');
      await writeFile(dataPath, 'not-json', 'utf8');

      // Act & Assert
      const vault2 = new Vault(vaultDir);
      await expect(vault2.unlock('passphrase')).rejects.toThrow(VaultNotInitializedError);
    });

    it('should throw InvalidPassphraseError when authTag is tampered', async () => {
      // Arrange
      await vault.initialize('passphrase');
      vault.lock();

      // Read data file, tamper authTag
      const dataPath = join(vaultDir, 'vault.enc');
      const { readFile: nodeReadFile } = await import('node:fs/promises');
      const raw = JSON.parse(await nodeReadFile(dataPath, 'utf8')) as {
        iv: string;
        ciphertext: string;
        authTag: string;
      };
      const tagBuf = Buffer.from(raw.authTag, 'base64');
      tagBuf[0] = (tagBuf[0] ?? 0) ^ 0xff;
      raw.authTag = tagBuf.toString('base64');
      await writeFile(dataPath, JSON.stringify(raw), 'utf8');

      // Act & Assert
      const vault2 = new Vault(vaultDir);
      await expect(vault2.unlock('passphrase')).rejects.toThrow(InvalidPassphraseError);
    });
  });

  describe('secret name collisions (overwrite behavior)', () => {
    it('should overwrite existing secret in memory immediately', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('api_key', 'old-value');

      // Act
      await vault.set('api_key', 'new-value');

      // Assert
      expect(vault.get('api_key')).toBe('new-value');
      expect(vault.list()).toHaveLength(1);
    });

    it('should persist overwritten secret across instances', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('api_key', 'old-value');
      await vault.set('api_key', 'new-value');
      vault.lock();

      // Act
      const vault2 = new Vault(vaultDir);
      await vault2.unlock('passphrase');

      // Assert
      expect(vault2.get('api_key')).toBe('new-value');
      expect(vault2.list()).toHaveLength(1);
    });
  });

  describe('delete persists across instances', () => {
    it('should not find deleted secret in new instance', async () => {
      // Arrange
      await vault.initialize('passphrase');
      await vault.set('temp_token', 'token-abc');
      await vault.set('keep_this', 'keep-value');

      // Act — delete one secret
      await vault.delete('temp_token');
      vault.lock();

      // Assert — new instance should not see deleted secret
      const vault2 = new Vault(vaultDir);
      await vault2.unlock('passphrase');
      expect(vault2.get('temp_token')).toBeUndefined();
      expect(vault2.get('keep_this')).toBe('keep-value');
      expect(vault2.list()).toEqual(['keep_this']);
    });
  });

  describe('empty vault', () => {
    it('should have no secrets after initialize', async () => {
      // Act
      await vault.initialize('passphrase');

      // Assert
      expect(vault.list()).toHaveLength(0);
    });

    it('should persist empty state across instances', async () => {
      // Arrange
      await vault.initialize('passphrase');
      vault.lock();

      // Act
      const vault2 = new Vault(vaultDir);
      await vault2.unlock('passphrase');

      // Assert
      expect(vault2.list()).toHaveLength(0);
    });

    it('should report exists after initialize even though empty', async () => {
      // Act
      await vault.initialize('passphrase');

      // Assert
      expect(await vault.exists()).toBe(true);
    });
  });

  describe('state machine transitions', () => {
    it('should stay not_initialized when lock() is called before initialize()', () => {
      // Act
      vault.lock();

      // Assert
      expect(vault.getState()).toBe('not_initialized');
    });

    it('should transition to unlocked after initialize', async () => {
      // Act
      await vault.initialize('passphrase');

      // Assert
      expect(vault.getState()).toBe('unlocked');
    });

    it('should transition to locked after lock()', async () => {
      // Arrange
      await vault.initialize('passphrase');

      // Act
      vault.lock();

      // Assert
      expect(vault.getState()).toBe('locked');
    });

    it('should transition back to unlocked after unlock()', async () => {
      // Arrange
      await vault.initialize('passphrase');
      vault.lock();

      // Act
      await vault.unlock('passphrase');

      // Assert
      expect(vault.getState()).toBe('unlocked');
    });

    it('should remain unlocked after multiple set() calls', async () => {
      // Arrange
      await vault.initialize('passphrase');

      // Act
      await vault.set('a', '1');
      await vault.set('b', '2');

      // Assert
      expect(vault.getState()).toBe('unlocked');
    });
  });

  describe('KDF parameters (v2 argon2id)', () => {
    it('should create vault metadata with version 2 and argon2id KDF', async () => {
      // Act
      await vault.initialize('passphrase');
      vault.lock();

      // Read the metadata file directly
      const { readFile: nodeReadFile } = await import('node:fs/promises');
      const metaPath = join(vaultDir, 'vault.meta.json');
      const meta = JSON.parse(await nodeReadFile(metaPath, 'utf8')) as VaultMetadataV2;

      // Assert — version 2 with argon2id
      expect(meta.version).toBe(2);
      expect(meta.kdf).toBe('argon2id');
      expect(meta.salt).toBeTruthy();
      expect(Buffer.from(meta.salt, 'base64').length).toBeGreaterThanOrEqual(16);
      expect(meta.argon2id).toBeDefined();
      expect(meta.argon2id.memoryCost).toBeGreaterThan(0);
      expect(meta.argon2id.timeCost).toBeGreaterThan(0);
      expect(meta.argon2id.parallelism).toBeGreaterThan(0);
      expect(meta.argon2id.outputLen).toBe(32);
      expect(meta.modifiedAt).toBeTruthy();
    });

    it('should unlock vault created with argon2id (v2) using same passphrase', async () => {
      // Arrange
      await vault.initialize('argon2-passphrase');
      await vault.set('secret', 'value');
      vault.lock();

      // Act — use a fresh instance (goes through argon2id path in unlock)
      const vault2 = new Vault(vaultDir);
      await vault2.unlock('argon2-passphrase');

      // Assert
      expect(vault2.getState()).toBe('unlocked');
      expect(vault2.get('secret')).toBe('value');
    });

    it('should reject wrong passphrase on argon2id vault', async () => {
      // Arrange
      await vault.initialize('correct-pass');
      vault.lock();

      // Act & Assert
      const vault2 = new Vault(vaultDir);
      await expect(vault2.unlock('wrong-pass')).rejects.toThrow(InvalidPassphraseError);
    });
  });

  describe('KDF parameters (v1 scrypt backward compatibility)', () => {
    it('should unlock v1 scrypt vault created with legacy metadata', async () => {
      // Arrange — manually construct a v1 scrypt vault on disk
      const { mkdir: nodeMkdir, writeFile: nodeWriteFile } = await import('node:fs/promises');
      const { deriveKey, generateSalt } = await import('../kdf.js');
      const { encrypt: encryptContents } = await import('../crypto.js');

      await nodeMkdir(vaultDir, { recursive: true });

      const passphrase = 'legacy-passphrase';
      const salt = generateSalt(16);
      const scryptParams = { N: 16384, r: 8, p: 1, keyLen: 32 };
      const key = await deriveKey(passphrase, salt, scryptParams);

      const contents = { secrets: { legacy_key: 'legacy_value' } };
      const encrypted = encryptContents(contents, key);

      const metaV1: VaultMetadataV1 = {
        version: 1,
        salt: salt.toString('base64'),
        scrypt: scryptParams,
        modifiedAt: new Date().toISOString(),
      };

      await nodeWriteFile(join(vaultDir, 'vault.meta.json'), JSON.stringify(metaV1, null, 2), 'utf8');
      await nodeWriteFile(join(vaultDir, 'vault.enc'), JSON.stringify(encrypted), 'utf8');

      // Act — Vault.unlock should detect version 1 and use scrypt
      const v1Vault = new Vault(vaultDir);
      await v1Vault.unlock(passphrase);

      // Assert
      expect(v1Vault.getState()).toBe('unlocked');
      expect(v1Vault.get('legacy_key')).toBe('legacy_value');
    });

    it('should reject wrong passphrase on v1 scrypt vault', async () => {
      // Arrange — construct v1 vault
      const { mkdir: nodeMkdir, writeFile: nodeWriteFile } = await import('node:fs/promises');
      const { deriveKey, generateSalt } = await import('../kdf.js');
      const { encrypt: encryptContents } = await import('../crypto.js');

      await nodeMkdir(vaultDir, { recursive: true });

      const salt = generateSalt(16);
      const scryptParams = { N: 16384, r: 8, p: 1, keyLen: 32 };
      const key = await deriveKey('correct-pass', salt, scryptParams);
      const contents = { secrets: {} };
      const encrypted = encryptContents(contents, key);

      const metaV1: VaultMetadataV1 = {
        version: 1,
        salt: salt.toString('base64'),
        scrypt: scryptParams,
        modifiedAt: new Date().toISOString(),
      };

      await nodeWriteFile(join(vaultDir, 'vault.meta.json'), JSON.stringify(metaV1, null, 2), 'utf8');
      await nodeWriteFile(join(vaultDir, 'vault.enc'), JSON.stringify(encrypted), 'utf8');

      // Act & Assert
      const v1Vault = new Vault(vaultDir);
      await expect(v1Vault.unlock('wrong-pass')).rejects.toThrow(InvalidPassphraseError);
    });
  });

  describe('createVault factory', () => {
    it('should create a Vault instance via factory function', async () => {
      // Act
      const factoryVault = createVault(vaultDir);

      // Assert — it satisfies the IVault interface
      expect(typeof factoryVault.initialize).toBe('function');
      expect(typeof factoryVault.unlock).toBe('function');
      expect(typeof factoryVault.lock).toBe('function');
      expect(typeof factoryVault.get).toBe('function');
      expect(typeof factoryVault.set).toBe('function');
      expect(typeof factoryVault.delete).toBe('function');
      expect(typeof factoryVault.list).toBe('function');
      expect(typeof factoryVault.exists).toBe('function');
      expect(typeof factoryVault.getState).toBe('function');
    });

    it('should create a functional vault via factory', async () => {
      // Act
      const factoryVault = createVault(vaultDir);
      await factoryVault.initialize('factory-pass');
      await factoryVault.set('factory_secret', 'factory_value');

      // Assert
      expect(factoryVault.get('factory_secret')).toBe('factory_value');
      expect(factoryVault.getState()).toBe('unlocked');
    });

    it('should use custom vaultDir when provided to factory', async () => {
      // Act
      const factoryVault = createVault(vaultDir);
      await factoryVault.initialize('pass');

      // Assert — vault files exist in custom dir
      expect(await factoryVault.exists()).toBe(true);
    });
  });
});
