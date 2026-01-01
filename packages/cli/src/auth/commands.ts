/**
 * Auth management REPL commands
 */

import { confirm, isCancel, password } from '@clack/prompts';
import { consola } from 'consola';
import type { Command, CommandHandler } from '../repl/types.js';
import { createSecretResolver } from '../secrets/resolver.js';
import type { IVault } from '../secrets/types.js';
import { createVault } from '../secrets/vault.js';
import type { InterpolationContext } from '../workspace/variables/types.js';
import {
  LoginRequestError,
  OAuth2TokenError,
  resolveApiKeyProvider,
  resolveBearerProvider,
  resolveLoginJwtProvider,
  resolveOAuth2ClientCredentialsProvider,
  TokenExtractionError,
} from './providers/index.js';
import { getActiveProviderName, getProvider, listProviders, providerExists } from './registry.js';
import type { AuthConfig, AuthProviderConfig, ResolvedCredential } from './types.js';

/**
 * Ensure vault is unlocked for secret resolution
 * Returns secretResolver function or undefined if vault not available
 */
async function ensureSecretResolver(state: { vault?: IVault }): Promise<((name: string) => string) | undefined> {
  // Create vault instance if not exists
  if (!state.vault) {
    state.vault = createVault();
  }

  const vault = state.vault;

  // Check if vault exists
  if (!(await vault.exists())) {
    return undefined;
  }

  // Check vault state
  if (vault.getState() === 'unlocked') {
    return createSecretResolver(vault);
  }

  // Prompt for passphrase to unlock
  const passphraseResult = await password({
    message: 'Enter vault passphrase to access secrets:',
    mask: '*',
  });

  if (isCancel(passphraseResult)) {
    return undefined;
  }

  try {
    await vault.unlock(passphraseResult as string);
    return createSecretResolver(vault);
  } catch {
    consola.error('Failed to unlock vault.');
    return undefined;
  }
}

/**
 * Create interpolation context with secret resolver
 */
async function createInterpolationContext(
  vars: Record<string, string>,
  state: { vault?: IVault },
): Promise<InterpolationContext> {
  const secretResolver = await ensureSecretResolver(state);
  return {
    vars,
    secretResolver,
  };
}

/**
 * Resolve a provider configuration to credentials
 */
async function resolveProvider(
  providerName: string,
  config: AuthProviderConfig,
  context: InterpolationContext,
): Promise<ResolvedCredential | null> {
  try {
    switch (config.type) {
      case 'api_key':
        return resolveApiKeyProvider(config, context);

      case 'bearer':
        return resolveBearerProvider(config, context);

      case 'login_jwt':
        consola.info(`Executing login request for provider '${providerName}'...`);
        return await resolveLoginJwtProvider(config, context);

      case 'oauth2_client_credentials':
        consola.info(`Requesting OAuth2 token for provider '${providerName}'...`);
        return await resolveOAuth2ClientCredentialsProvider(config, context);

      default:
        consola.error(`Unknown provider type: ${(config as AuthProviderConfig).type}`);
        return null;
    }
  } catch (error) {
    if (error instanceof LoginRequestError) {
      consola.error(`Login failed: ${error.status} ${error.statusText}`);
      if (error.response) {
        consola.info(`Response: ${JSON.stringify(error.response)}`);
      }
      return null;
    }

    if (error instanceof TokenExtractionError) {
      consola.error(`Failed to extract token at path '${error.path}'`);
      consola.info('Check that the JSONPath expression matches the login response structure.');
      return null;
    }

    if (error instanceof OAuth2TokenError) {
      consola.error(`OAuth2 token request failed: ${error.status} ${error.statusText}`);
      if (error.error) {
        consola.info(`Error: ${error.error}${error.errorDescription ? ` - ${error.errorDescription}` : ''}`);
      }
      return null;
    }

    consola.error(
      `Failed to resolve provider '${providerName}': ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Display resolved credential
 */
function displayCredential(providerName: string, credential: ResolvedCredential, showValue: boolean): void {
  consola.info(`\nProvider: ${providerName}`);
  consola.info('─'.repeat(40));
  consola.info(`Location: ${credential.location}`);
  consola.info(`Name: ${credential.name}`);

  if (showValue) {
    consola.info(`Value: ${credential.value}`);
  } else {
    // Mask the value
    const maskedValue =
      credential.value.length > 8
        ? `${credential.value.substring(0, 4)}${'*'.repeat(8)}${credential.value.substring(credential.value.length - 4)}`
        : '*'.repeat(credential.value.length);
    consola.info(`Value: ${maskedValue}`);
  }
  consola.info('');
}

/**
 * Handle 'auth list' - list all providers
 */
function handleList(authConfig: AuthConfig, activeProviderName?: string): void {
  const providers = listProviders(authConfig);

  if (providers.length === 0) {
    consola.info('No auth providers configured.');
    consola.info('Add providers to workspace.yaml under the "auth.providers" key.');
    return;
  }

  consola.info('\nAuth Providers:');
  for (const name of providers) {
    const provider = authConfig.providers[name];
    if (provider) {
      const marker = name === activeProviderName ? ' (active)' : '';
      consola.info(`  ${name} [${provider.type}]${marker}`);
    }
  }
  consola.info('');
}

/**
 * Handle 'auth use <provider>' - set active provider
 */
function handleUse(
  authConfig: AuthConfig,
  providerName: string,
  state: { workspaceConfig?: { auth: AuthConfig } },
): void {
  if (!providerExists(authConfig, providerName)) {
    consola.warn(`Provider '${providerName}' not found.`);
    const available = listProviders(authConfig);
    if (available.length > 0) {
      consola.info(`Available providers: ${available.join(', ')}`);
    }
    return;
  }

  // Update the active provider in workspace config
  if (state.workspaceConfig) {
    state.workspaceConfig.auth.active = providerName;
  }

  consola.success(`Switched to auth provider: ${providerName}`);
}

/**
 * Handle 'auth login [provider]' - resolve and display credentials
 */
async function handleLogin(
  args: string[],
  authConfig: AuthConfig,
  vars: Record<string, string>,
  state: { vault?: IVault },
): Promise<void> {
  // Get provider name from args or use active
  const providerName = args[0] || getActiveProviderName(authConfig);

  if (!providerName) {
    consola.warn('No auth provider specified and no active provider set.');
    consola.info("Use 'auth login <provider>' or 'auth use <provider>' first.");
    return;
  }

  const providerConfig = getProvider(authConfig, providerName);
  if (!providerConfig) {
    consola.warn(`Provider '${providerName}' not found.`);
    const available = listProviders(authConfig);
    if (available.length > 0) {
      consola.info(`Available providers: ${available.join(', ')}`);
    }
    return;
  }

  // Create interpolation context (may prompt for vault passphrase)
  const context = await createInterpolationContext(vars, state);

  // Resolve provider
  const credential = await resolveProvider(providerName, providerConfig, context);
  if (!credential) {
    return;
  }

  // Ask if user wants to see the full value
  const showValue = await confirm({
    message: 'Show credential value? (will be visible in terminal)',
    initialValue: false,
  });

  if (isCancel(showValue)) {
    consola.info('Cancelled.');
    return;
  }

  displayCredential(providerName, credential, showValue === true);

  consola.success('Credential resolved successfully.');
  consola.info('This credential will be automatically injected into requests.');
}

/**
 * Handle 'auth status' - show current auth status
 */
function handleStatus(authConfig: AuthConfig, activeProviderName?: string): void {
  const providers = listProviders(authConfig);

  consola.info('\nAuth Status:');
  consola.info('─'.repeat(40));

  if (providers.length === 0) {
    consola.info('Providers: None configured');
  } else {
    consola.info(`Providers: ${providers.length} configured`);

    if (activeProviderName) {
      const activeConfig = getProvider(authConfig, activeProviderName);
      consola.info(`Active: ${activeProviderName} [${activeConfig?.type}]`);
    } else {
      consola.info('Active: None');
    }
  }

  consola.info('');
}

/**
 * Handle 'auth show [provider]' - show provider details without resolving
 */
function handleShow(args: string[], authConfig: AuthConfig): void {
  const providerName = args[0] || getActiveProviderName(authConfig);

  if (!providerName) {
    consola.warn('No provider specified and no active provider set.');
    return;
  }

  const config = getProvider(authConfig, providerName);
  if (!config) {
    consola.warn(`Provider '${providerName}' not found.`);
    return;
  }

  consola.info(`\nProvider: ${providerName}`);
  consola.info('─'.repeat(40));
  consola.info(`Type: ${config.type}`);

  switch (config.type) {
    case 'api_key':
      consola.info(`Location: ${config.location}`);
      consola.info(`Name: ${config.name}`);
      consola.info(`Value: ${config.value} (not resolved)`);
      break;

    case 'bearer':
      consola.info(`Token: ${config.token} (not resolved)`);
      consola.info(`Prefix: ${config.prefix || 'Bearer'}`);
      break;

    case 'login_jwt':
      consola.info(`Login URL: ${config.login.url}`);
      consola.info(`Method: ${config.login.method}`);
      consola.info(`Extract token: ${config.extract.token}`);
      break;

    case 'oauth2_client_credentials':
      consola.info(`Token URL: ${config.tokenUrl}`);
      consola.info(`Client ID: ${config.clientId}`);
      consola.info(`Scope: ${config.scope || '(none)'}`);
      break;
  }

  consola.info('');
}

/**
 * Auth command handler
 * Handles: auth list, auth use, auth login, auth status, auth show
 */
export const authHandler: CommandHandler = async (args, state) => {
  // Check if workspace is loaded
  if (!state.workspaceConfig) {
    consola.warn('No workspace loaded.');
    consola.info('Auth management requires a workspace with auth configuration.');
    return;
  }

  const authConfig = state.workspaceConfig.auth;
  const vars = state.workspaceConfig.vars || {};
  const activeProviderName = getActiveProviderName(authConfig);
  const subcommand = args[0]?.toLowerCase();

  // Default to 'status' if no subcommand
  if (!subcommand || subcommand === 'status') {
    return handleStatus(authConfig, activeProviderName);
  }

  if (subcommand === 'list' || subcommand === 'ls') {
    return handleList(authConfig, activeProviderName);
  }

  if (subcommand === 'use') {
    const providerName = args[1];
    if (!providerName) {
      consola.warn('Usage: auth use <provider>');
      return;
    }
    return handleUse(authConfig, providerName, state);
  }

  if (subcommand === 'login') {
    return handleLogin(args.slice(1), authConfig, vars, state);
  }

  if (subcommand === 'show') {
    return handleShow(args.slice(1), authConfig);
  }

  // Unknown subcommand
  consola.warn(`Unknown subcommand: ${subcommand}`);
  consola.info('Available: auth list, auth use <provider>, auth login [provider], auth show [provider], auth status');
};

/**
 * Create auth command
 */
export function createAuthCommand(): Command {
  return {
    name: 'auth',
    description: 'Manage authentication providers (list, use, login, status)',
    handler: authHandler,
  };
}
