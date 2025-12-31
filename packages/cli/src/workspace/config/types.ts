/**
 * Workspace configuration types
 */

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
  cache: OpenApiCacheConfig;
}

/**
 * Profile configuration for a specific environment
 * All fields are optional - profiles override workspace defaults when set
 */
export interface ProfileConfig {
  /** Base URL override for this profile */
  baseUrl?: string;
  /** HTTP headers to include in requests (merged with workspace headers) */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to verify TLS certificates */
  verifyTls?: boolean;
  /** Profile-specific variables (merged with workspace vars) */
  vars?: Record<string, string>;
}

/**
 * Auth provider configuration (opaque for now, detailed in auth scope)
 */
export interface AuthProviderConfig {
  /** Provider type */
  type: string;
  /** Provider-specific configuration */
  [key: string]: unknown;
}

/**
 * Auth configuration
 */
export interface AuthConfig {
  /** Currently active provider key */
  active?: string;
  /** Map of provider key to config */
  providers: Record<string, AuthProviderConfig>;
}

/**
 * Complete workspace configuration (workspace.yaml)
 */
export interface WorkspaceConfig {
  /** Schema version (must be 1) */
  version: number;
  /** Workspace name */
  name?: string;
  /** Base URL for API requests */
  baseUrl?: string;
  /** OpenAPI configuration */
  openapi: OpenApiConfig;
  /** Currently active profile name */
  activeProfile?: string;
  /** Environment profiles */
  profiles: Record<string, ProfileConfig>;
  /** Authentication configuration */
  auth: AuthConfig;
  /** User-defined variables */
  vars: Record<string, string>;
}

/**
 * Raw config with potential unknown fields (for forward compatibility)
 */
export interface RawWorkspaceConfig extends WorkspaceConfig {
  /** Unknown fields from newer schema versions */
  [key: string]: unknown;
}
