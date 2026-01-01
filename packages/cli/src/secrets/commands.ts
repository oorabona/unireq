/**
 * Secret management REPL commands
 */

import { confirm, isCancel, password } from '@clack/prompts';
import { consola } from 'consola';
import type { Command, CommandHandler } from '../repl/types.js';
import {
  InvalidPassphraseError,
  VaultAlreadyExistsError,
  VaultLockedError,
  VaultNotInitializedError,
} from './types.js';
import { createVault } from './vault.js';

/**
 * Ensure vault is initialized and unlocked
 * Returns true if vault is ready, false if operation was cancelled
 */
async function ensureVaultUnlocked(state: { vault?: import('./types.js').IVault }): Promise<boolean> {
  // Create vault instance if not exists
  if (!state.vault) {
    state.vault = createVault();
  }

  const vault = state.vault;

  // Check vault state
  const vaultState = vault.getState();

  if (vaultState === 'unlocked') {
    return true;
  }

  // Check if vault exists on disk
  const exists = await vault.exists();

  if (!exists) {
    consola.warn('Vault not initialized.');
    consola.info("Use 'secret init' to create a new vault.");
    return false;
  }

  // Vault exists but is locked - prompt for passphrase
  const passphraseResult = await password({
    message: 'Enter vault passphrase:',
    mask: '*',
  });

  if (isCancel(passphraseResult)) {
    consola.info('Cancelled.');
    return false;
  }

  try {
    await vault.unlock(passphraseResult as string);
    consola.success('Vault unlocked.');
    return true;
  } catch (error) {
    if (error instanceof InvalidPassphraseError) {
      consola.error('Invalid passphrase.');
    } else {
      consola.error(`Failed to unlock vault: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
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
async function handleSet(args: string[], state: { vault?: import('./types.js').IVault }): Promise<void> {
  const name = args[0];
  if (!name) {
    consola.warn('Usage: secret set <name> [value]');
    return;
  }

  // Ensure vault is unlocked
  if (!(await ensureVaultUnlocked(state)) || !state.vault) {
    return;
  }

  const vault = state.vault;

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
    await vault.set(name, value);
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
async function handleGet(args: string[], state: { vault?: import('./types.js').IVault }): Promise<void> {
  const name = args[0];
  if (!name) {
    consola.warn('Usage: secret get <name>');
    return;
  }

  // Ensure vault is unlocked
  if (!(await ensureVaultUnlocked(state)) || !state.vault) {
    return;
  }

  const vault = state.vault;

  try {
    const value = vault.get(name);
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
async function handleList(state: { vault?: import('./types.js').IVault }): Promise<void> {
  // Ensure vault is unlocked
  if (!(await ensureVaultUnlocked(state)) || !state.vault) {
    return;
  }

  const vault = state.vault;

  try {
    const secrets = vault.list();

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
async function handleDelete(args: string[], state: { vault?: import('./types.js').IVault }): Promise<void> {
  const name = args[0];
  if (!name) {
    consola.warn('Usage: secret delete <name>');
    return;
  }

  // Ensure vault is unlocked
  if (!(await ensureVaultUnlocked(state)) || !state.vault) {
    return;
  }

  const vault = state.vault;

  try {
    // Check if secret exists
    const value = vault.get(name);
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

    await vault.delete(name);
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
 * Handle 'secret status' - show vault status
 */
function handleStatus(state: { vault?: import('./types.js').IVault }): void {
  if (!state.vault) {
    state.vault = createVault();
  }

  const vaultState = state.vault.getState();

  consola.info(`\nVault status: ${vaultState}`);

  if (vaultState === 'unlocked') {
    const count = state.vault.list().length;
    consola.info(`Secrets stored: ${count}`);
  }

  consola.info('');
}

/**
 * Secret command handler
 * Handles: secret init, secret unlock, secret lock, secret set, secret get, secret list, secret delete, secret status
 */
export const secretHandler: CommandHandler = async (args, state) => {
  const subcommand = args[0]?.toLowerCase();

  // Default to 'status' if no subcommand
  if (!subcommand || subcommand === 'status') {
    return handleStatus(state);
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
  consola.info('Available: secret init, unlock, lock, set, get, list, delete, status');
};

/**
 * Create secret command
 */
export function createSecretCommand(): Command {
  return {
    name: 'secret',
    description: 'Manage secrets vault (init, set, get, list, delete)',
    handler: secretHandler,
  };
}
