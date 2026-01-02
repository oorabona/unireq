/**
 * Valibot schema for workspace registry (kubectl-inspired model)
 */

import * as v from 'valibot';

/**
 * Schema for a single workspace entry
 * Includes location field to distinguish local from global workspaces
 */
export const workspaceEntrySchema = v.object({
  path: v.pipe(v.string(), v.minLength(1)),
  location: v.picklist(['local', 'global']),
  description: v.optional(v.string()),
});

/**
 * Schema for the registry config file (registry.yaml)
 *
 * Note: active workspace/profile is now stored in config.yaml (GlobalConfig)
 */
export const registryConfigSchema = v.object({
  version: v.literal(1),
  workspaces: v.record(v.string(), workspaceEntrySchema),
});

/**
 * Schema for version check only
 */
export const registryVersionCheckSchema = v.object({
  version: v.number(),
});
