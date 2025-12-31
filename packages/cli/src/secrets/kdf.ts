/**
 * Key Derivation Function using scrypt
 *
 * Uses Node.js built-in crypto module for scrypt implementation.
 */

import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { DEFAULT_SCRYPT_PARAMS, type ScryptParams } from './types.js';

/**
 * Promisified scrypt wrapper
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Generate a random salt for key derivation
 *
 * @param length - Salt length in bytes (default: 16)
 * @returns Random salt as Buffer
 */
export function generateSalt(length = 16): Buffer {
  return randomBytes(length);
}

/**
 * Derive an encryption key from a passphrase using scrypt
 *
 * @param passphrase - User passphrase
 * @param salt - Salt for key derivation
 * @param params - Scrypt parameters (optional, uses defaults)
 * @returns Derived key as Buffer
 *
 * @example
 * const salt = generateSalt();
 * const key = await deriveKey('my-passphrase', salt);
 * // key is a 32-byte Buffer suitable for AES-256
 */
export async function deriveKey(
  passphrase: string,
  salt: Buffer,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
): Promise<Buffer> {
  const key = await scryptAsync(passphrase, salt, params.keyLen, {
    N: params.N,
    r: params.r,
    p: params.p,
  });
  return key as Buffer;
}

/**
 * Verify a passphrase by attempting to derive the same key
 *
 * Note: This is implicit - if decryption succeeds with derived key,
 * the passphrase is correct. This function is mainly for documentation.
 */
export function getScryptParams(): ScryptParams {
  return { ...DEFAULT_SCRYPT_PARAMS };
}
