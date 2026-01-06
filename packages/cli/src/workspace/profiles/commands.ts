/**
 * Profile management REPL commands (kubectl-inspired model)
 *
 * In the kubectl model:
 * - activeProfile is in GlobalConfig (not WorkspaceConfig)
 * - REPL state tracks the runtime active profile
 * - profile use <name> updates runtime state AND GlobalConfig
 */

import { spawn } from 'node:child_process';
import { consola } from 'consola';
import type { ReplState } from '../../repl/state.js';
import type { Command, CommandHandler } from '../../repl/types.js';
import { loadWorkspaceConfig, saveWorkspaceConfig } from '../config/loader.js';
import type { ProfileConfig, WorkspaceConfig } from '../config/types.js';
import { findWorkspace } from '../detection.js';
import { getActiveProfile, getActiveWorkspace, setActiveProfile } from '../global-config.js';
import { getWorkspace } from '../registry/loader.js';
import { getDefaultProfileName, listProfiles, profileExists, resolveProfile } from './resolver.js';

/**
 * Profile command handler
 * Handles: profile, profile list, profile use <name>, profile show, profile create, profile rename, profile delete, profile edit
 */
export const profileHandler: CommandHandler = async (args, state) => {
  // Check if workspace is loaded - try to load it if not in state
  if (!state.workspaceConfig) {
    // Try to load from active workspace in global config (via registry)
    const activeWorkspaceName = getActiveWorkspace();
    if (activeWorkspaceName) {
      const ws = getWorkspace(activeWorkspaceName);
      if (ws) {
        const config = loadWorkspaceConfig(ws.path);
        if (config) {
          state.workspace = ws.path;
          state.workspaceConfig = config;
        }
      }
    }

    // If still not loaded, try local workspace detection
    if (!state.workspaceConfig) {
      const localWorkspace = findWorkspace();
      if (localWorkspace) {
        const config = loadWorkspaceConfig(localWorkspace.path);
        if (config) {
          state.workspace = localWorkspace.path;
          state.workspaceConfig = config;
        }
      }
    }

    // If still not loaded, show error
    if (!state.workspaceConfig) {
      consola.warn('No workspace loaded.');
      consola.info('Profile management requires a workspace.');
      return;
    }
  }

  const config = state.workspaceConfig;
  const subcommand = args[0]?.toLowerCase();

  // Default to 'list' if no subcommand
  if (!subcommand || subcommand === 'list') {
    return handleList(config, state.activeProfile);
  }

  if (subcommand === 'show') {
    return handleShow(config, state.activeProfile);
  }

  if (subcommand === 'use') {
    const profileName = args[1];
    if (!profileName) {
      consola.warn('Usage: profile use <name>');
      return;
    }
    return handleUse(config, profileName, state);
  }

  if (subcommand === 'create') {
    return handleCreate(args.slice(1), state);
  }

  if (subcommand === 'rename') {
    return handleRename(args[1], args[2], state);
  }

  if (subcommand === 'delete' || subcommand === 'rm') {
    return handleDelete(args[1], state);
  }

  if (subcommand === 'edit') {
    return handleEdit(args[1], state);
  }

  if (subcommand === 'set') {
    return handleSet(args.slice(1), state);
  }

  if (subcommand === 'unset') {
    return handleUnset(args.slice(1), state);
  }

  if (subcommand === 'configure' || subcommand === 'config') {
    return handleConfigure(state);
  }

  // Unknown subcommand
  consola.warn(`Unknown subcommand: ${subcommand}`);
  consola.info('Available: profile [list|create|rename|delete|use|show|edit|set|unset|configure]');
};

/**
 * Handle 'profile list' - list all available profiles
 */
function handleList(config: WorkspaceConfig, runtimeActiveProfile?: string): void {
  const profiles = listProfiles(config);

  if (profiles.length === 0) {
    consola.info('No profiles defined.');
    consola.info('Use "profile create <name> --base-url <url>" to create a profile.');
    return;
  }

  // Determine which profile is active
  // Priority: runtime state > GlobalConfig > default from workspace
  const globalActive = getActiveProfile();
  const activeProfile = runtimeActiveProfile ?? globalActive ?? getDefaultProfileName(config);

  consola.info('\nProfiles:');
  for (const name of profiles) {
    const marker = name === activeProfile ? ' (active)' : '';
    consola.info(`  ${name}${marker}`);
  }
  consola.info('');
}

/**
 * Handle 'profile show' - show current profile details
 */
function handleShow(config: WorkspaceConfig, runtimeActiveProfile?: string): void {
  // Get profile name from runtime or global config
  const globalActive = getActiveProfile();
  const profileName = runtimeActiveProfile ?? globalActive ?? getDefaultProfileName(config);

  if (!profileName) {
    consola.info('No active profile.');
    return;
  }

  const resolved = resolveProfile(config, profileName);
  if (!resolved) {
    consola.warn(`Profile '${profileName}' not found.`);
    return;
  }

  consola.info(`\nProfile: ${resolved.name}`);
  consola.info('─'.repeat(30));

  consola.info(`Base URL: ${resolved.baseUrl || '(not set)'}`);
  consola.info(`Timeout: ${resolved.timeoutMs}ms`);
  consola.info(`Verify TLS: ${resolved.verifyTls}`);

  const headerCount = Object.keys(resolved.headers).length;
  if (headerCount > 0) {
    consola.info(`\nHeaders (${headerCount}):`);
    for (const [key, value] of Object.entries(resolved.headers)) {
      consola.info(`  ${key}: ${value}`);
    }
  }

  const varCount = Object.keys(resolved.vars).length;
  if (varCount > 0) {
    consola.info(`\nVariables (${varCount}):`);
    for (const [key, value] of Object.entries(resolved.vars)) {
      consola.info(`  ${key}: ${value}`);
    }
  }

  const secretCount = Object.keys(resolved.secrets).length;
  if (secretCount > 0) {
    consola.info(`\nSecrets (${secretCount}):`);
    for (const key of Object.keys(resolved.secrets)) {
      consola.info(`  ${key}: ********`);
    }
  }

  consola.info('');
}

/**
 * Handle 'profile use <name>' - switch to a profile
 */
function handleUse(config: WorkspaceConfig, profileName: string, state: { activeProfile?: string }): void {
  if (!profileExists(config, profileName)) {
    consola.warn(`Profile '${profileName}' not found.`);
    const available = listProfiles(config);
    if (available.length > 0) {
      consola.info(`Available profiles: ${available.join(', ')}`);
    }
    return;
  }

  // Update runtime state
  state.activeProfile = profileName;

  // Persist to GlobalConfig
  setActiveProfile(profileName);

  consola.info(`Switched to profile: ${profileName}`);
}

/**
 * Parse profile create options
 * Supports: --base-url <url>, --from <source>, --copy-vars, --copy-secrets, --copy-all
 */
function parseCreateOptions(args: string[]): {
  name?: string;
  baseUrl?: string;
  from?: string;
  copyVars: boolean;
  copySecrets: boolean;
} {
  const result = {
    name: undefined as string | undefined,
    baseUrl: undefined as string | undefined,
    from: undefined as string | undefined,
    copyVars: false,
    copySecrets: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === '--base-url' || arg === '-u') {
      result.baseUrl = args[++i];
    } else if (arg === '--from' || arg === '-f') {
      result.from = args[++i];
    } else if (arg === '--copy-vars') {
      result.copyVars = true;
    } else if (arg === '--copy-secrets') {
      result.copySecrets = true;
    } else if (arg === '--copy-all') {
      result.copyVars = true;
      result.copySecrets = true;
    } else if (!arg.startsWith('-') && !result.name) {
      result.name = arg;
    }
  }

  return result;
}

/**
 * Handle 'profile create <name> [options]' - create a new profile
 * Options:
 *   --base-url <url>  Base URL for the profile (required if not cloning)
 *   --from <source>   Clone from existing profile
 *   --copy-vars       Copy vars from source profile
 *   --copy-secrets    Copy secrets from source profile
 *   --copy-all        Copy vars and secrets from source profile
 */
function handleCreate(args: string[], state: ReplState): void {
  if (!state.workspaceConfig || !state.workspace) {
    consola.warn('No workspace loaded.');
    return;
  }

  const options = parseCreateOptions(args);

  if (!options.name) {
    consola.warn(
      'Usage: profile create <name> [--base-url <url>] [--from <source>] [--copy-vars|--copy-secrets|--copy-all]',
    );
    return;
  }

  const config = state.workspaceConfig;

  // Validate profile name doesn't already exist
  if (profileExists(config, options.name)) {
    consola.warn(`Profile '${options.name}' already exists.`);
    return;
  }

  // Build the new profile
  const newProfile: ProfileConfig = {
    baseUrl: options.baseUrl || 'http://localhost:3000',
  };

  // Clone from source profile if specified
  if (options.from) {
    if (!profileExists(config, options.from)) {
      consola.warn(`Source profile '${options.from}' not found.`);
      const available = listProfiles(config);
      if (available.length > 0) {
        consola.info(`Available profiles: ${available.join(', ')}`);
      }
      return;
    }

    const sourceProfile = config.profiles?.[options.from];
    if (sourceProfile) {
      // Copy baseUrl if not explicitly provided
      if (!options.baseUrl && sourceProfile.baseUrl) {
        newProfile.baseUrl = sourceProfile.baseUrl;
      }

      // Copy headers
      if (sourceProfile.headers) {
        newProfile.headers = { ...sourceProfile.headers };
      }

      // Copy timeout and verifyTls
      if (sourceProfile.timeoutMs !== undefined) {
        newProfile.timeoutMs = sourceProfile.timeoutMs;
      }
      if (sourceProfile.verifyTls !== undefined) {
        newProfile.verifyTls = sourceProfile.verifyTls;
      }

      // Copy vars if requested
      if (options.copyVars && sourceProfile.vars) {
        newProfile.vars = { ...sourceProfile.vars };
      }

      // Copy secrets if requested
      if (options.copySecrets && sourceProfile.secrets) {
        newProfile.secrets = { ...sourceProfile.secrets };
      }
    }
  }

  // baseUrl is required
  if (!newProfile.baseUrl) {
    consola.warn('Base URL is required. Use --base-url <url> or clone from an existing profile with --from <source>');
    return;
  }

  // Update config
  if (!config.profiles) {
    config.profiles = {};
  }
  config.profiles[options.name] = newProfile;

  // Save to file
  try {
    saveWorkspaceConfig(state.workspace, config);
    consola.info(`Created profile '${options.name}'`);

    // Auto-select the new profile if it's the first one
    if (Object.keys(config.profiles).length === 1) {
      state.activeProfile = options.name;
      setActiveProfile(options.name);
      consola.info(`Profile '${options.name}' is now active`);
    }
  } catch (error) {
    consola.error(`Failed to save workspace config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Handle 'profile rename <old> <new>' - rename a profile
 */
function handleRename(oldName: string | undefined, newName: string | undefined, state: ReplState): void {
  if (!state.workspaceConfig || !state.workspace) {
    consola.warn('No workspace loaded.');
    return;
  }

  if (!oldName || !newName) {
    consola.warn('Usage: profile rename <old-name> <new-name>');
    return;
  }

  const config = state.workspaceConfig;

  // Validate old profile exists
  if (!profileExists(config, oldName)) {
    consola.warn(`Profile '${oldName}' not found.`);
    const available = listProfiles(config);
    if (available.length > 0) {
      consola.info(`Available profiles: ${available.join(', ')}`);
    }
    return;
  }

  // Validate new name doesn't exist
  if (profileExists(config, newName)) {
    consola.warn(`Profile '${newName}' already exists.`);
    return;
  }

  // Perform rename (profileConfig exists since we validated oldName above)
  if (config.profiles?.[oldName]) {
    const profileConfig = config.profiles[oldName];
    delete config.profiles[oldName];
    config.profiles[newName] = profileConfig;
  }

  // Save to file
  try {
    saveWorkspaceConfig(state.workspace, config);
    consola.info(`Renamed profile '${oldName}' to '${newName}'`);

    // Update active profile if it was the renamed one
    const globalActive = getActiveProfile();
    if (state.activeProfile === oldName || globalActive === oldName) {
      state.activeProfile = newName;
      setActiveProfile(newName);
      consola.info(`Active profile updated to '${newName}'`);
    }
  } catch (error) {
    consola.error(`Failed to save workspace config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Handle 'profile delete <name>' - delete a profile
 */
function handleDelete(name: string | undefined, state: ReplState): void {
  if (!state.workspaceConfig || !state.workspace) {
    consola.warn('No workspace loaded.');
    return;
  }

  if (!name) {
    consola.warn('Usage: profile delete <name>');
    return;
  }

  const config = state.workspaceConfig;

  // Validate profile exists
  if (!profileExists(config, name)) {
    consola.warn(`Profile '${name}' not found.`);
    const available = listProfiles(config);
    if (available.length > 0) {
      consola.info(`Available profiles: ${available.join(', ')}`);
    }
    return;
  }

  // Check if this is the last profile
  const profiles = listProfiles(config);
  if (profiles.length === 1) {
    consola.warn('This is the last profile. Workspace will have no profiles after deletion.');
  }

  // Perform delete
  if (config.profiles) {
    delete config.profiles[name];
  }

  // Save to file
  try {
    saveWorkspaceConfig(state.workspace, config);
    consola.info(`Deleted profile '${name}'`);

    // Clear active profile if it was the deleted one
    const globalActive = getActiveProfile();
    if (state.activeProfile === name || globalActive === name) {
      state.activeProfile = undefined;
      setActiveProfile(undefined);
      consola.info('Active profile cleared.');

      // Auto-select first available profile if any
      const remaining = listProfiles(config);
      if (remaining.length > 0) {
        state.activeProfile = remaining[0];
        setActiveProfile(remaining[0]);
        consola.info(`Switched to profile: ${remaining[0]}`);
      }
    }
  } catch (error) {
    consola.error(`Failed to save workspace config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Handle 'profile edit [name]' - open profile in $EDITOR
 */
function handleEdit(name: string | undefined, state: ReplState): void {
  if (!state.workspaceConfig || !state.workspace) {
    consola.warn('No workspace loaded.');
    return;
  }

  const editorEnv = process.env['EDITOR'] || process.env['VISUAL'];
  if (!editorEnv) {
    consola.error('$EDITOR not set. Set it with: export EDITOR=vim');
    consola.info(`Or edit manually: ${state.workspace}/workspace.yaml`);
    consola.info('Or use: profile set <key> <value>');
    return;
  }

  const config = state.workspaceConfig;
  const profileName = name ?? state.activeProfile ?? getActiveProfile() ?? getDefaultProfileName(config);

  if (profileName && !profileExists(config, profileName)) {
    consola.warn(`Profile '${profileName}' not found.`);
    return;
  }

  // Open the workspace.yaml file in the editor
  const configPath = `${state.workspace}/workspace.yaml`;
  consola.info(`Opening ${configPath} in editor...`);

  if (profileName) {
    consola.info(`Tip: Navigate to the '${profileName}' profile section.`);
  }

  // Parse editor command (handle cases like "code --wait" or just "vim")
  const editorParts = editorEnv.split(/\s+/);
  const editorCmd = editorParts[0];
  if (!editorCmd) {
    consola.error('Invalid EDITOR value.');
    return;
  }
  const editorArgs = [...editorParts.slice(1), configPath];

  const child = spawn(editorCmd, editorArgs, {
    stdio: 'inherit',
  });

  child.on('error', (error: Error) => {
    consola.error(`Failed to open editor: ${error.message}`);
  });

  child.on('close', (code: number | null) => {
    if (code === 0) {
      consola.info('Editor closed. Reload workspace to apply changes.');
    } else {
      consola.warn(`Editor exited with code ${code}`);
    }
  });
}

/**
 * Handle 'profile set <key> <value>' - set a profile parameter
 * Supports: base-url, timeout, verify-tls, header
 */
function handleSet(args: string[], state: ReplState): void {
  if (!state.workspaceConfig || !state.workspace) {
    consola.warn('No workspace loaded.');
    return;
  }

  const config = state.workspaceConfig;
  const profileName = state.activeProfile ?? getActiveProfile() ?? getDefaultProfileName(config);

  if (!profileName) {
    consola.warn('No active profile. Use "profile use <name>" first.');
    return;
  }

  if (!profileExists(config, profileName)) {
    consola.warn(`Profile '${profileName}' not found.`);
    return;
  }

  const key = args[0]?.toLowerCase();
  const value = args.slice(1).join(' ');

  if (!key) {
    consola.info('Usage: profile set <key> <value>');
    consola.info('');
    consola.info('Available keys:');
    consola.info('  base-url <url>         Set the base URL');
    consola.info('  timeout <ms>           Set timeout in milliseconds');
    consola.info('  verify-tls <bool>      Set TLS verification (true/false)');
    consola.info('  header <name> <value>  Set a default header');
    consola.info('  var <name> <value>     Set a variable');
    consola.info('');
    consola.info('Examples:');
    consola.info('  profile set base-url https://api.example.com');
    consola.info('  profile set timeout 60000');
    consola.info('  profile set verify-tls false');
    consola.info('  profile set header Authorization "Bearer token"');
    return;
  }

  const profile = config.profiles?.[profileName];
  if (!profile) {
    consola.warn(`Profile '${profileName}' not found.`);
    return;
  }

  let updated = false;

  switch (key) {
    case 'base-url':
    case 'baseurl':
    case 'url': {
      if (!value) {
        consola.warn('Usage: profile set base-url <url>');
        return;
      }
      // Validate URL
      try {
        new URL(value);
      } catch {
        consola.error('Invalid URL format.');
        return;
      }
      profile.baseUrl = value;
      updated = true;
      consola.success(`Base URL set to: ${value}`);
      break;
    }

    case 'timeout':
    case 'timeout-ms':
    case 'timeoutms': {
      if (!value) {
        consola.warn('Usage: profile set timeout <milliseconds>');
        return;
      }
      const ms = parseInt(value, 10);
      if (Number.isNaN(ms) || ms < 1) {
        consola.error('Timeout must be a positive integer (milliseconds).');
        return;
      }
      profile.timeoutMs = ms;
      updated = true;
      consola.success(`Timeout set to: ${ms}ms`);
      break;
    }

    case 'verify-tls':
    case 'verifytls':
    case 'tls': {
      if (!value) {
        consola.warn('Usage: profile set verify-tls <true|false>');
        return;
      }
      const boolValue = value.toLowerCase();
      if (boolValue !== 'true' && boolValue !== 'false') {
        consola.error('Value must be "true" or "false".');
        return;
      }
      profile.verifyTls = boolValue === 'true';
      updated = true;
      consola.success(`Verify TLS set to: ${profile.verifyTls}`);
      break;
    }

    case 'header': {
      const headerName = args[1];
      const headerValue = args.slice(2).join(' ');
      if (!headerName) {
        consola.warn('Usage: profile set header <name> <value>');
        consola.info('Example: profile set header Authorization "Bearer token"');
        return;
      }
      if (!headerValue) {
        // Remove header if no value provided
        if (profile.headers?.[headerName]) {
          delete profile.headers[headerName];
          updated = true;
          consola.success(`Header '${headerName}' removed.`);
        } else {
          consola.warn(`Header '${headerName}' not set.`);
        }
      } else {
        if (!profile.headers) {
          profile.headers = {};
        }
        profile.headers[headerName] = headerValue;
        updated = true;
        consola.success(`Header '${headerName}' set.`);
      }
      break;
    }

    case 'var':
    case 'variable': {
      const varName = args[1];
      const varValue = args.slice(2).join(' ');
      if (!varName) {
        consola.warn('Usage: profile set var <name> <value>');
        return;
      }
      if (!varValue) {
        // Remove var if no value provided
        if (profile.vars?.[varName]) {
          delete profile.vars[varName];
          updated = true;
          consola.success(`Variable '${varName}' removed.`);
        } else {
          consola.warn(`Variable '${varName}' not set.`);
        }
      } else {
        if (!profile.vars) {
          profile.vars = {};
        }
        profile.vars[varName] = varValue;
        updated = true;
        consola.success(`Variable '${varName}' set.`);
      }
      break;
    }

    default:
      consola.warn(`Unknown key: ${key}`);
      consola.info('Available: base-url, timeout, verify-tls, header, var');
  }

  if (updated) {
    try {
      saveWorkspaceConfig(state.workspace, config);
    } catch (error) {
      consola.error(`Failed to save: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Handle 'profile configure' - open interactive configuration modal
 */
function handleConfigure(state: ReplState): void {
  if (!state.workspaceConfig || !state.workspace) {
    consola.warn('No workspace loaded.');
    return;
  }

  const config = state.workspaceConfig;
  const profileName = state.activeProfile ?? getActiveProfile() ?? getDefaultProfileName(config);

  if (!profileName) {
    consola.warn('No active profile. Use "profile use <name>" first.');
    return;
  }

  if (!profileExists(config, profileName)) {
    consola.warn(`Profile '${profileName}' not found.`);
    return;
  }

  // Set flag to trigger modal in Ink UI
  state.pendingModal = 'profileConfig';
}

/**
 * Handle 'profile unset <key>' - remove a profile parameter
 */
function handleUnset(args: string[], state: ReplState): void {
  if (!state.workspaceConfig || !state.workspace) {
    consola.warn('No workspace loaded.');
    return;
  }

  const config = state.workspaceConfig;
  const profileName = state.activeProfile ?? getActiveProfile() ?? getDefaultProfileName(config);

  if (!profileName) {
    consola.warn('No active profile. Use "profile use <name>" first.');
    return;
  }

  const profile = config.profiles?.[profileName];
  if (!profile) {
    consola.warn(`Profile '${profileName}' not found.`);
    return;
  }

  const key = args[0]?.toLowerCase();
  const name = args[1];

  if (!key) {
    consola.info('Usage: profile unset <key> [name]');
    consola.info('');
    consola.info('Available keys:');
    consola.info('  timeout           Remove custom timeout (use default)');
    consola.info('  verify-tls        Remove custom TLS setting (use default)');
    consola.info('  header <name>     Remove a specific header');
    consola.info('  var <name>        Remove a specific variable');
    return;
  }

  let updated = false;

  switch (key) {
    case 'timeout':
    case 'timeout-ms':
      if (profile.timeoutMs !== undefined) {
        delete profile.timeoutMs;
        updated = true;
        consola.success('Timeout reset to default.');
      } else {
        consola.info('Timeout already using default.');
      }
      break;

    case 'verify-tls':
    case 'verifytls':
    case 'tls':
      if (profile.verifyTls !== undefined) {
        delete profile.verifyTls;
        updated = true;
        consola.success('Verify TLS reset to default.');
      } else {
        consola.info('Verify TLS already using default.');
      }
      break;

    case 'header':
      if (!name) {
        consola.warn('Usage: profile unset header <name>');
        return;
      }
      if (profile.headers?.[name]) {
        delete profile.headers[name];
        updated = true;
        consola.success(`Header '${name}' removed.`);
      } else {
        consola.warn(`Header '${name}' not set.`);
      }
      break;

    case 'var':
    case 'variable':
      if (!name) {
        consola.warn('Usage: profile unset var <name>');
        return;
      }
      if (profile.vars?.[name]) {
        delete profile.vars[name];
        updated = true;
        consola.success(`Variable '${name}' removed.`);
      } else {
        consola.warn(`Variable '${name}' not set.`);
      }
      break;

    default:
      consola.warn(`Unknown key: ${key}`);
      consola.info('Available: timeout, verify-tls, header, var');
  }

  if (updated) {
    try {
      saveWorkspaceConfig(state.workspace, config);
    } catch (error) {
      consola.error(`Failed to save: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Create profile command
 */
export function createProfileCommand(): Command {
  return {
    name: 'profile',
    description: 'Manage environment profiles (list, create, rename, delete, use, show, edit, set, unset)',
    handler: profileHandler,
  };
}
