/**
 * Tests for Key Derivation Function
 */

import { describe, expect, it } from 'vitest';
import { deriveKey, generateSalt, getScryptParams } from '../kdf.js';
import { DEFAULT_SCRYPT_PARAMS } from '../types.js';

describe('generateSalt', () => {
  it('should generate salt with default length of 16 bytes', () => {
    // Act
    const salt = generateSalt();

    // Assert
    expect(salt).toBeInstanceOf(Buffer);
    expect(salt.length).toBe(16);
  });

  it('should generate salt with custom length', () => {
    // Act
    const salt = generateSalt(32);

    // Assert
    expect(salt.length).toBe(32);
  });

  it('should generate unique salts', () => {
    // Act
    const salt1 = generateSalt();
    const salt2 = generateSalt();

    // Assert
    expect(salt1.equals(salt2)).toBe(false);
  });
});

describe('deriveKey', () => {
  it('should derive a 32-byte key', async () => {
    // Arrange
    const passphrase = 'test-passphrase';
    const salt = generateSalt();

    // Act
    const key = await deriveKey(passphrase, salt);

    // Assert
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('should derive same key for same passphrase and salt', async () => {
    // Arrange
    const passphrase = 'test-passphrase';
    const salt = generateSalt();

    // Act
    const key1 = await deriveKey(passphrase, salt);
    const key2 = await deriveKey(passphrase, salt);

    // Assert
    expect(key1.equals(key2)).toBe(true);
  });

  it('should derive different keys for different passphrases', async () => {
    // Arrange
    const salt = generateSalt();

    // Act
    const key1 = await deriveKey('passphrase-1', salt);
    const key2 = await deriveKey('passphrase-2', salt);

    // Assert
    expect(key1.equals(key2)).toBe(false);
  });

  it('should derive different keys for different salts', async () => {
    // Arrange
    const passphrase = 'test-passphrase';

    // Act
    const key1 = await deriveKey(passphrase, generateSalt());
    const key2 = await deriveKey(passphrase, generateSalt());

    // Assert
    expect(key1.equals(key2)).toBe(false);
  });

  it('should use custom scrypt parameters', async () => {
    // Arrange
    const passphrase = 'test-passphrase';
    const salt = generateSalt();
    const customParams = { N: 1024, r: 8, p: 1, keyLen: 16 };

    // Act
    const key = await deriveKey(passphrase, salt, customParams);

    // Assert
    expect(key.length).toBe(16);
  });
});

describe('getScryptParams', () => {
  it('should return default parameters', () => {
    // Act
    const params = getScryptParams();

    // Assert
    expect(params).toEqual(DEFAULT_SCRYPT_PARAMS);
  });

  it('should return a copy (not reference)', () => {
    // Act
    const params = getScryptParams();
    params.N = 999;

    // Assert
    expect(getScryptParams().N).toBe(DEFAULT_SCRYPT_PARAMS.N);
  });
});
