/**
 * Tests for Argon2id Key Derivation Function
 */

import { describe, expect, it } from 'vitest';
import { generateSalt } from '../kdf.js';
import { deriveKeyArgon2id, getArgon2idParams } from '../kdf-argon2.js';
import { DEFAULT_ARGON2ID_PARAMS } from '../types.js';

describe('deriveKeyArgon2id', () => {
  // Use faster params for testing (production uses 64MB memory)
  const testParams = {
    memoryCost: 1024, // 1 MB for faster tests
    timeCost: 1,
    parallelism: 1,
    outputLen: 32,
  };

  it('should derive a 32-byte key with default params', async () => {
    // Arrange
    const passphrase = 'test-passphrase';
    const salt = generateSalt();

    // Act
    const key = await deriveKeyArgon2id(passphrase, salt, testParams);

    // Assert
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('should derive same key for same passphrase and salt', async () => {
    // Arrange
    const passphrase = 'test-passphrase';
    const salt = generateSalt();

    // Act
    const key1 = await deriveKeyArgon2id(passphrase, salt, testParams);
    const key2 = await deriveKeyArgon2id(passphrase, salt, testParams);

    // Assert
    expect(key1.equals(key2)).toBe(true);
  });

  it('should derive different keys for different passphrases', async () => {
    // Arrange
    const salt = generateSalt();

    // Act
    const key1 = await deriveKeyArgon2id('passphrase-1', salt, testParams);
    const key2 = await deriveKeyArgon2id('passphrase-2', salt, testParams);

    // Assert
    expect(key1.equals(key2)).toBe(false);
  });

  it('should derive different keys for different salts', async () => {
    // Arrange
    const passphrase = 'test-passphrase';

    // Act
    const key1 = await deriveKeyArgon2id(passphrase, generateSalt(), testParams);
    const key2 = await deriveKeyArgon2id(passphrase, generateSalt(), testParams);

    // Assert
    expect(key1.equals(key2)).toBe(false);
  });

  it('should use custom output length', async () => {
    // Arrange
    const passphrase = 'test-passphrase';
    const salt = generateSalt();
    const customParams = { ...testParams, outputLen: 16 };

    // Act
    const key = await deriveKeyArgon2id(passphrase, salt, customParams);

    // Assert
    expect(key.length).toBe(16);
  });

  it('should handle empty passphrase', async () => {
    // Arrange
    const passphrase = '';
    const salt = generateSalt();

    // Act
    const key = await deriveKeyArgon2id(passphrase, salt, testParams);

    // Assert
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('should handle unicode passphrase', async () => {
    // Arrange
    const passphrase = '密码测试 🔐 пароль';
    const salt = generateSalt();

    // Act
    const key = await deriveKeyArgon2id(passphrase, salt, testParams);

    // Assert
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('should produce consistent results with same parameters', async () => {
    // Arrange
    const passphrase = 'consistent-test';
    const salt = Buffer.from('1234567890123456'); // Fixed salt

    // Act - derive multiple times
    const keys = await Promise.all([
      deriveKeyArgon2id(passphrase, salt, testParams),
      deriveKeyArgon2id(passphrase, salt, testParams),
      deriveKeyArgon2id(passphrase, salt, testParams),
    ]);

    // Assert - all keys should be identical
    const [key0, key1, key2] = keys;
    expect(key0?.equals(key1 as Buffer)).toBe(true);
    expect(key1?.equals(key2 as Buffer)).toBe(true);
  });
});

describe('getArgon2idParams', () => {
  it('should return default parameters', () => {
    // Act
    const params = getArgon2idParams();

    // Assert
    expect(params).toEqual(DEFAULT_ARGON2ID_PARAMS);
  });

  it('should return a copy (not reference)', () => {
    // Act
    const params = getArgon2idParams();
    params.memoryCost = 999;

    // Assert
    expect(getArgon2idParams().memoryCost).toBe(DEFAULT_ARGON2ID_PARAMS.memoryCost);
  });

  it('should have OWASP recommended values', () => {
    // Act
    const params = getArgon2idParams();

    // Assert - OWASP 2025 recommendations
    expect(params.memoryCost).toBe(65536); // 64 MB
    expect(params.timeCost).toBe(3);
    expect(params.parallelism).toBe(4);
    expect(params.outputLen).toBe(32); // 256 bits for AES-256
  });
});
