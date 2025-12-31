/**
 * Tests for Vault implementation
 */

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  InvalidPassphraseError,
  VaultAlreadyExistsError,
  VaultLockedError,
  VaultNotInitializedError,
} from '../types.js';
import { Vault } from '../vault.js';

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
});
