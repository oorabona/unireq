/**
 * Workspace configuration Valibot schemas (kubectl-inspired model)
 */

import * as v from 'valibot';
import { authConfigSchema } from '../../auth/schema.js';

/**
 * Default values for workspace configuration
 */
export const CONFIG_DEFAULTS = {
  openapi: {
    cache: {
      enabled: true,
      ttlMs: 86400000, // 24 hours
    },
  },
  profile: {
    headers: {} as Record<string, string>,
    timeoutMs: 30000,
    verifyTls: true,
  },
  output: {
    redaction: {
      enabled: true,
      additionalPatterns: [] as string[],
    },
  },
  secretsBackend: {
    backend: 'auto' as const,
  },
};

/**
 * OpenAPI cache configuration schema
 */
const openApiCacheSchema = v.object({
  enabled: v.optional(v.boolean(), CONFIG_DEFAULTS.openapi.cache.enabled),
  ttlMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), CONFIG_DEFAULTS.openapi.cache.ttlMs),
});

/**
 * OpenAPI configuration schema
 */
const openApiSchema = v.optional(
  v.object({
    source: v.optional(v.string()),
    cache: v.optional(openApiCacheSchema, CONFIG_DEFAULTS.openapi.cache),
  }),
  { cache: CONFIG_DEFAULTS.openapi.cache },
);

/**
 * URL validation schema
 */
const urlSchema = v.pipe(
  v.string(),
  v.check((val) => {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, 'Must be a valid URL'),
);

/**
 * Profile configuration schema
 * baseUrl is required, vars and secrets are optional
 */
const profileSchema = v.object({
  baseUrl: urlSchema, // Required
  headers: v.optional(v.record(v.string(), v.string())),
  timeoutMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  verifyTls: v.optional(v.boolean()),
  vars: v.optional(v.record(v.string(), v.string())),
  secrets: v.optional(v.record(v.string(), v.string())),
});

/**
 * Auth configuration schema
 */
const authSchema = v.optional(authConfigSchema, { providers: {} });

/**
 * Output redaction configuration schema
 */
const outputRedactionSchema = v.object({
  enabled: v.optional(v.boolean(), CONFIG_DEFAULTS.output.redaction.enabled),
  additionalPatterns: v.optional(v.array(v.string()), []),
});

/**
 * Output configuration schema
 */
const outputSchema = v.optional(
  v.object({
    redaction: v.optional(outputRedactionSchema, CONFIG_DEFAULTS.output.redaction),
  }),
  { redaction: CONFIG_DEFAULTS.output.redaction },
);

/**
 * Secrets backend configuration schema
 */
const secretsBackendSchema = v.optional(
  v.object({
    backend: v.optional(v.picklist(['auto', 'keychain', 'vault']), CONFIG_DEFAULTS.secretsBackend.backend),
  }),
  CONFIG_DEFAULTS.secretsBackend,
);

/**
 * Workspace configuration schema (workspace.yaml)
 *
 * Workspace = 1 API with N profiles (environments)
 */
export const workspaceConfigSchema = v.looseObject({
  version: v.literal(2),
  name: v.pipe(v.string(), v.minLength(1)),
  openapi: openApiSchema,
  secrets: v.optional(v.record(v.string(), v.string()), {}),
  profiles: v.optional(v.record(v.string(), profileSchema), {}),
  auth: authSchema,
  secretsBackend: secretsBackendSchema,
  output: outputSchema,
});

/**
 * Schema for initial version check (before full validation)
 */
export const versionCheckSchema = v.object({
  version: v.number(),
});

/**
 * Global configuration schema (config.yaml)
 * Stores active workspace and profile
 */
export const globalConfigSchema = v.object({
  version: v.literal(1),
  activeWorkspace: v.optional(v.string()),
  activeProfile: v.optional(v.string()),
});

/**
 * Registry entry schema
 */
const registryEntrySchema = v.object({
  path: v.string(),
  location: v.picklist(['local', 'global']),
  description: v.optional(v.string()),
});

/**
 * Registry configuration schema (registry.yaml)
 */
export const registryConfigSchema = v.object({
  version: v.literal(1),
  workspaces: v.optional(v.record(v.string(), registryEntrySchema), {}),
});

/**
 * Inferred types from schemas
 */
export type WorkspaceConfigFromSchema = v.InferOutput<typeof workspaceConfigSchema>;
export type GlobalConfigFromSchema = v.InferOutput<typeof globalConfigSchema>;
export type RegistryConfigFromSchema = v.InferOutput<typeof registryConfigSchema>;
