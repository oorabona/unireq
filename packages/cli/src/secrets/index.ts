/**
 * Secrets vault module
 *
 * Provides encrypted storage for secrets with AES-256-GCM.
 */

// Commands
export { createSecretCommand, secretHandler } from './commands.js';

// Crypto
export { decrypt, encrypt } from './crypto.js';

// KDF
export { deriveKey, generateSalt, getScryptParams } from './kdf.js';
export type { ProfileSecretResolverOptions } from './resolver.js';
// Resolver
export {
  createProfileSecretResolver,
  createSafeProfileSecretResolver,
  createSafeSecretResolver,
  createSecretResolver,
} from './resolver.js';

// Types
export type {
  EncryptedVault,
  IVault,
  ScryptParams,
  VaultContents,
  VaultMetadata,
  VaultState,
} from './types.js';

// Errors
export {
  DEFAULT_SCRYPT_PARAMS,
  InvalidPassphraseError,
  SecretNotFoundError,
  VaultAlreadyExistsError,
  VaultLockedError,
  VaultNotInitializedError,
} from './types.js';

// Vault
export { createVault, Vault } from './vault.js';
