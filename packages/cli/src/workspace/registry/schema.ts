/**
 * Valibot schema for workspace registry
 */

import * as v from 'valibot';

/**
 * Schema for a single workspace entry
 */
export const workspaceEntrySchema = v.object({
  path: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string()),
});

/**
 * Schema for the registry config file
 */
export const registryConfigSchema = v.object({
  version: v.literal(1),
  active: v.optional(v.string()),
  workspaces: v.record(v.string(), workspaceEntrySchema),
});

/**
 * Schema for version check only
 */
export const registryVersionCheckSchema = v.object({
  version: v.number(),
});
