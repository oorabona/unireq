/**
 * Workspace registry types
 * Manages multiple workspaces like kubectl contexts
 */

/**
 * A single workspace entry in the registry
 */
export interface WorkspaceEntry {
  /** Absolute path to the workspace directory (.unireq) */
  path: string;
  /** Optional description */
  description?: string;
}

/**
 * Registry configuration (stored in workspaces.yaml)
 */
export interface RegistryConfig {
  /** Schema version */
  version: 1;
  /** Currently active workspace name (optional) */
  active?: string;
  /** Map of workspace name to entry */
  workspaces: Record<string, WorkspaceEntry>;
}

/**
 * Workspace info for display (extends entry with computed fields)
 */
export interface WorkspaceDisplayInfo {
  /** Workspace name (key in registry) */
  name: string;
  /** Absolute path to workspace directory */
  path: string;
  /** Optional description */
  description?: string;
  /** Whether this is the active workspace */
  isActive: boolean;
  /** Source: 'registry' or 'local' (detected from cwd) */
  source: 'registry' | 'local';
  /** Whether the workspace path exists */
  exists: boolean;
}
