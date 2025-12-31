/**
 * Workspace configuration module
 */

export { WorkspaceConfigError } from './errors.js';
export { CONFIG_FILE_NAME, hasWorkspaceConfig, loadWorkspaceConfig } from './loader.js';
export { CONFIG_DEFAULTS, workspaceConfigSchema } from './schema.js';
export type {
  AuthConfig,
  AuthProviderConfig,
  OpenApiCacheConfig,
  OpenApiConfig,
  ProfileConfig,
  RawWorkspaceConfig,
  WorkspaceConfig,
} from './types.js';
