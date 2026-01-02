/**
 * Workspace configuration types (kubectl-inspired model)
 *
 * Terminology:
 * - Workspace = 1 API (like kubectl cluster)
 * - Profile = 1 environment within an API (like kubectl context)
 * - Registry = global index of all known workspaces
 */

import type { AuthConfig, AuthProviderConfig } from '../../auth/types.js';
import type { BackendConfigValue } from '../../secrets/backend-types.js';

// Re-export auth types for convenience
export type { AuthConfig, AuthProviderConfig };

/**
 * Workspace location type
 * - local: Project-level workspace in .unireq/
 * - global: User-level workspace in ~/.config/unireq/workspaces/
 */
export type WorkspaceLocation = 'local' | 'global';

/**
 * Secrets storage backend configuration
 */
export interface SecretsBackendConfig {
  /** Backend selection: 'auto' | 'keychain' | 'vault' */
  backend: BackendConfigValue;
}

/**
 * OpenAPI cache configuration
 */
export interface OpenApiCacheConfig {
  /** Whether caching is enabled */
  enabled: boolean;
  /** Cache TTL in milliseconds */
  ttlMs: number;
}

/**
 * OpenAPI configuration
 */
export interface OpenApiConfig {
  /** Source URL or file path */
  source?: string;
  /** Cache configuration */
  cache?: OpenApiCacheConfig;
}

/**
 * Profile configuration (1 environment within a workspace)
 */
export interface ProfileConfig {
  /** Base URL for this environment (required) */
  baseUrl: string;
  /** HTTP headers to include in requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to verify TLS certificates */
  verifyTls?: boolean;
  /** Profile-specific variables */
  vars?: Record<string, string>;
  /** Profile-specific secrets (override workspace-level secrets) */
  secrets?: Record<string, string>;
}

/**
 * Output redaction configuration
 */
export interface OutputRedactionConfig {
  /** Whether redaction is enabled (default: true) */
  enabled: boolean;
  /** Additional header patterns to redact (supports * wildcard) */
  additionalPatterns: readonly string[];
}

/**
 * Output configuration
 */
export interface OutputConfig {
  /** Header redaction settings */
  redaction: OutputRedactionConfig;
}

/**
 * Workspace configuration (workspace.yaml)
 *
 * A workspace represents a single API with multiple environment profiles.
 */
export interface WorkspaceConfig {
  /** Schema version */
  version: 2;
  /** Workspace name (required) */
  name: string;
  /** OpenAPI configuration */
  openapi?: OpenApiConfig;
  /** Workspace-level secrets (shared across all profiles) */
  secrets?: Record<string, string>;
  /** Environment profiles */
  profiles?: Record<string, ProfileConfig>;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** Secrets storage backend configuration */
  secretsBackend?: SecretsBackendConfig;
  /** Output formatting configuration */
  output?: OutputConfig;
}

/**
 * Global configuration (config.yaml)
 *
 * Stored at ~/.config/unireq/config.yaml
 * Tracks active workspace and profile across sessions.
 */
export interface GlobalConfig {
  /** Schema version */
  version: 1;
  /** Currently active workspace name (matches registry key or "(local)") */
  activeWorkspace?: string;
  /** Currently active profile within the workspace */
  activeProfile?: string;
}
