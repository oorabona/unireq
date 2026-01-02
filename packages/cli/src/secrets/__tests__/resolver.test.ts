/**
 * Tests for secret resolver
 */

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createProfileSecretResolver,
  createSafeProfileSecretResolver,
  createSafeSecretResolver,
  createSecretResolver,
} from '../resolver.js';
import { Vault } from '../vault.js';

describe('createSecretResolver', () => {
  let vaultDir: string;
  let vault: Vault;

  beforeEach(async () => {
    vaultDir = join(tmpdir(), `resolver-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    vault = new Vault(vaultDir);
    await vault.initialize('passphrase');
  });

  afterEach(async () => {
    try {
      await rm(vaultDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return secret value when it exists', async () => {
    // Arrange
    await vault.set('apiKey', 'secret-value-123');
    const resolver = createSecretResolver(vault);

    // Act
    const value = resolver('apiKey');

    // Assert
    expect(value).toBe('secret-value-123');
  });

  it('should throw for non-existent secret', () => {
    // Arrange
    const resolver = createSecretResolver(vault);

    // Act & Assert
    expect(() => resolver('nonexistent')).toThrow('Secret not found: nonexistent');
  });

  it('should throw when vault is locked', () => {
    // Arrange
    const resolver = createSecretResolver(vault);
    vault.lock();

    // Act & Assert
    expect(() => resolver('anyKey')).toThrow('Vault is locked');
  });
});

describe('createSafeSecretResolver', () => {
  let vaultDir: string;
  let vault: Vault;

  beforeEach(async () => {
    vaultDir = join(tmpdir(), `safe-resolver-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    vault = new Vault(vaultDir);
    await vault.initialize('passphrase');
  });

  afterEach(async () => {
    try {
      await rm(vaultDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return secret value when it exists', async () => {
    // Arrange
    await vault.set('apiKey', 'secret-value-123');
    const resolver = createSafeSecretResolver(vault);

    // Act
    const value = resolver('apiKey');

    // Assert
    expect(value).toBe('secret-value-123');
  });

  it('should return placeholder for non-existent secret', () => {
    // Arrange
    const resolver = createSafeSecretResolver(vault);

    // Act
    const value = resolver('nonexistent');

    // Assert
    expect(value).toBe('<secret:nonexistent>');
  });

  it('should return placeholder when vault is locked', () => {
    // Arrange
    const resolver = createSafeSecretResolver(vault);
    vault.lock();

    // Act
    const value = resolver('anyKey');

    // Assert
    expect(value).toBe('<secret:anyKey>');
  });
});

describe('createProfileSecretResolver', () => {
  let vaultDir: string;
  let vault: Vault;

  beforeEach(async () => {
    vaultDir = join(tmpdir(), `profile-resolver-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    vault = new Vault(vaultDir);
    await vault.initialize('passphrase');
  });

  afterEach(async () => {
    try {
      await rm(vaultDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return direct profile secret value', () => {
    // Arrange
    const resolver = createProfileSecretResolver({
      profileSecrets: { 'api-key': 'direct-value' },
    });

    // Act
    const value = resolver('api-key');

    // Assert
    expect(value).toBe('direct-value');
  });

  it('should resolve vault reference in profile secret', async () => {
    // Arrange
    await vault.set('prod-key', 'vault-secret-value');
    const vaultResolver = createSecretResolver(vault);
    const resolver = createProfileSecretResolver({
      profileSecrets: { 'api-key': '${secret:prod-key}' },
      vaultResolver,
    });

    // Act
    const value = resolver('api-key');

    // Assert
    expect(value).toBe('vault-secret-value');
  });

  it('should fallback to vault for non-profile secrets', async () => {
    // Arrange
    await vault.set('other-key', 'other-value');
    const vaultResolver = createSecretResolver(vault);
    const resolver = createProfileSecretResolver({
      profileSecrets: { 'api-key': 'profile-value' },
      vaultResolver,
    });

    // Act
    const value = resolver('other-key');

    // Assert
    expect(value).toBe('other-value');
  });

  it('should throw for non-existent secret without vault', () => {
    // Arrange
    const resolver = createProfileSecretResolver({
      profileSecrets: {},
    });

    // Act & Assert
    expect(() => resolver('nonexistent')).toThrow('Secret not found: nonexistent');
  });

  it('should profile secrets override vault lookup', async () => {
    // Arrange - profile has direct value, vault has different value
    await vault.set('api-key', 'vault-value');
    const vaultResolver = createSecretResolver(vault);
    const resolver = createProfileSecretResolver({
      profileSecrets: { 'api-key': 'profile-value' },
      vaultResolver,
    });

    // Act
    const value = resolver('api-key');

    // Assert - profile takes precedence
    expect(value).toBe('profile-value');
  });

  it('should handle workspace + profile secret merging (profile overrides)', async () => {
    // Scenario S-13: Profile secret overrides workspace secret
    await vault.set('ws-key', 'workspace-secret');
    await vault.set('prod-key', 'production-secret');

    // Merged secrets: profile 'prod-key' overrides workspace 'ws-key'
    const mergedSecrets = {
      'api-key': '${secret:prod-key}', // From profile (overrides workspace)
    };

    const vaultResolver = createSecretResolver(vault);
    const resolver = createProfileSecretResolver({
      profileSecrets: mergedSecrets,
      vaultResolver,
    });

    // Act
    const value = resolver('api-key');

    // Assert - resolves to prod-key from vault
    expect(value).toBe('production-secret');
  });
});

describe('createSafeProfileSecretResolver', () => {
  let vaultDir: string;
  let vault: Vault;

  beforeEach(async () => {
    vaultDir = join(tmpdir(), `safe-profile-resolver-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    vault = new Vault(vaultDir);
    await vault.initialize('passphrase');
  });

  afterEach(async () => {
    try {
      await rm(vaultDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return direct profile secret value', () => {
    // Arrange
    const resolver = createSafeProfileSecretResolver({
      profileSecrets: { 'api-key': 'direct-value' },
    });

    // Act
    const value = resolver('api-key');

    // Assert
    expect(value).toBe('direct-value');
  });

  it('should return placeholder for non-existent secret', () => {
    // Arrange
    const resolver = createSafeProfileSecretResolver({
      profileSecrets: {},
    });

    // Act
    const value = resolver('nonexistent');

    // Assert
    expect(value).toBe('<secret:nonexistent>');
  });

  it('should return placeholder when vault reference fails', () => {
    // Arrange - vault reference but vault resolver throws
    const vaultResolver = (): string => {
      throw new Error('Vault locked');
    };
    const resolver = createSafeProfileSecretResolver({
      profileSecrets: { 'api-key': '${secret:missing}' },
      vaultResolver,
    });

    // Act
    const value = resolver('api-key');

    // Assert
    expect(value).toBe('<secret:api-key>');
  });

  it('should resolve vault reference when available', async () => {
    // Arrange
    await vault.set('prod-key', 'vault-value');
    const vaultResolver = createSecretResolver(vault);
    const resolver = createSafeProfileSecretResolver({
      profileSecrets: { 'api-key': '${secret:prod-key}' },
      vaultResolver,
    });

    // Act
    const value = resolver('api-key');

    // Assert
    expect(value).toBe('vault-value');
  });
});
