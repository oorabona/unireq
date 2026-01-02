/**
 * Workspace configuration module
 */

export { WorkspaceConfigError } from './errors.js';
export { CONFIG_FILE_NAME, hasWorkspaceConfig, loadWorkspaceConfig } from './loader.js';
export { CONFIG_DEFAULTS, globalConfigSchema, registryConfigSchema, workspaceConfigSchema } from './schema.js';
export type {
  AuthConfig,
  AuthProviderConfig,
  GlobalConfig,
  OpenApiCacheConfig,
  OpenApiConfig,
  OutputConfig,
  OutputRedactionConfig,
  ProfileConfig,
  SecretsBackendConfig,
  WorkspaceConfig,
  WorkspaceLocation,
} from './types.js';
