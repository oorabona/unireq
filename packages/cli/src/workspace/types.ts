/**
 * Workspace type definitions
 */

import type { WorkspaceLocation } from './config/types.js';

// Re-export WorkspaceLocation as WorkspaceScope for backward compatibility
export type WorkspaceScope = WorkspaceLocation;

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
