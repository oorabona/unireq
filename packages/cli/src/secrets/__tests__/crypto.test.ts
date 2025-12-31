/**
 * Tests for encryption/decryption
 */

import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '../crypto.js';
import type { VaultContents } from '../types.js';

describe('encrypt and decrypt', () => {
  const createKey = (): Buffer => randomBytes(32);

  it('should encrypt and decrypt empty secrets', () => {
    // Arrange
    const key = createKey();
    const contents: VaultContents = { secrets: {} };

    // Act
    const encrypted = encrypt(contents, key);
    const decrypted = decrypt(encrypted, key);

    // Assert
    expect(decrypted).toEqual(contents);
  });

  it('should encrypt and decrypt multiple secrets', () => {
    // Arrange
    const key = createKey();
    const contents: VaultContents = {
      secrets: {
        apiKey: 'sk-123456789',
        password: 'super-secret',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      },
    };

    // Act
    const encrypted = encrypt(contents, key);
    const decrypted = decrypt(encrypted, key);

    // Assert
    expect(decrypted).toEqual(contents);
  });

  it('should produce different ciphertext for same content (random IV)', () => {
    // Arrange
    const key = createKey();
    const contents: VaultContents = { secrets: { key: 'value' } };

    // Act
    const encrypted1 = encrypt(contents, key);
    const encrypted2 = encrypt(contents, key);

    // Assert
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  it('should fail decryption with wrong key', () => {
    // Arrange
    const key1 = createKey();
    const key2 = createKey();
    const contents: VaultContents = { secrets: { key: 'value' } };

    // Act
    const encrypted = encrypt(contents, key1);

    // Assert
    expect(() => decrypt(encrypted, key2)).toThrow();
  });

  it('should fail decryption with tampered ciphertext', () => {
    // Arrange
    const key = createKey();
    const contents: VaultContents = { secrets: { key: 'value' } };
    const encrypted = encrypt(contents, key);

    // Tamper with ciphertext
    const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
    tamperedCiphertext[0] = tamperedCiphertext[0] !== undefined ? tamperedCiphertext[0] ^ 0xff : 0;
    encrypted.ciphertext = tamperedCiphertext.toString('base64');

    // Assert
    expect(() => decrypt(encrypted, key)).toThrow();
  });

  it('should fail decryption with tampered authTag', () => {
    // Arrange
    const key = createKey();
    const contents: VaultContents = { secrets: { key: 'value' } };
    const encrypted = encrypt(contents, key);

    // Tamper with auth tag
    const tamperedTag = Buffer.from(encrypted.authTag, 'base64');
    tamperedTag[0] = tamperedTag[0] !== undefined ? tamperedTag[0] ^ 0xff : 0;
    encrypted.authTag = tamperedTag.toString('base64');

    // Assert
    expect(() => decrypt(encrypted, key)).toThrow();
  });

  it('should handle secrets with special characters', () => {
    // Arrange
    const key = createKey();
    const contents: VaultContents = {
      secrets: {
        special: 'value with "quotes" and \\backslashes\\',
        unicode: '日本語テスト',
        newlines: 'line1\nline2\r\nline3',
      },
    };

    // Act
    const encrypted = encrypt(contents, key);
    const decrypted = decrypt(encrypted, key);

    // Assert
    expect(decrypted).toEqual(contents);
  });

  it('should handle large secrets', () => {
    // Arrange
    const key = createKey();
    const largeValue = 'x'.repeat(100000);
    const contents: VaultContents = {
      secrets: { large: largeValue },
    };

    // Act
    const encrypted = encrypt(contents, key);
    const decrypted = decrypt(encrypted, key);

    // Assert
    expect(decrypted.secrets['large']).toBe(largeValue);
  });
});
