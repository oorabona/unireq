/**
 * Collection configuration Valibot schema
 */

import * as v from 'valibot';

/**
 * Valid HTTP methods (case-insensitive input, normalized to uppercase)
 */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

/**
 * HTTP method schema - accepts lowercase, normalizes to uppercase
 */
const httpMethodSchema = v.pipe(
  v.string(),
  v.transform((val) => val.toUpperCase()),
  v.picklist(HTTP_METHODS, 'Invalid HTTP method'),
);

/**
 * Assertion operator schema
 */
const assertOperatorSchema = v.picklist(['equals', 'contains', 'exists', 'matches']);

/**
 * JSON assertion schema
 */
const jsonAssertionSchema = v.object({
  path: v.string(),
  op: assertOperatorSchema,
  value: v.optional(v.unknown()),
  pattern: v.optional(v.string()),
});

/**
 * Assertion configuration schema
 */
const assertConfigSchema = v.optional(
  v.object({
    status: v.optional(v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(599))),
    headers: v.optional(v.record(v.string(), v.string())),
    json: v.optional(v.array(jsonAssertionSchema)),
    contains: v.optional(v.string()),
  }),
);

/**
 * Extract configuration schema
 */
const extractConfigSchema = v.optional(
  v.object({
    vars: v.optional(v.record(v.string(), v.string())),
  }),
);

/**
 * Saved request schema
 */
const savedRequestSchema = v.object({
  method: httpMethodSchema,
  path: v.pipe(v.string(), v.minLength(1, 'Path is required')),
  headers: v.optional(v.array(v.string())),
  body: v.optional(v.string()),
  query: v.optional(v.array(v.string())),
});

/**
 * Collection item schema
 */
const collectionItemSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1, 'Item ID is required')),
  name: v.pipe(v.string(), v.minLength(1, 'Item name is required')),
  description: v.optional(v.string()),
  request: savedRequestSchema,
  assert: assertConfigSchema,
  extract: extractConfigSchema,
  tags: v.optional(v.array(v.string())),
});

/**
 * Collection schema
 */
const collectionSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1, 'Collection ID is required')),
  name: v.pipe(v.string(), v.minLength(1, 'Collection name is required')),
  description: v.optional(v.string()),
  items: v.optional(v.array(collectionItemSchema), []),
});

/**
 * Root collection config schema
 */
export const collectionConfigSchema = v.object({
  version: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  collections: v.optional(v.array(collectionSchema), []),
});

/**
 * Parse and validate collection configuration
 */
export function parseCollectionConfig(data: unknown): v.InferOutput<typeof collectionConfigSchema> {
  return v.parse(collectionConfigSchema, data);
}

/**
 * Safely parse collection configuration (returns result object)
 */
export function safeParseCollectionConfig(data: unknown) {
  return v.safeParse(collectionConfigSchema, data);
}

// Re-export individual schemas for testing
export {
  httpMethodSchema,
  assertOperatorSchema,
  jsonAssertionSchema,
  assertConfigSchema,
  extractConfigSchema,
  savedRequestSchema,
  collectionItemSchema,
  collectionSchema,
};
