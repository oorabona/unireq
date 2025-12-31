/**
 * Workspace type definitions
 */

/**
 * Workspace scope - local (project) or global (user-level)
 */
export type WorkspaceScope = 'local' | 'global';

/**
 * Information about a detected workspace
 */
export interface WorkspaceInfo {
  /** Absolute path to the .unireq directory */
  path: string;
  /** Whether this is a local (project) or global (user) workspace */
  scope: WorkspaceScope;
}

/**
 * Options for workspace detection
 */
export interface FindWorkspaceOptions {
  /** Starting directory for search (defaults to cwd) */
  startDir?: string;
}
