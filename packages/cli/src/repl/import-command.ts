/**
 * Import command for loading OpenAPI specs
 * @module repl/import-command
 */

import { consola } from 'consola';
import {
  type AuthProviderConfig,
  getActiveProvider,
  getActiveProviderName,
  type ResolvedCredential,
  resolveApiKeyProvider,
  resolveBearerProvider,
  resolveLoginJwtProvider,
  resolveOAuth2ClientCredentialsProvider,
} from '../auth/index.js';
import { getSpecInfoString, loadSpecIntoState } from '../openapi/state-loader.js';
import { isUrl } from '../openapi/utils.js';
import { createProfileSecretResolver, createSecretResolver } from '../secrets/resolver.js';
import type { IVault } from '../secrets/types.js';
import { createVault } from '../secrets/vault.js';
import { resolveProfile } from '../workspace/profiles/resolver.js';
import type { InterpolationContext } from '../workspace/variables/types.js';
import type { ReplState } from './state.js';
import type { Command, CommandHandler } from './types.js';

/**
 * Parsed import command arguments
 */
interface ImportArgs {
  source?: string;
  forceReload: boolean;
  useAuth: boolean;
  headers: string[];
}

/**
 * Parse import command arguments
 */
function parseImportArgs(args: string[]): ImportArgs {
  let source: string | undefined;
  let forceReload = false;
  let useAuth = false;
  const headers: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--reload' || arg === '-r') {
      forceReload = true;
    } else if (arg === '--auth' || arg === '-a') {
      useAuth = true;
    } else if (arg === '-H' || arg === '--header') {
      // Next arg is the header value
      i++;
      if (i < args.length) {
        headers.push(args[i] as string);
      }
    } else if (arg?.startsWith('-H')) {
      // -HValue format (no space)
      headers.push(arg.slice(2));
    } else if (arg?.startsWith('--header=')) {
      // --header=Value format
      headers.push(arg.slice(9));
    } else if (!source && !arg?.startsWith('-')) {
      source = arg;
    }

    i++;
  }

  return { source, forceReload, useAuth, headers };
}

/**
 * Parse header strings into a record
 */
function parseHeaderStrings(headerStrings: string[]): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const header of headerStrings) {
    const colonIndex = header.indexOf(':');
    if (colonIndex === -1) {
      consola.warn(`Invalid header format (expected 'Name: value'): ${header}`);
      continue;
    }

    const name = header.slice(0, colonIndex).trim();
    const value = header.slice(colonIndex + 1).trim();

    if (!name) {
      consola.warn(`Invalid header format (empty name): ${header}`);
      continue;
    }

    headers[name] = value;
  }

  return headers;
}

/**
 * Ensure vault is unlocked for secret resolution
 */
async function ensureSecretResolver(state: { vault?: IVault }): Promise<((name: string) => string) | undefined> {
  if (!state.vault) {
    state.vault = createVault();
  }

  const vault = state.vault;

  if (!(await vault.exists())) {
    return undefined;
  }

  if (vault.getState() === 'unlocked') {
    return createSecretResolver(vault);
  }

  // Vault exists but is locked - we won't prompt interactively for import
  // Return undefined and let the auth resolution fail gracefully
  consola.debug('Vault is locked, secrets will not be available for auth resolution');
  return undefined;
}

/**
 * Resolve auth provider to headers
 */
async function resolveAuthHeaders(state: ReplState): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (!state.workspaceConfig?.auth) {
    consola.warn('No auth configuration in workspace');
    return headers;
  }

  const authConfig = state.workspaceConfig.auth;
  const providerName = getActiveProviderName(authConfig);

  if (!providerName) {
    consola.warn('No active auth provider');
    return headers;
  }

  const providerConfig = getActiveProvider(authConfig);
  if (!providerConfig) {
    consola.warn(`Auth provider '${providerName}' not found`);
    return headers;
  }

  // Get vars and secrets from active profile
  const resolvedProfile = state.activeProfile ? resolveProfile(state.workspaceConfig, state.activeProfile) : undefined;
  const vars = resolvedProfile?.vars ?? {};
  const profileSecrets = resolvedProfile?.secrets ?? {};

  // Create interpolation context
  const vaultResolver = await ensureSecretResolver(state);
  const secretResolver =
    profileSecrets && Object.keys(profileSecrets).length > 0
      ? createProfileSecretResolver({ profileSecrets, vaultResolver })
      : vaultResolver;

  const context: InterpolationContext = {
    vars,
    secretResolver,
  };

  // Resolve credential based on provider type
  let credential: ResolvedCredential | null = null;

  try {
    switch (providerConfig.type) {
      case 'api_key':
        credential = resolveApiKeyProvider(providerConfig, context);
        break;

      case 'bearer':
        credential = resolveBearerProvider(providerConfig, context);
        break;

      case 'login_jwt':
        consola.info(`Executing login request for auth provider '${providerName}'...`);
        credential = await resolveLoginJwtProvider(providerConfig, context);
        break;

      case 'oauth2_client_credentials':
        consola.info(`Requesting OAuth2 token for auth provider '${providerName}'...`);
        credential = await resolveOAuth2ClientCredentialsProvider(providerConfig, context);
        break;

      default:
        consola.warn(`Unknown provider type: ${(providerConfig as AuthProviderConfig).type}`);
        return headers;
    }
  } catch (error) {
    consola.warn(`Failed to resolve auth: ${error instanceof Error ? error.message : String(error)}`);
    return headers;
  }

  if (!credential) {
    consola.warn('Failed to resolve auth credential');
    return headers;
  }

  // Convert credential to header
  if (credential.location === 'header') {
    headers[credential.name] = credential.value;
    consola.info(`Using auth: ${credential.name} header from provider '${providerName}'`);
  } else if (credential.location === 'query') {
    consola.warn(`Auth provider '${providerName}' uses query parameter injection, not supported for import`);
  } else if (credential.location === 'cookie') {
    headers['Cookie'] = `${credential.name}=${credential.value}`;
    consola.info(`Using auth: Cookie from provider '${providerName}'`);
  }

  return headers;
}

/**
 * Import command handler
 * Loads an OpenAPI spec from file path or URL
 */
export const importHandler: CommandHandler = async (args, state) => {
  const { source, forceReload, useAuth, headers: headerStrings } = parseImportArgs(args);

  // Validate source argument
  if (!source) {
    consola.error('Usage: import <path-or-url> [options]');
    consola.info('');
    consola.info('Options:');
    consola.info('  --reload, -r           Force reload (bypass cache)');
    consola.info('  --auth, -a             Use auth from active provider');
    consola.info('  -H "Name: value"       Add custom header');
    consola.info('');
    consola.info('Examples:');
    consola.info('  import ./api.yaml                     Load from local file');
    consola.info('  import https://api.example.com/spec  Load from URL');
    consola.info('  import https://... --auth             Load with auth');
    consola.info('  import https://... -H "X-Api-Key: abc"');
    return;
  }

  // Validate HTTP URLs are rejected (HTTPS only)
  if (isUrl(source) && source.toLowerCase().startsWith('http://')) {
    consola.error('HTTPS required for remote URLs');
    consola.info('Use https:// instead of http://');
    return;
  }

  // Build headers from:
  // 1. Explicit -H headers
  // 2. Auth provider (if --auth flag)
  const headers: Record<string, string> = {};

  // Parse explicit headers first
  const explicitHeaders = parseHeaderStrings(headerStrings);
  Object.assign(headers, explicitHeaders);

  // Resolve auth headers if requested
  if (useAuth) {
    const authHeaders = await resolveAuthHeaders(state);
    // Auth headers don't override explicit headers
    for (const [name, value] of Object.entries(authHeaders)) {
      if (!(name in headers)) {
        headers[name] = value;
      }
    }
  }

  // Load the spec
  const result = await loadSpecIntoState(state, source, {
    workspacePath: state.workspace,
    forceReload,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  // Show spec info on success
  if (result.success) {
    const info = getSpecInfoString(state);
    if (info) {
      const notes: string[] = [];
      if (forceReload) notes.push('cache bypassed');
      if (useAuth) notes.push('with auth');
      if (Object.keys(explicitHeaders).length > 0) notes.push(`${Object.keys(explicitHeaders).length} custom headers`);

      const noteStr = notes.length > 0 ? ` (${notes.join(', ')})` : '';
      consola.success(`Loaded OpenAPI spec: ${info}${noteStr}`);
    }
  }
  // Error message is already shown by loadSpecIntoState
};

/**
 * Create the import command
 */
export function createImportCommand(): Command {
  return {
    name: 'import',
    description: 'Load an OpenAPI spec from file or URL',
    handler: importHandler,
    helpText: `Usage: import <path-or-url> [options]

Load an OpenAPI spec to enable navigation and validation.

Options:
  --reload, -r           Force reload (bypass cache)
  --auth, -a             Use auth from active provider
  -H "Name: value"       Add custom header (can be repeated)
  --header "Name: value" Same as -H

Examples:
  import ./openapi.yaml                     Load from relative path
  import /path/to/spec.json                 Load from absolute path
  import https://api.example.com/spec.json  Load from URL
  import https://api.example.com/spec --auth  Load with workspace auth
  import https://api.example.com/spec -H "Authorization: Bearer token"

The loaded spec enables:
  - ls/cd navigation through API paths
  - describe command for endpoint documentation
  - Request body validation (coming soon)

Notes:
  - Only HTTPS URLs are allowed (no HTTP)
  - Relative paths are resolved from workspace directory
  - Loading a new spec replaces the current one
  - With --auth, uses the active auth provider from workspace config
  - Custom headers (-H) take precedence over auth headers`,
  };
}
