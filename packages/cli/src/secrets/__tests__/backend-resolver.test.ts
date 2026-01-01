/**
 * Tests for SecretBackendResolver
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ISecretBackend } from '../backend-types.js';

// Mock the backend modules
vi.mock('../backend-keychain.js', () => ({
  isKeychainAvailable: vi.fn(),
  getKeychainLoadError: vi.fn(),
  createKeychainBackend: vi.fn(),
}));

vi.mock('../backend-vault.js', () => ({
  createVaultBackend: vi.fn(),
}));

describe('SecretBackendResolver', () => {
  let SecretBackendResolver: typeof import('../backend-resolver.js').SecretBackendResolver;
  let createBackendResolver: typeof import('../backend-resolver.js').createBackendResolver;
  let isKeychainAvailable: ReturnType<typeof vi.fn>;
  let getKeychainLoadError: ReturnType<typeof vi.fn>;
  let createKeychainBackend: ReturnType<typeof vi.fn>;
  let createVaultBackend: ReturnType<typeof vi.fn>;

  const mockKeychainBackend: ISecretBackend = {
    type: 'keychain',
    isAvailable: vi.fn().mockResolvedValue(true),
    requiresInit: vi.fn().mockResolvedValue(false),
    initialize: vi.fn().mockResolvedValue(undefined),
    unlock: vi.fn().mockResolvedValue(undefined),
    lock: vi.fn(),
    isUnlocked: vi.fn().mockReturnValue(true),
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  };

  const mockVaultBackend: ISecretBackend = {
    type: 'vault',
    isAvailable: vi.fn().mockResolvedValue(true),
    requiresInit: vi.fn().mockResolvedValue(false),
    initialize: vi.fn().mockResolvedValue(undefined),
    unlock: vi.fn().mockResolvedValue(undefined),
    lock: vi.fn(),
    isUnlocked: vi.fn().mockReturnValue(true),
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Get mocked functions
    const keychainMod = await import('../backend-keychain.js');
    const vaultMod = await import('../backend-vault.js');

    isKeychainAvailable = keychainMod.isKeychainAvailable as ReturnType<typeof vi.fn>;
    getKeychainLoadError = keychainMod.getKeychainLoadError as ReturnType<typeof vi.fn>;
    createKeychainBackend = keychainMod.createKeychainBackend as ReturnType<typeof vi.fn>;
    createVaultBackend = vaultMod.createVaultBackend as ReturnType<typeof vi.fn>;

    // Set up default mocks
    createKeychainBackend.mockReturnValue(mockKeychainBackend);
    createVaultBackend.mockReturnValue(mockVaultBackend);

    // Import after mocks are set up
    const resolverMod = await import('../backend-resolver.js');
    SecretBackendResolver = resolverMod.SecretBackendResolver;
    createBackendResolver = resolverMod.createBackendResolver;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createBackendResolver', () => {
    it('should create a SecretBackendResolver instance', () => {
      // Arrange/Act
      const resolver = createBackendResolver();

      // Assert
      expect(resolver).toBeInstanceOf(SecretBackendResolver);
    });

    it('should accept configuration options', () => {
      // Arrange/Act
      const resolver = createBackendResolver({ backend: 'vault' });

      // Assert
      expect(resolver.getConfiguredBackend()).toBe('vault');
    });
  });

  describe('getConfiguredBackend', () => {
    it('should return auto by default', () => {
      // Arrange
      const resolver = createBackendResolver();

      // Act/Assert
      expect(resolver.getConfiguredBackend()).toBe('auto');
    });

    it('should return configured backend', () => {
      // Arrange
      const resolver = createBackendResolver({ backend: 'keychain' });

      // Act/Assert
      expect(resolver.getConfiguredBackend()).toBe('keychain');
    });
  });

  describe('resolve with auto mode', () => {
    it('should select keychain when available', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(true);
      const resolver = createBackendResolver({ backend: 'auto' });

      // Act
      const result = await resolver.resolve();

      // Assert
      expect(result.type).toBe('keychain');
      expect(result.fallback).toBe(false);
      expect(result.backend).toBe(mockKeychainBackend);
    });

    it('should fallback to vault when keychain unavailable', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(false);
      getKeychainLoadError.mockReturnValue('Native bindings not loaded');
      const resolver = createBackendResolver({ backend: 'auto' });

      // Act
      const result = await resolver.resolve();

      // Assert
      expect(result.type).toBe('vault');
      expect(result.fallback).toBe(true);
      expect(result.fallbackReason).toBe('Native bindings not loaded');
      expect(result.backend).toBe(mockVaultBackend);
    });

    it('should use default fallback reason when no error message', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(false);
      getKeychainLoadError.mockReturnValue(undefined);
      const resolver = createBackendResolver({ backend: 'auto' });

      // Act
      const result = await resolver.resolve();

      // Assert
      expect(result.fallbackReason).toBe('Keychain not available');
    });
  });

  describe('resolve with keychain mode', () => {
    it('should select keychain when available', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(true);
      const resolver = createBackendResolver({ backend: 'keychain' });

      // Act
      const result = await resolver.resolve();

      // Assert
      expect(result.type).toBe('keychain');
      expect(result.fallback).toBe(false);
    });

    it('should throw KeychainUnavailableError when unavailable', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(false);
      getKeychainLoadError.mockReturnValue('Native bindings not loaded');
      const resolver = createBackendResolver({ backend: 'keychain' });

      // Act/Assert
      await expect(resolver.resolve()).rejects.toMatchObject({
        name: 'KeychainUnavailableError',
      });
    });

    it('should include reason in error message', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(false);
      getKeychainLoadError.mockReturnValue('Module not found');
      const resolver = createBackendResolver({ backend: 'keychain' });

      // Act/Assert
      await expect(resolver.resolve()).rejects.toThrow(/Module not found/);
    });
  });

  describe('resolve with vault mode', () => {
    it('should always select vault', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(true); // Available but should be ignored
      const resolver = createBackendResolver({ backend: 'vault' });

      // Act
      const result = await resolver.resolve();

      // Assert
      expect(result.type).toBe('vault');
      expect(result.fallback).toBe(false);
      expect(result.backend).toBe(mockVaultBackend);
      expect(isKeychainAvailable).not.toHaveBeenCalled();
    });

    it('should pass vaultDir to createVaultBackend', async () => {
      // Arrange
      const resolver = createBackendResolver({
        backend: 'vault',
        vaultDir: '/custom/vault/dir',
      });

      // Act
      await resolver.resolve();

      // Assert
      expect(createVaultBackend).toHaveBeenCalledWith('/custom/vault/dir');
    });
  });

  describe('caching', () => {
    it('should cache resolved backend', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(true);
      const resolver = createBackendResolver({ backend: 'auto' });

      // Act
      await resolver.resolve();
      await resolver.resolve();
      await resolver.resolve();

      // Assert
      expect(isKeychainAvailable).toHaveBeenCalledTimes(1);
    });

    it('should re-resolve after reset', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(true);
      const resolver = createBackendResolver({ backend: 'auto' });

      // Act
      await resolver.resolve();
      resolver.reset();
      await resolver.resolve();

      // Assert
      expect(isKeychainAvailable).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBackend', () => {
    it('should return the resolved backend instance', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(true);
      const resolver = createBackendResolver({ backend: 'auto' });

      // Act
      const backend = await resolver.getBackend();

      // Assert
      expect(backend).toBe(mockKeychainBackend);
    });
  });

  describe('isKeychainAvailable', () => {
    it('should delegate to module function', async () => {
      // Arrange
      isKeychainAvailable.mockResolvedValue(true);
      const resolver = createBackendResolver();

      // Act
      const result = await resolver.isKeychainAvailable();

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('getKeychainLoadError', () => {
    it('should delegate to module function', () => {
      // Arrange
      getKeychainLoadError.mockReturnValue('Some error');
      const resolver = createBackendResolver();

      // Act
      const result = resolver.getKeychainLoadError();

      // Assert
      expect(result).toBe('Some error');
    });
  });
});
