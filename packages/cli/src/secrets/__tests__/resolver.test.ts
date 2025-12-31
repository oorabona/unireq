/**
 * Tests for secret resolver
 */

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSafeSecretResolver, createSecretResolver } from '../resolver.js';
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
