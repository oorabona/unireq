/**
 * Workspace module - detection, path resolution, and configuration
 */

export { APP_NAME, WORKSPACE_DIR_NAME } from './constants.js';
export {
  CONFIG_DEFAULTS,
  CONFIG_FILE_NAME,
  hasWorkspaceConfig,
  loadWorkspaceConfig,
  WorkspaceConfigError,
  workspaceConfigSchema,
} from './config/index.js';
export type {
  AuthConfig,
  AuthProviderConfig,
  OpenApiCacheConfig,
  OpenApiConfig,
  ProfileConfig,
  RawWorkspaceConfig,
  WorkspaceConfig,
} from './config/index.js';
export { findWorkspace } from './detection.js';
export { getGlobalWorkspacePath } from './paths.js';
export type { FindWorkspaceOptions, WorkspaceInfo, WorkspaceScope } from './types.js';

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
export type { InterpolationContext, InterpolationOptions, VariableMatch, VariableType } from './variables/index.js';
