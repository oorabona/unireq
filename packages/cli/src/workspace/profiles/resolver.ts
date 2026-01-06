/**
 * Profile resolution logic (kubectl-inspired model)
 *
 * Profiles contain ALL settings for an environment. No workspace-level
 * baseUrl or vars - everything is in the profile.
 *
 * Secrets can exist at:
 * - Workspace level (shared across all profiles)
 * - Profile level (profile-specific overrides)
 */

import { CONFIG_DEFAULTS } from '../config/schema.js';
import type { WorkspaceConfig } from '../config/types.js';

/**
 * Resolved profile with all values computed
 */
export interface ResolvedProfile {
  /** Profile name */
  name: string;
  /** Base URL (required in kubectl model) */
  baseUrl: string;
  /** Headers from profile */
  headers: Record<string, string>;
  /** Effective timeout in milliseconds */
  timeoutMs: number;
  /** Effective TLS verification setting */
  verifyTls: boolean;
  /** Variables from profile */
  vars: Record<string, string>;
  /** Merged secrets (workspace + profile, profile takes precedence) */
  secrets: Record<string, string>;
}

/**
 * Get a sensible default profile name from config
 * Priority: "default" if exists > first profile > undefined
 *
 * Note: In kubectl model, activeProfile is in GlobalConfig, not WorkspaceConfig.
 * This function provides a fallback when no activeProfile is set externally.
 *
 * @param config - Workspace configuration
 * @returns Default profile name or undefined if no profiles
 */
export function getDefaultProfileName(config: WorkspaceConfig): string | undefined {
  const profiles = config.profiles ?? {};
  const profileNames = Object.keys(profiles);

  if (profileNames.length === 0) {
    return undefined;
  }

  // Prefer "default" if exists
  if (profileNames.includes('default')) {
    return 'default';
  }

  // Fallback to first profile (sorted for determinism)
  return profileNames.sort()[0];
}

/**
 * List all profile names in the workspace
 *
 * @param config - Workspace configuration
 * @returns Array of profile names (sorted)
 */
export function listProfiles(config: WorkspaceConfig): string[] {
  const profiles = config.profiles ?? {};
  return Object.keys(profiles).sort();
}

/**
 * Check if a profile exists in the workspace
 *
 * @param config - Workspace configuration
 * @param profileName - Profile name to check
 * @returns true if profile exists
 */
export function profileExists(config: WorkspaceConfig, profileName: string): boolean {
  const profiles = config.profiles ?? {};
  return profileName in profiles;
}

/**
 * Determine if a URL uses HTTPS
 */
function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resolve a profile by name
 *
 * In kubectl model:
 * - baseUrl is required in profile
 * - vars are only in profile
 * - secrets are merged (workspace + profile)
 *
 * Note: verifyTls defaults to true only for HTTPS URLs.
 * For HTTP URLs, TLS verification is not applicable.
 *
 * @param config - Workspace configuration
 * @param profileName - Profile name to resolve
 * @returns Resolved profile with all values, or undefined if profile not found
 */
export function resolveProfile(config: WorkspaceConfig, profileName: string): ResolvedProfile | undefined {
  const profiles = config.profiles ?? {};
  const profile = profiles[profileName];

  if (!profile) {
    return undefined;
  }

  // Merge secrets: workspace-level + profile-level (profile takes precedence)
  const mergedSecrets: Record<string, string> = {
    ...(config.secrets ?? {}),
    ...(profile.secrets ?? {}),
  };

  // verifyTls: use explicit value if set, otherwise default based on protocol
  // - HTTPS: default to true (secure by default)
  // - HTTP: default to false (TLS not applicable)
  const isHttps = isHttpsUrl(profile.baseUrl);
  const verifyTls = profile.verifyTls ?? (isHttps ? CONFIG_DEFAULTS.profile.verifyTls : false);

  return {
    name: profileName,
    baseUrl: profile.baseUrl,
    headers: profile.headers ?? {},
    timeoutMs: profile.timeoutMs ?? CONFIG_DEFAULTS.profile.timeoutMs,
    verifyTls,
    vars: profile.vars ?? {},
    secrets: mergedSecrets,
  };
}

/**
 * Resolve profile using active profile from global config
 *
 * @param config - Workspace configuration
 * @param activeProfile - Active profile name (from GlobalConfig)
 * @returns Resolved profile, or undefined if not found
 */
export function resolveActiveProfile(
  config: WorkspaceConfig,
  activeProfile: string | undefined,
): ResolvedProfile | undefined {
  // If activeProfile specified, try to resolve it
  if (activeProfile) {
    const resolved = resolveProfile(config, activeProfile);
    if (resolved) {
      return resolved;
    }
    // Active profile doesn't exist - fall back to default
  }

  // Try default profile name
  const defaultName = getDefaultProfileName(config);
  if (!defaultName) {
    return undefined;
  }

  return resolveProfile(config, defaultName);
}

/**
 * Create a default resolved profile when no workspace is loaded
 * Uses CONFIG_DEFAULTS values
 *
 * @returns Default resolved profile (with empty baseUrl)
 */
export function createDefaultProfile(): ResolvedProfile {
  return {
    name: 'default',
    baseUrl: '', // Empty - must be set before making requests
    headers: CONFIG_DEFAULTS.profile.headers,
    timeoutMs: CONFIG_DEFAULTS.profile.timeoutMs,
    verifyTls: CONFIG_DEFAULTS.profile.verifyTls,
    vars: {},
    secrets: {},
  };
}
