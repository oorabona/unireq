/**
 * Key Derivation Function using Argon2id (BASELINE 2025)
 *
 * Uses @node-rs/argon2 for high-performance Argon2id implementation
 * with native bindings and WASM fallback.
 *
 * Parameters follow OWASP/NIST 2025 recommendations:
 * - Memory: 64 MB
 * - Iterations: 3
 * - Parallelism: 4
 */

import { hashRaw } from '@node-rs/argon2';
import { type Argon2idParams, DEFAULT_ARGON2ID_PARAMS } from './types.js';

/**
 * Derive an encryption key from a passphrase using Argon2id
 *
 * @param passphrase - User passphrase
 * @param salt - Salt for key derivation (16 bytes recommended)
 * @param params - Argon2id parameters (optional, uses OWASP defaults)
 * @returns Derived key as Buffer
 *
 * @example
 * const salt = generateSalt();
 * const key = await deriveKeyArgon2id('my-passphrase', salt);
 * // key is a 32-byte Buffer suitable for AES-256
 */
export async function deriveKeyArgon2id(
  passphrase: string,
  salt: Buffer,
  params: Argon2idParams = DEFAULT_ARGON2ID_PARAMS,
): Promise<Buffer> {
  const rawHash = await hashRaw(passphrase, {
    salt,
    memoryCost: params.memoryCost,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
    outputLen: params.outputLen,
  });

  return rawHash;
}

/**
 * Get default Argon2id parameters
 */
export function getArgon2idParams(): Argon2idParams {
  return { ...DEFAULT_ARGON2ID_PARAMS };
}
