/**
 * Global configuration management (kubectl-inspired model)
 *
 * Manages ~/.config/unireq/config.yaml which stores:
 * - activeWorkspace: currently selected workspace name
 * - activeProfile: currently selected profile within the workspace
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as v from 'valibot';
import { parse as parseYaml, stringify as stringifyYaml, YAMLParseError } from 'yaml';
import { globalConfigSchema } from './config/schema.js';
import type { GlobalConfig } from './config/types.js';
import { getGlobalWorkspacePath } from './paths.js';

/** Global config file name */
const CONFIG_FILE_NAME = 'config.yaml';

/**
 * Get the path to the global config file
 *
 * @returns Path to ~/.config/unireq/config.yaml, or null if not available
 */
export function getGlobalConfigPath(): string | null {
  const globalPath = getGlobalWorkspacePath();
  if (!globalPath) {
    return null;
  }
  // Config file is at ~/.config/unireq/config.yaml (parent of workspaces/)
  return join(dirname(globalPath), CONFIG_FILE_NAME);
}

/**
 * Load global configuration
 *
 * @returns GlobalConfig object (with defaults if file doesn't exist)
 */
export function loadGlobalConfig(): GlobalConfig {
  const configPath = getGlobalConfigPath();

  // Default config if path not available or file doesn't exist
  const defaultConfig: GlobalConfig = {
    version: 1,
    activeWorkspace: undefined,
    activeProfile: undefined,
  };

  if (!configPath || !existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    if (!content.trim()) {
      return defaultConfig;
    }

    const rawConfig = parseYaml(content);
    const result = v.safeParse(globalConfigSchema, rawConfig);

    if (result.success) {
      return result.output as GlobalConfig;
    }

    // If validation fails, return default
    return defaultConfig;
  } catch (error) {
    if (error instanceof YAMLParseError) {
      // Invalid YAML, return default
      return defaultConfig;
    }
    throw error;
  }
}

/**
 * Save global configuration
 *
 * @param config - The GlobalConfig to save
 */
export function saveGlobalConfig(config: GlobalConfig): void {
  const configPath = getGlobalConfigPath();
  if (!configPath) {
    throw new Error('Cannot determine global config path');
  }

  // Ensure directory exists
  const configDir = dirname(configPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Write YAML
  const yaml = stringifyYaml(config, { lineWidth: 0 });
  writeFileSync(configPath, yaml, 'utf-8');
}

/**
 * Get the currently active workspace name
 *
 * @returns Active workspace name, or undefined if none selected
 */
export function getActiveWorkspace(): string | undefined {
  const config = loadGlobalConfig();
  return config.activeWorkspace;
}

/**
 * Set the active workspace
 *
 * @param workspaceName - Workspace name to activate (or undefined to clear)
 */
export function setActiveWorkspace(workspaceName: string | undefined): void {
  const config = loadGlobalConfig();
  config.activeWorkspace = workspaceName;
  // Clear activeProfile when changing workspace
  if (workspaceName !== config.activeWorkspace) {
    config.activeProfile = undefined;
  }
  saveGlobalConfig(config);
}

/**
 * Get the currently active profile name
 *
 * @returns Active profile name, or undefined if none selected
 */
export function getActiveProfile(): string | undefined {
  const config = loadGlobalConfig();
  return config.activeProfile;
}

/**
 * Set the active profile
 *
 * @param profileName - Profile name to activate (or undefined to clear)
 */
export function setActiveProfile(profileName: string | undefined): void {
  const config = loadGlobalConfig();
  config.activeProfile = profileName;
  saveGlobalConfig(config);
}

/**
 * Set both active workspace and profile atomically
 *
 * @param workspaceName - Workspace name to activate
 * @param profileName - Profile name to activate (optional)
 */
export function setActiveContext(workspaceName: string | undefined, profileName?: string): void {
  const config = loadGlobalConfig();
  config.activeWorkspace = workspaceName;
  config.activeProfile = profileName;
  saveGlobalConfig(config);
}

/**
 * Get the current context (workspace + profile)
 *
 * @returns Object with activeWorkspace and activeProfile
 */
export function getActiveContext(): { workspace: string | undefined; profile: string | undefined } {
  const config = loadGlobalConfig();
  return {
    workspace: config.activeWorkspace,
    profile: config.activeProfile,
  };
}
