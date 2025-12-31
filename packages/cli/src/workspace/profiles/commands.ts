/**
 * Profile management REPL commands
 */

import { consola } from 'consola';
import type { Command, CommandHandler } from '../../repl/types.js';
import { getActiveProfileName, listProfiles, profileExists, resolveProfile } from './resolver.js';

/**
 * Profile command handler
 * Handles: profile, profile list, profile use <name>, profile show
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

  // Unknown subcommand
  consola.warn(`Unknown subcommand: ${subcommand}`);
  consola.info('Available: profile list, profile use <name>, profile show');
};

/**
 * Handle 'profile list' - list all available profiles
 */
function handleList(
  config: { profiles: Record<string, unknown>; activeProfile?: string },
  runtimeActiveProfile?: string,
): void {
  const profiles = listProfiles(config as Parameters<typeof listProfiles>[0]);

  if (profiles.length === 0) {
    consola.info('No profiles defined.');
    consola.info('Add profiles to workspace.yaml under the "profiles" key.');
    return;
  }

  // Determine which profile is active
  const activeProfile =
    runtimeActiveProfile ?? getActiveProfileName(config as Parameters<typeof getActiveProfileName>[0]);

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
function handleShow(config: Parameters<typeof resolveProfile>[0], runtimeActiveProfile?: string): void {
  const profileName = runtimeActiveProfile ?? getActiveProfileName(config);

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

  if (resolved.baseUrl) {
    consola.info(`Base URL: ${resolved.baseUrl}`);
  }

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

  consola.info('');
}

/**
 * Handle 'profile use <name>' - switch to a profile
 */
function handleUse(
  config: Parameters<typeof profileExists>[0],
  profileName: string,
  state: { activeProfile?: string },
): void {
  if (!profileExists(config, profileName)) {
    consola.warn(`Profile '${profileName}' not found.`);
    const available = listProfiles(config);
    if (available.length > 0) {
      consola.info(`Available profiles: ${available.join(', ')}`);
    }
    return;
  }

  // Update runtime state (doesn't persist to file)
  state.activeProfile = profileName;
  consola.info(`Switched to profile: ${profileName}`);
}

/**
 * Create profile command
 */
export function createProfileCommand(): Command {
  return {
    name: 'profile',
    description: 'Manage environment profiles (list, use, show)',
    handler: profileHandler,
  };
}
