/**
 * Tests for KeychainBackend
 *
 * These tests mock the @napi-rs/keyring module to avoid
 * depending on native bindings in CI.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the keyring module before importing the backend
vi.mock('@napi-rs/keyring', () => {
  const storage = new Map<string, string>();

  class MockEntry {
    private readonly key: string;

    constructor(service: string, user: string) {
      this.key = `${service}:${user}`;
    }

    getPassword(): string | null {
      return storage.get(this.key) ?? null;
    }

    setPassword(password: string): void {
      storage.set(this.key, password);
    }

    deletePassword(): boolean {
      return storage.delete(this.key);
    }
  }

  return {
    Entry: MockEntry,
    __storage: storage, // Expose for test cleanup
  };
});

describe('KeychainBackend', () => {
  // Import after mock is set up
  let KeychainBackend: typeof import('../backend-keychain.js').KeychainBackend;
  let createKeychainBackend: typeof import('../backend-keychain.js').createKeychainBackend;
  let isKeychainAvailable: typeof import('../backend-keychain.js').isKeychainAvailable;
  let mockStorage: Map<string, string>;

  beforeEach(async () => {
    // Reset module cache to get fresh state
    vi.resetModules();

    // Re-import after reset
    const mod = await import('../backend-keychain.js');
    KeychainBackend = mod.KeychainBackend;
    createKeychainBackend = mod.createKeychainBackend;
    isKeychainAvailable = mod.isKeychainAvailable;

    // Get storage from mock
    const keyringMock = await import('@napi-rs/keyring');
    mockStorage = (keyringMock as unknown as { __storage: Map<string, string> }).__storage;
    mockStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isKeychainAvailable', () => {
    it('should return true when keyring module loads', async () => {
      // Arrange/Act
      const available = await isKeychainAvailable();

      // Assert
      expect(available).toBe(true);
    });
  });

  describe('createKeychainBackend', () => {
    it('should create a KeychainBackend instance', () => {
      // Arrange/Act
      const backend = createKeychainBackend();

      // Assert
      expect(backend).toBeInstanceOf(KeychainBackend);
      expect(backend.type).toBe('keychain');
    });
  });

  describe('isAvailable', () => {
    it('should return true when keyring loads', async () => {
      // Arrange
      const backend = createKeychainBackend();

      // Act
      const available = await backend.isAvailable();

      // Assert
      expect(available).toBe(true);
    });
  });

  describe('requiresInit', () => {
    it('should return false (keychain does not need initialization)', async () => {
      // Arrange
      const backend = createKeychainBackend();

      // Act
      const requiresInit = await backend.requiresInit();

      // Assert
      expect(requiresInit).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should be a no-op', async () => {
      // Arrange
      const backend = createKeychainBackend();

      // Act/Assert - should not throw
      await expect(backend.initialize()).resolves.toBeUndefined();
    });
  });

  describe('unlock', () => {
    it('should be a no-op', async () => {
      // Arrange
      const backend = createKeychainBackend();

      // Act/Assert - should not throw
      await expect(backend.unlock()).resolves.toBeUndefined();
    });
  });

  describe('lock', () => {
    it('should be a no-op', () => {
      // Arrange
      const backend = createKeychainBackend();

      // Act/Assert - should not throw
      expect(() => backend.lock()).not.toThrow();
    });
  });

  describe('isUnlocked', () => {
    it('should return false before isAvailable is called', () => {
      // Arrange
      const backend = createKeychainBackend();

      // Act/Assert
      expect(backend.isUnlocked()).toBe(false);
    });

    it('should return true after isAvailable returns true', async () => {
      // Arrange
      const backend = createKeychainBackend();

      // Act
      await backend.isAvailable();

      // Assert
      expect(backend.isUnlocked()).toBe(true);
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent secret', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();

      // Act
      const value = await backend.get('non-existent');

      // Assert
      expect(value).toBeUndefined();
    });

    it('should return stored secret value', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();
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
      const backend = createKeychainBackend();
      await backend.isAvailable();

      // Act
      await backend.set('api-key', 'abc123');

      // Assert
      const value = await backend.get('api-key');
      expect(value).toBe('abc123');
    });

    it('should update an existing secret', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();
      await backend.set('api-key', 'old-value');

      // Act
      await backend.set('api-key', 'new-value');

      // Assert
      const value = await backend.get('api-key');
      expect(value).toBe('new-value');
    });

    it('should add secret name to registry', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();

      // Act
      await backend.set('secret1', 'value1');
      await backend.set('secret2', 'value2');

      // Assert
      const names = await backend.list();
      expect(names).toContain('secret1');
      expect(names).toContain('secret2');
    });

    it('should not duplicate names in registry', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();

      // Act
      await backend.set('api-key', 'value1');
      await backend.set('api-key', 'value2');

      // Assert
      const names = await backend.list();
      expect(names.filter((n) => n === 'api-key')).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('should delete an existing secret', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();
      await backend.set('to-delete', 'value');

      // Act
      const deleted = await backend.delete('to-delete');

      // Assert
      expect(deleted).toBe(true);
      expect(await backend.get('to-delete')).toBeUndefined();
    });

    it('should return false for non-existent secret', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();

      // Act
      const deleted = await backend.delete('non-existent');

      // Assert
      expect(deleted).toBe(false);
    });

    it('should remove secret name from registry', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();
      await backend.set('to-delete', 'value');

      // Act
      await backend.delete('to-delete');

      // Assert
      const names = await backend.list();
      expect(names).not.toContain('to-delete');
    });
  });

  describe('list', () => {
    it('should return empty array when no secrets', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();

      // Act
      const names = await backend.list();

      // Assert
      expect(names).toEqual([]);
    });

    it('should return all secret names', async () => {
      // Arrange
      const backend = createKeychainBackend();
      await backend.isAvailable();
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

  describe('type', () => {
    it('should be keychain', () => {
      // Arrange
      const backend = createKeychainBackend();

      // Assert
      expect(backend.type).toBe('keychain');
    });
  });
});

describe('KeychainBackend - unavailable', () => {
  it('should return undefined for get when not available', async () => {
    // Arrange - create backend without calling isAvailable
    const { createKeychainBackend } = await import('../backend-keychain.js');
    const backend = createKeychainBackend();

    // Force unavailable state by not calling isAvailable
    // and directly testing get

    // Act
    const value = await backend.get('any-key');

    // Assert
    expect(value).toBeUndefined();
  });

  it('should return empty array for list when not available', async () => {
    // Arrange
    const { createKeychainBackend } = await import('../backend-keychain.js');
    const backend = createKeychainBackend();

    // Act
    const names = await backend.list();

    // Assert
    expect(names).toEqual([]);
  });

  it('should return false for delete when not available', async () => {
    // Arrange
    const { createKeychainBackend } = await import('../backend-keychain.js');
    const backend = createKeychainBackend();

    // Act
    const deleted = await backend.delete('any-key');

    // Assert
    expect(deleted).toBe(false);
  });
});
