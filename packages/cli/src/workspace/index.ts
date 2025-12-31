/**
 * Workspace module - detection and path resolution
 */

export { APP_NAME, WORKSPACE_DIR_NAME } from './constants.js';
export { findWorkspace } from './detection.js';
export { getGlobalWorkspacePath } from './paths.js';
export type { FindWorkspaceOptions, WorkspaceInfo, WorkspaceScope } from './types.js';
