/**
 * Tests for VaultBackend
 */

import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVaultBackend, VaultBackend } from '../backend-vault.js';

describe('VaultBackend', () => {
  let testDir: string;
  let backend: VaultBackend;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `vault-backend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    backend = createVaultBackend(testDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('type', () => {
    it('should be vault', () => {
      // Assert
      expect(backend.type).toBe('vault');
    });
  });

  describe('createVaultBackend', () => {
    it('should create a VaultBackend instance', () => {
      // Arrange/Act
      const instance = createVaultBackend(testDir);

      // Assert
      expect(instance).toBeInstanceOf(VaultBackend);
    });
  });

  describe('isAvailable', () => {
    it('should always return true', async () => {
      // Arrange/Act
      const available = await backend.isAvailable();

      // Assert
      expect(available).toBe(true);
    });
  });

  describe('requiresInit', () => {
    it('should return true when vault does not exist', async () => {
      // Arrange/Act
      const requiresInit = await backend.requiresInit();

      // Assert
      expect(requiresInit).toBe(true);
    });

    it('should return false when vault exists', async () => {
      // Arrange
      await backend.initialize('test-passphrase');

      // Act
      const requiresInit = await backend.requiresInit();

      // Assert
      expect(requiresInit).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should create a new vault with passphrase', async () => {
      // Arrange/Act
      await backend.initialize('test-passphrase');

      // Assert
      expect(backend.isUnlocked()).toBe(true);
    });

    it('should throw error without passphrase', async () => {
      // Arrange/Act/Assert
      await expect(backend.initialize()).rejects.toThrow('Passphrase is required');
    });
  });

  describe('unlock', () => {
    it('should unlock existing vault', async () => {
      // Arrange
      await backend.initialize('test-passphrase');
      backend.lock();
      expect(backend.isUnlocked()).toBe(false);

      // Act
      await backend.unlock('test-passphrase');

      // Assert
      expect(backend.isUnlocked()).toBe(true);
    });

    it('should throw error without passphrase', async () => {
      // Arrange
      await backend.initialize('test-passphrase');
      backend.lock();

      // Act/Assert
      await expect(backend.unlock()).rejects.toThrow('Passphrase is required');
    });
  });

  describe('lock', () => {
    it('should lock the vault', async () => {
      // Arrange
      await backend.initialize('test-passphrase');
      expect(backend.isUnlocked()).toBe(true);

      // Act
      backend.lock();

      // Assert
      expect(backend.isUnlocked()).toBe(false);
    });
  });

  describe('isUnlocked', () => {
    it('should return false before initialization', () => {
      // Arrange/Act/Assert
      expect(backend.isUnlocked()).toBe(false);
    });

    it('should return true after initialization', async () => {
      // Arrange
      await backend.initialize('test-passphrase');

      // Act/Assert
      expect(backend.isUnlocked()).toBe(true);
    });

    it('should return false after locking', async () => {
      // Arrange
      await backend.initialize('test-passphrase');
      backend.lock();

      // Act/Assert
      expect(backend.isUnlocked()).toBe(false);
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent secret', async () => {
      // Arrange
      await backend.initialize('test-passphrase');

      // Act
      const value = await backend.get('non-existent');

      // Assert
      expect(value).toBeUndefined();
    });

    it('should return stored secret value', async () => {
      // Arrange
      await backend.initialize('test-passphrase');
      await backend.set('my-secret', 'secret-value');

      // Act
      const value = await backend.get('my-secret');

      // Assert
      expect(value).toBe('secret-value');
    });
  });

  describe('set', () => {
    it('should store a secret', async () => {
      // Arrange
      await backend.initialize('test-passphrase');

      // Act
      await backend.set('api-key', 'abc123');

      // Assert
      const value = await backend.get('api-key');
      expect(value).toBe('abc123');
    });

    it('should update an existing secret', async () => {
      // Arrange
      await backend.initialize('test-passphrase');
      await backend.set('api-key', 'old-value');

      // Act
      await backend.set('api-key', 'new-value');

      // Assert
      const value = await backend.get('api-key');
      expect(value).toBe('new-value');
    });
  });

  describe('delete', () => {
    it('should delete an existing secret', async () => {
      // Arrange
      await backend.initialize('test-passphrase');
      await backend.set('to-delete', 'value');

      // Act
      const deleted = await backend.delete('to-delete');

      // Assert
      expect(deleted).toBe(true);
      expect(await backend.get('to-delete')).toBeUndefined();
    });

    it('should return false for non-existent secret', async () => {
      // Arrange
      await backend.initialize('test-passphrase');

      // Act
      const deleted = await backend.delete('non-existent');

      // Assert
      expect(deleted).toBe(false);
    });
  });

  describe('list', () => {
    it('should return empty array when no secrets', async () => {
      // Arrange
      await backend.initialize('test-passphrase');

      // Act
      const names = await backend.list();

      // Assert
      expect(names).toEqual([]);
    });

    it('should return all secret names', async () => {
      // Arrange
      await backend.initialize('test-passphrase');
      await backend.set('secret1', 'value1');
      await backend.set('secret2', 'value2');
      await backend.set('secret3', 'value3');

      // Act
      const names = await backend.list();

      // Assert
      expect(names).toHaveLength(3);
      expect(names).toContain('secret1');
      expect(names).toContain('secret2');
      expect(names).toContain('secret3');
    });
  });

  describe('getVault', () => {
    it('should return the underlying vault instance', () => {
      // Arrange/Act
      const vault = backend.getVault();

      // Assert
      expect(vault).toBeDefined();
      expect(vault.getState).toBeDefined();
    });
  });
});
