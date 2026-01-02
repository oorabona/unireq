/**
 * Workspace module - detection, path resolution, and configuration
 */

export type { WorkspaceInitOptions, WorkspaceInitResult } from './commands.js';
// Workspace commands
export { createWorkspaceCommand, initWorkspace, workspaceHandler } from './commands.js';
export type {
  AuthConfig,
  AuthProviderConfig,
  GlobalConfig,
  OpenApiCacheConfig,
  OpenApiConfig,
  ProfileConfig,
  WorkspaceConfig,
  WorkspaceLocation,
} from './config/index.js';
export {
  CONFIG_DEFAULTS,
  CONFIG_FILE_NAME,
  hasWorkspaceConfig,
  loadWorkspaceConfig,
  WorkspaceConfigError,
  workspaceConfigSchema,
} from './config/index.js';
export { APP_NAME, WORKSPACE_DIR_NAME } from './constants.js';
export { findWorkspace } from './detection.js';
export { getGlobalWorkspacePath } from './paths.js';
export type { FindWorkspaceOptions, WorkspaceInfo, WorkspaceScope } from './types.js';
export type { InterpolationContext, InterpolationOptions, VariableMatch, VariableType } from './variables/index.js';
// Variable interpolation
export {
  CircularReferenceError,
  DEFAULT_INTERPOLATION_OPTIONS,
  hasVariables,
  interpolate,
  interpolateAsync,
  isKnownType,
  MaxRecursionError,
  parseVariables,
  unescapeVariables,
  VariableError,
  VariableNotFoundError,
} from './variables/index.js';
