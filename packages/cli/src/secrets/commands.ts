/**
 * Secret management REPL commands
 *
 * Supports multiple secret storage backends:
 * - keychain: OS native keychain (no passphrase required)
 * - vault: Encrypted local vault (passphrase required)
 *
 * Backend selection is configured via workspace.secrets.backend setting:
 * - 'auto': Try keychain first, fallback to vault (default)
 * - 'keychain': Force keychain, error if unavailable
 * - 'vault': Force vault, ignore keychain
 */

import { confirm, isCancel, password } from '@clack/prompts';
import { consola } from 'consola';
import type { Command, CommandHandler } from '../repl/types.js';
import { createBackendResolver, type ResolvedBackend, type SecretBackendResolver } from './backend-resolver.js';
import type { ISecretBackend } from './backend-types.js';
import {
  InvalidPassphraseError,
  KeychainUnavailableError,
  VaultAlreadyExistsError,
  VaultLockedError,
  VaultNotInitializedError,
} from './types.js';
import { createVault } from './vault.js';

/**
 * Extended state with backend resolver
 */
interface SecretState {
  vault?: import('./types.js').IVault;
  secretBackendResolver?: SecretBackendResolver;
  resolvedBackend?: ResolvedBackend;
}

/**
 * Get or create the backend resolver from state
 */
function getResolver(state: SecretState): SecretBackendResolver {
  if (!state.secretBackendResolver) {
    // TODO: Get backend config from workspace config when available
    state.secretBackendResolver = createBackendResolver();
  }
  return state.secretBackendResolver;
}

/**
 * Ensure backend is ready (initialized and unlocked if needed)
 * Returns the backend if ready, null if operation was cancelled or failed
 *
 * @internal Exported for testing and future command migration
 */
export async function ensureBackendReady(state: SecretState): Promise<ISecretBackend | null> {
  const resolver = getResolver(state);

  try {
    const resolved = await resolver.resolve();
    state.resolvedBackend = resolved;

    if (resolved.fallback) {
      consola.info(`Using vault backend (keychain unavailable: ${resolved.fallbackReason})`);
    }

    const backend = resolved.backend;

    // Check if already unlocked
    if (backend.isUnlocked()) {
      return backend;
    }

    // For keychain backend, just check availability
    if (backend.type === 'keychain') {
      if (await backend.isAvailable()) {
        return backend;
      }
      consola.error('Keychain is not available.');
      return null;
    }

    // For vault backend, check if it needs initialization
    if (await backend.requiresInit()) {
      consola.warn('Vault not initialized.');
      consola.info("Use 'secret init' to create a new vault.");
      return null;
    }

    // Vault exists but is locked - prompt for passphrase
    const passphraseResult = await password({
      message: 'Enter vault passphrase:',
      mask: '*',
    });

    if (isCancel(passphraseResult)) {
      consola.info('Cancelled.');
      return null;
    }

    try {
      await backend.unlock(passphraseResult as string);
      consola.success('Vault unlocked.');
      return backend;
    } catch (error) {
      if (error instanceof InvalidPassphraseError) {
        consola.error('Invalid passphrase.');
      } else {
        consola.error(`Failed to unlock vault: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    }
  } catch (error) {
    if (error instanceof KeychainUnavailableError) {
      consola.error(error.message);
    } else {
      consola.error(`Backend error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}

/**
 * Handle 'secret init' - initialize a new vault
 */
async function handleInit(state: { vault?: import('./types.js').IVault }): Promise<void> {
  // Create vault instance if not exists
  if (!state.vault) {
    state.vault = createVault();
  }

  const vault = state.vault;

  // Check if vault already exists
  if (await vault.exists()) {
    consola.warn('Vault already exists.');
    consola.info("Use 'secret unlock' to access it.");
    return;
  }

  // Prompt for passphrase
  const passphraseResult = await password({
    message: 'Enter passphrase for new vault:',
    mask: '*',
    validate: (value) => {
      if (!value || value.length < 8) {
        return 'Passphrase must be at least 8 characters';
      }
      return undefined;
    },
  });

  if (isCancel(passphraseResult)) {
    consola.info('Cancelled.');
    return;
  }

  // Confirm passphrase
  const confirmResult = await password({
    message: 'Confirm passphrase:',
    mask: '*',
  });

  if (isCancel(confirmResult)) {
    consola.info('Cancelled.');
    return;
  }

  if (passphraseResult !== confirmResult) {
    consola.error('Passphrases do not match.');
    return;
  }

  try {
    await vault.initialize(passphraseResult as string);
    consola.success('Vault initialized and unlocked.');
  } catch (error) {
    if (error instanceof VaultAlreadyExistsError) {
      consola.error('Vault already exists.');
    } else {
      consola.error(`Failed to initialize vault: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Handle 'secret unlock' - unlock existing vault
 */
async function handleUnlock(state: { vault?: import('./types.js').IVault }): Promise<void> {
  // Create vault instance if not exists
  if (!state.vault) {
    state.vault = createVault();
  }

  const vault = state.vault;

  // Check current state
  if (vault.getState() === 'unlocked') {
    consola.info('Vault is already unlocked.');
    return;
  }

  // Check if vault exists
  if (!(await vault.exists())) {
    consola.warn('Vault not initialized.');
    consola.info("Use 'secret init' to create a new vault.");
    return;
  }

  // Prompt for passphrase
  const passphraseResult = await password({
    message: 'Enter vault passphrase:',
    mask: '*',
  });

  if (isCancel(passphraseResult)) {
    consola.info('Cancelled.');
    return;
  }

  try {
    await vault.unlock(passphraseResult as string);
    consola.success('Vault unlocked.');
  } catch (error) {
    if (error instanceof InvalidPassphraseError) {
      consola.error('Invalid passphrase.');
    } else if (error instanceof VaultNotInitializedError) {
      consola.error('Vault not initialized.');
    } else {
      consola.error(`Failed to unlock vault: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Handle 'secret lock' - lock the vault
 */
function handleLock(state: { vault?: import('./types.js').IVault }): void {
  if (!state.vault) {
    consola.info('Vault not loaded.');
    return;
  }

  if (state.vault.getState() !== 'unlocked') {
    consola.info('Vault is already locked.');
    return;
  }

  state.vault.lock();
  consola.success('Vault locked.');
}

/**
 * Handle 'secret set <name> [value]' - set a secret
 */
async function handleSet(args: string[], state: SecretState): Promise<void> {
  const name = args[0];
  if (!name) {
    consola.warn('Usage: secret set <name> [value]');
    return;
  }

  // Ensure backend is ready
  const backend = await ensureBackendReady(state);
  if (!backend) {
    return;
  }

  // Get value from args or prompt
  let value = args.slice(1).join(' ');

  if (!value) {
    // Prompt for value (hidden)
    const valueResult = await password({
      message: `Enter value for '${name}':`,
      mask: '*',
    });

    if (isCancel(valueResult)) {
      consola.info('Cancelled.');
      return;
    }

    value = valueResult as string;
  }

  try {
    await backend.set(name, value);
    consola.success(`Secret '${name}' saved.`);
  } catch (error) {
    if (error instanceof VaultLockedError) {
      consola.error('Vault is locked.');
    } else {
      consola.error(`Failed to save secret: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Handle 'secret get <name>' - get a secret value
 */
async function handleGet(args: string[], state: SecretState): Promise<void> {
  const name = args[0];
  if (!name) {
    consola.warn('Usage: secret get <name>');
    return;
  }

  // Ensure backend is ready
  const backend = await ensureBackendReady(state);
  if (!backend) {
    return;
  }

  try {
    const value = await backend.get(name);
    if (value === undefined) {
      consola.warn(`Secret '${name}' not found.`);
    } else {
      // Ask for confirmation before revealing
      const showResult = await confirm({
        message: 'Show secret value? (will be visible in terminal)',
        initialValue: false,
      });

      if (isCancel(showResult) || !showResult) {
        consola.info('Secret exists but value not shown.');
      } else {
        consola.info(`${name}: ${value}`);
      }
    }
  } catch (error) {
    if (error instanceof VaultLockedError) {
      consola.error('Vault is locked.');
    } else {
      consola.error(`Failed to get secret: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Handle 'secret list' - list all secret names
 */
async function handleList(state: SecretState): Promise<void> {
  // Ensure backend is ready
  const backend = await ensureBackendReady(state);
  if (!backend) {
    return;
  }

  try {
    const secrets = await backend.list();

    if (secrets.length === 0) {
      consola.info('No secrets stored.');
      consola.info("Use 'secret set <name>' to add secrets.");
    } else {
      consola.info(`\nSecrets (${secrets.length}):`);
      for (const name of secrets) {
        consola.info(`  ${name}`);
      }
      consola.info('');
    }
  } catch (error) {
    if (error instanceof VaultLockedError) {
      consola.error('Vault is locked.');
    } else {
      consola.error(`Failed to list secrets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Handle 'secret delete <name>' - delete a secret
 */
async function handleDelete(args: string[], state: SecretState): Promise<void> {
  const name = args[0];
  if (!name) {
    consola.warn('Usage: secret delete <name>');
    return;
  }

  // Ensure backend is ready
  const backend = await ensureBackendReady(state);
  if (!backend) {
    return;
  }

  try {
    // Check if secret exists
    const value = await backend.get(name);
    if (value === undefined) {
      consola.warn(`Secret '${name}' not found.`);
      return;
    }

    // Confirm deletion
    const confirmResult = await confirm({
      message: `Delete secret '${name}'?`,
      initialValue: false,
    });

    if (isCancel(confirmResult) || !confirmResult) {
      consola.info('Cancelled.');
      return;
    }

    await backend.delete(name);
    consola.success(`Secret '${name}' deleted.`);
  } catch (error) {
    if (error instanceof VaultLockedError) {
      consola.error('Vault is locked.');
    } else {
      consola.error(`Failed to delete secret: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Handle 'secret status' - show backend and secret status
 */
async function handleStatus(state: SecretState): Promise<void> {
  const resolver = getResolver(state);

  consola.info('\n=== Secret Storage Status ===\n');

  // Show configured backend mode
  const configuredBackend = resolver.getConfiguredBackend();
  consola.info(`Configured mode: ${configuredBackend}`);

  // Check keychain availability
  const keychainAvailable = await resolver.isKeychainAvailable();
  if (keychainAvailable) {
    consola.info('Keychain: available');
  } else {
    const reason = resolver.getKeychainLoadError() || 'Not available';
    consola.info(`Keychain: unavailable (${reason})`);
  }

  // Show active backend if resolved
  if (state.resolvedBackend) {
    const { type, fallback, fallbackReason } = state.resolvedBackend;
    consola.info(`\nActive backend: ${type}`);
    if (fallback) {
      consola.info(`  (fallback: ${fallbackReason})`);
    }

    const backend = state.resolvedBackend.backend;
    const unlocked = backend.isUnlocked();
    consola.info(`Status: ${unlocked ? 'unlocked' : 'locked'}`);

    if (unlocked) {
      const secrets = await backend.list();
      consola.info(`Secrets stored: ${secrets.length}`);
    }
  } else {
    // Legacy vault check for backward compatibility
    if (state.vault) {
      const vaultState = state.vault.getState();
      consola.info(`\nVault status: ${vaultState}`);

      if (vaultState === 'unlocked') {
        const count = state.vault.list().length;
        consola.info(`Secrets stored: ${count}`);
      }
    } else {
      consola.info('\nBackend not yet resolved. Run a secret command to initialize.');
    }
  }

  consola.info('');
}

/**
 * Handle 'secret backend' - show or change backend mode
 */
async function handleBackend(args: string[], state: SecretState): Promise<void> {
  const resolver = getResolver(state);
  const subCommand = args[0]?.toLowerCase();

  if (!subCommand || subCommand === 'status') {
    // Show current backend status
    const configuredBackend = resolver.getConfiguredBackend();
    consola.info(`\nConfigured backend: ${configuredBackend}`);

    const keychainAvailable = await resolver.isKeychainAvailable();
    if (keychainAvailable) {
      consola.info('Keychain: available');
    } else {
      const reason = resolver.getKeychainLoadError() || 'Not available';
      consola.info(`Keychain: unavailable (${reason})`);
    }

    if (state.resolvedBackend) {
      consola.info(`Active backend: ${state.resolvedBackend.type}`);
      if (state.resolvedBackend.fallback) {
        consola.info(`  (fallback: ${state.resolvedBackend.fallbackReason})`);
      }
    }

    consola.info('\nTo change backend, edit workspace.yaml:');
    consola.info('  secrets:');
    consola.info('    backend: auto | keychain | vault');
    consola.info('');
    return;
  }

  // Unknown subcommand
  consola.warn(`Unknown backend subcommand: ${subCommand}`);
  consola.info('Usage: secret backend [status]');
}

/**
 * Secret command handler
 * Handles: secret init, unlock, lock, set, get, list, delete, status, backend
 */
export const secretHandler: CommandHandler = async (args, state) => {
  const subcommand = args[0]?.toLowerCase();

  // Default to 'status' if no subcommand
  if (!subcommand || subcommand === 'status') {
    return handleStatus(state as SecretState);
  }

  if (subcommand === 'backend') {
    return handleBackend(args.slice(1), state as SecretState);
  }

  if (subcommand === 'init') {
    return handleInit(state);
  }

  if (subcommand === 'unlock') {
    return handleUnlock(state);
  }

  if (subcommand === 'lock') {
    return handleLock(state);
  }

  if (subcommand === 'set') {
    return handleSet(args.slice(1), state);
  }

  if (subcommand === 'get') {
    return handleGet(args.slice(1), state);
  }

  if (subcommand === 'list') {
    return handleList(state);
  }

  if (subcommand === 'delete' || subcommand === 'rm') {
    return handleDelete(args.slice(1), state);
  }

  // Unknown subcommand
  consola.warn(`Unknown subcommand: ${subcommand}`);
  consola.info('Available: secret init, unlock, lock, set, get, list, delete, status, backend');
};

/**
 * Create secret command
 */
export function createSecretCommand(): Command {
  return {
    name: 'secret',
    description: 'Manage secrets (keychain or vault)',
    handler: secretHandler,
  };
}
