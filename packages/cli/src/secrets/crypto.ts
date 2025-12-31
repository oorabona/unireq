/**
 * Encryption/Decryption using AES-256-GCM
 *
 * Uses Node.js built-in crypto module.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { EncryptedVault, VaultContents } from './types.js';

/** AES-256-GCM algorithm identifier */
const ALGORITHM = 'aes-256-gcm';

/** IV/Nonce length in bytes (96 bits for GCM) */
const IV_LENGTH = 12;

/** Auth tag length in bytes (128 bits) */
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt vault contents using AES-256-GCM
 *
 * @param contents - Vault contents to encrypt
 * @param key - 32-byte encryption key
 * @returns Encrypted vault data
 */
export function encrypt(contents: VaultContents, key: Buffer): EncryptedVault {
  // Generate random IV
  const iv = randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Serialize and encrypt
  const plaintext = JSON.stringify(contents);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt vault contents using AES-256-GCM
 *
 * @param encrypted - Encrypted vault data
 * @param key - 32-byte encryption key
 * @returns Decrypted vault contents
 * @throws Error if decryption fails (wrong key or tampered data)
 */
export function decrypt(encrypted: EncryptedVault, key: Buffer): VaultContents {
  // Decode from base64
  const iv = Buffer.from(encrypted.iv, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  // Decrypt
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  // Parse JSON
  return JSON.parse(decrypted.toString('utf8')) as VaultContents;
}
