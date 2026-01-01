/**
 * Workspace configuration Valibot schema
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
  secrets: {
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
 * Auth configuration schema
 * Uses proper typed provider schemas from auth module
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
 * Secrets configuration schema
 */
const secretsSchema = v.optional(
  v.object({
    backend: v.optional(v.picklist(['auto', 'keychain', 'vault']), CONFIG_DEFAULTS.secrets.backend),
  }),
  CONFIG_DEFAULTS.secrets,
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
  secrets: secretsSchema,
  vars: v.optional(v.record(v.string(), v.string()), {}),
  output: outputSchema,
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
