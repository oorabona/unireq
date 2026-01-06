/**
 * Context Resolver (kubectl-like model)
 *
 * Resolves workspace and profile from multiple sources with defined priority:
 * 1. CLI flags (--workspace, --profile) - highest
 * 2. Environment variables (UNIREQ_WORKSPACE, UNIREQ_PROFILE)
 * 3. Global config (config.yaml activeWorkspace/activeProfile)
 * 4. Workspace config (workspace.yaml activeProfile)
 * 5. None - lowest
 */

import { getActiveContext } from './global-config.js';

/** Environment variable for workspace override */
export const UNIREQ_WORKSPACE_ENV = 'UNIREQ_WORKSPACE';

/** Environment variable for profile override */
export const UNIREQ_PROFILE_ENV = 'UNIREQ_PROFILE';

/**
 * Resolution source (for debugging/display)
 */
export type ResolutionSource = 'flag' | 'env' | 'config' | 'workspace' | 'none';

/**
 * Resolved workspace context
 */
export interface WorkspaceContext {
  /** Resolved workspace name (or undefined for local detection) */
  workspace: string | undefined;
  /** Source of workspace resolution */
  workspaceSource: ResolutionSource;
  /** Resolved profile name */
  profile: string | undefined;
  /** Source of profile resolution */
  profileSource: ResolutionSource;
}

/**
 * Options for context resolution
 */
export interface ResolveContextOptions {
  /** Explicit workspace from CLI flag */
  workspaceFlag?: string;
  /** Explicit profile from CLI flag */
  profileFlag?: string;
  /** Profile from workspace.yaml activeProfile (fallback) */
  workspaceActiveProfile?: string;
}

/**
 * Get workspace from environment variable
 *
 * @returns Workspace name from UNIREQ_WORKSPACE, or undefined
 */
export function getWorkspaceFromEnv(): string | undefined {
  const value = process.env[UNIREQ_WORKSPACE_ENV];
  // Empty string is treated as not set
  if (value && value.trim() !== '') {
    return value.trim();
  }
  return undefined;
}

/**
 * Get profile from environment variable
 *
 * @returns Profile name from UNIREQ_PROFILE, or undefined
 */
export function getProfileFromEnv(): string | undefined {
  const value = process.env[UNIREQ_PROFILE_ENV];
  // Empty string is treated as not set
  if (value && value.trim() !== '') {
    return value.trim();
  }
  return undefined;
}

/**
 * Resolve workspace and profile context with priority handling
 *
 * Priority order:
 * 1. CLI flags (--workspace, --profile) - highest
 * 2. Environment variables (UNIREQ_WORKSPACE, UNIREQ_PROFILE)
 * 3. Global config (config.yaml activeWorkspace/activeProfile)
 * 4. Workspace config (workspace.yaml activeProfile) - profile only
 * 5. None - lowest
 *
 * @param options - Resolution options (flags and workspace config)
 * @returns Resolved context with source tracking
 */
export function resolveContext(options: ResolveContextOptions = {}): WorkspaceContext {
  const { workspaceFlag, profileFlag, workspaceActiveProfile } = options;

  // Get global config values
  const globalContext = getActiveContext();

  // Resolve workspace
  let workspace: string | undefined;
  let workspaceSource: ResolutionSource;

  if (workspaceFlag !== undefined) {
    // Priority 1: CLI flag
    workspace = workspaceFlag;
    workspaceSource = 'flag';
  } else {
    const envWorkspace = getWorkspaceFromEnv();
    if (envWorkspace !== undefined) {
      // Priority 2: Environment variable
      workspace = envWorkspace;
      workspaceSource = 'env';
    } else if (globalContext.workspace !== undefined) {
      // Priority 3: Global config
      workspace = globalContext.workspace;
      workspaceSource = 'config';
    } else {
      // Priority 5: None (will use local detection)
      workspace = undefined;
      workspaceSource = 'none';
    }
  }

  // Resolve profile
  let profile: string | undefined;
  let profileSource: ResolutionSource;

  if (profileFlag !== undefined) {
    // Priority 1: CLI flag
    profile = profileFlag;
    profileSource = 'flag';
  } else {
    const envProfile = getProfileFromEnv();
    if (envProfile !== undefined) {
      // Priority 2: Environment variable
      profile = envProfile;
      profileSource = 'env';
    } else if (globalContext.profile !== undefined) {
      // Priority 3: Global config
      profile = globalContext.profile;
      profileSource = 'config';
    } else if (workspaceActiveProfile !== undefined) {
      // Priority 4: Workspace config
      profile = workspaceActiveProfile;
      profileSource = 'workspace';
    } else {
      // Priority 5: None
      profile = undefined;
      profileSource = 'none';
    }
  }

  return {
    workspace,
    workspaceSource,
    profile,
    profileSource,
  };
}

/**
 * Format context for display (debugging)
 *
 * @param context - Resolved context
 * @returns Human-readable string
 */
export function formatContext(context: WorkspaceContext): string {
  const parts: string[] = [];

  if (context.workspace) {
    parts.push(`workspace=${context.workspace} (${context.workspaceSource})`);
  }

  if (context.profile) {
    parts.push(`profile=${context.profile} (${context.profileSource})`);
  }

  return parts.length > 0 ? parts.join(', ') : 'no context';
}
