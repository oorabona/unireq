/**
 * Workspace configuration types
 */

import type { AuthConfig, AuthProviderConfig } from '../../auth/types.js';

// Re-export auth types for convenience
export type { AuthConfig, AuthProviderConfig };

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

// Note: AuthConfig and AuthProviderConfig are now imported from auth module

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
