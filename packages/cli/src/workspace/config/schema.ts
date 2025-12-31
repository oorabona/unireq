/**
 * Workspace configuration Valibot schema
 */

import * as v from 'valibot';

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
} as const;

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
 * All fields optional - profiles override workspace defaults when set
 */
const profileSchema = v.object({
  baseUrl: v.optional(urlSchema),
  headers: v.optional(v.record(v.string(), v.string())),
  timeoutMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  verifyTls: v.optional(v.boolean()),
  vars: v.optional(v.record(v.string(), v.string())),
});

/**
 * Auth provider configuration schema (permissive for now)
 */
const authProviderSchema = v.looseObject({
  type: v.string(),
});

/**
 * Auth configuration schema
 */
const authSchema = v.optional(
  v.object({
    active: v.optional(v.string()),
    providers: v.optional(v.record(v.string(), authProviderSchema), {}),
  }),
  { providers: {} },
);

/**
 * Workspace configuration schema (version 1)
 * Uses looseObject to allow unknown fields for forward compatibility
 */
export const workspaceConfigSchema = v.looseObject({
  version: v.literal(1),
  name: v.optional(v.pipe(v.string(), v.minLength(1))),
  baseUrl: v.optional(urlSchema),
  openapi: openApiSchema,
  activeProfile: v.optional(v.string()),
  profiles: v.optional(v.record(v.string(), profileSchema), {}),
  auth: authSchema,
  vars: v.optional(v.record(v.string(), v.string()), {}),
});

/**
 * Schema for initial version check (before full validation)
 */
export const versionCheckSchema = v.object({
  version: v.number(),
});

/**
 * Inferred type from schema
 */
export type WorkspaceConfigFromSchema = v.InferOutput<typeof workspaceConfigSchema>;
