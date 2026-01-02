/**
 * Workspace registry types (kubectl-inspired model)
 *
 * The registry is a global index of ALL known workspaces (local + global).
 * Stored at ~/.config/unireq/registry.yaml
 */

import type { WorkspaceLocation } from '../config/types.js';

/**
 * A single workspace entry in the registry
 */
export interface WorkspaceEntry {
  /** Absolute path to the workspace directory (.unireq or workspace.yaml parent) */
  path: string;
  /** Location type: 'local' (project .unireq/) or 'global' (~/.config/unireq/workspaces/) */
  location: WorkspaceLocation;
  /** Optional description */
  description?: string;
}

/**
 * Registry configuration (stored in registry.yaml)
 *
 * Global index of ALL known workspaces.
 * Note: "(local)" is reserved for cwd workspace detection.
 */
export interface RegistryConfig {
  /** Schema version */
  version: 1;
  /** Map of workspace name to entry */
  workspaces: Record<string, WorkspaceEntry>;
}

/**
 * Workspace display info (for list command output)
 */
export interface WorkspaceDisplayInfo {
  /** Workspace name (key in registry, or "(local)" for cwd workspace) */
  name: string;
  /** Absolute path to workspace directory */
  path: string;
  /** Location type */
  location: WorkspaceLocation;
  /** Optional description */
  description?: string;
  /** Whether this is the active workspace */
  isActive: boolean;
  /** Profile names in this workspace */
  profiles: string[];
  /** Whether the workspace path exists */
  exists: boolean;
}
