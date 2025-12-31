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
 * Profile configuration schema
 */
const profileSchema = v.object({
  headers: v.optional(v.record(v.string(), v.string()), CONFIG_DEFAULTS.profile.headers),
  timeoutMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), CONFIG_DEFAULTS.profile.timeoutMs),
  verifyTls: v.optional(v.boolean(), CONFIG_DEFAULTS.profile.verifyTls),
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
 * Workspace configuration schema (version 1)
 * Uses looseObject to allow unknown fields for forward compatibility
 */
export const workspaceConfigSchema = v.looseObject({
  version: v.literal(1),
  name: v.optional(v.pipe(v.string(), v.minLength(1))),
  baseUrl: v.optional(urlSchema),
  openapi: openApiSchema,
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
