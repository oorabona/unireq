/**
 * Profile resolution logic
 * Merges workspace defaults with active profile overrides
 */

import { CONFIG_DEFAULTS } from '../config/schema.js';
import type { WorkspaceConfig } from '../config/types.js';

/**
 * Resolved profile with all values computed
 */
export interface ResolvedProfile {
  /** Profile name */
  name: string;
  /** Effective base URL */
  baseUrl?: string;
  /** Merged headers (workspace + profile) */
  headers: Record<string, string>;
  /** Effective timeout in milliseconds */
  timeoutMs: number;
  /** Effective TLS verification setting */
  verifyTls: boolean;
  /** Merged variables (workspace + profile) */
  vars: Record<string, string>;
}

/**
 * Get the active profile name from config
 * Priority: explicit activeProfile > "default" if exists > first profile > undefined
 *
 * @param config - Workspace configuration
 * @returns Active profile name or undefined if no profiles
 */
export function getActiveProfileName(config: WorkspaceConfig): string | undefined {
  const profileNames = Object.keys(config.profiles);

  if (profileNames.length === 0) {
    return undefined;
  }

  // Explicit activeProfile
  if (config.activeProfile && profileNames.includes(config.activeProfile)) {
    return config.activeProfile;
  }

  // Fallback to "default" if exists
  if (profileNames.includes('default')) {
    return 'default';
  }

  // Fallback to first profile
  return profileNames[0];
}

/**
 * List all profile names in the workspace
 *
 * @param config - Workspace configuration
 * @returns Array of profile names
 */
export function listProfiles(config: WorkspaceConfig): string[] {
  return Object.keys(config.profiles);
}

/**
 * Check if a profile exists in the workspace
 *
 * @param config - Workspace configuration
 * @param profileName - Profile name to check
 * @returns true if profile exists
 */
export function profileExists(config: WorkspaceConfig, profileName: string): boolean {
  return profileName in config.profiles;
}

/**
 * Resolve a profile by merging workspace defaults with profile overrides
 *
 * @param config - Workspace configuration
 * @param profileName - Profile name to resolve (defaults to active profile)
 * @returns Resolved profile with all values, or undefined if profile not found
 */
export function resolveProfile(config: WorkspaceConfig, profileName?: string): ResolvedProfile | undefined {
  // Determine which profile to resolve
  const name = profileName ?? getActiveProfileName(config);
  if (!name) {
    return undefined;
  }

  const profile = config.profiles[name];
  if (!profile) {
    return undefined;
  }

  // Merge headers: workspace + profile (profile takes precedence)
  const mergedHeaders: Record<string, string> = { ...config.vars };
  // Note: workspace-level headers would go here if we had them
  // For now, profile headers are the only headers
  if (profile.headers) {
    for (const [key, value] of Object.entries(profile.headers)) {
      if (value === '') {
        // Empty string removes the header
        delete mergedHeaders[key];
      } else {
        mergedHeaders[key] = value;
      }
    }
  }

  // Merge vars: workspace + profile (profile takes precedence)
  const mergedVars: Record<string, string> = { ...config.vars };
  if (profile.vars) {
    Object.assign(mergedVars, profile.vars);
  }

  return {
    name,
    baseUrl: profile.baseUrl ?? config.baseUrl,
    headers: profile.headers ?? {},
    timeoutMs: profile.timeoutMs ?? CONFIG_DEFAULTS.profile.timeoutMs,
    verifyTls: profile.verifyTls ?? CONFIG_DEFAULTS.profile.verifyTls,
    vars: mergedVars,
  };
}

/**
 * Create a default resolved profile when no workspace is loaded
 * Uses CONFIG_DEFAULTS values
 *
 * @returns Default resolved profile
 */
export function createDefaultProfile(): ResolvedProfile {
  return {
    name: 'default',
    baseUrl: undefined,
    headers: CONFIG_DEFAULTS.profile.headers,
    timeoutMs: CONFIG_DEFAULTS.profile.timeoutMs,
    verifyTls: CONFIG_DEFAULTS.profile.verifyTls,
    vars: {},
  };
}
