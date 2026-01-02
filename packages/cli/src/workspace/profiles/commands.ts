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
import { saveWorkspaceConfig } from '../config/loader.js';
import type { ProfileConfig, WorkspaceConfig } from '../config/types.js';
import { getActiveProfile, setActiveProfile } from '../global-config.js';
import { getDefaultProfileName, listProfiles, profileExists, resolveProfile } from './resolver.js';

/**
 * Profile command handler
 * Handles: profile, profile list, profile use <name>, profile show, profile create, profile rename, profile delete, profile edit
 */
export const profileHandler: CommandHandler = async (args, state) => {
  // Check if workspace is loaded
  if (!state.workspaceConfig) {
    consola.warn('No workspace loaded.');
    consola.info('Profile management requires a workspace.');
    return;
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

  // Unknown subcommand
  consola.warn(`Unknown subcommand: ${subcommand}`);
  consola.info('Available: profile [list|create|rename|delete|use|show|edit]');
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

  const editor = process.env['EDITOR'] || process.env['VISUAL'];
  if (!editor) {
    consola.error('$EDITOR not set. Set it with: export EDITOR=vim');
    consola.info(`Or edit manually: ${state.workspace}/workspace.yaml`);
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
  consola.info(`Opening ${configPath} in ${editor}...`);

  if (profileName) {
    consola.info(`Tip: Navigate to the '${profileName}' profile section.`);
  }

  const child = spawn(editor, [configPath], {
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (error) => {
    consola.error(`Failed to open editor: ${error.message}`);
  });

  child.on('close', (code) => {
    if (code === 0) {
      consola.info('Editor closed. Reload workspace to apply changes.');
    } else {
      consola.warn(`Editor exited with code ${code}`);
    }
  });
}

/**
 * Create profile command
 */
export function createProfileCommand(): Command {
  return {
    name: 'profile',
    description: 'Manage environment profiles (list, create, rename, delete, use, show, edit)',
    handler: profileHandler,
  };
}
