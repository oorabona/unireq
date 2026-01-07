/**
 * Valibot schemas for external collection format validation
 * Supports: Postman v2.1, Insomnia v4, HAR 1.2
 */

import * as v from 'valibot';

// ============================================================================
// Postman v2.1 Schema
// ============================================================================

/**
 * Postman URL can be string or object
 */
const postmanUrlSchema = v.union([
  v.string(),
  v.object({
    raw: v.optional(v.string()),
    protocol: v.optional(v.string()),
    host: v.optional(v.union([v.string(), v.array(v.string())])),
    path: v.optional(v.union([v.string(), v.array(v.string())])),
    query: v.optional(
      v.array(
        v.object({
          key: v.string(),
          value: v.optional(v.string()),
          disabled: v.optional(v.boolean()),
          description: v.optional(v.union([v.string(), v.object({ content: v.optional(v.string()) })])),
        }),
      ),
    ),
    variable: v.optional(
      v.array(
        v.object({
          key: v.string(),
          value: v.optional(v.string()),
          type: v.optional(v.string()),
          description: v.optional(v.union([v.string(), v.object({ content: v.optional(v.string()) })])),
        }),
      ),
    ),
  }),
]);

/**
 * Postman header schema
 */
const postmanHeaderSchema = v.object({
  key: v.string(),
  value: v.string(),
  type: v.optional(v.string()),
  disabled: v.optional(v.boolean()),
  description: v.optional(v.union([v.string(), v.object({ content: v.optional(v.string()) })])),
});

/**
 * Postman body schema
 */
const postmanBodySchema = v.optional(
  v.object({
    mode: v.optional(v.picklist(['raw', 'urlencoded', 'formdata', 'file', 'graphql'])),
    raw: v.optional(v.string()),
    urlencoded: v.optional(
      v.array(
        v.object({
          key: v.string(),
          value: v.optional(v.string()),
          type: v.optional(v.string()),
          disabled: v.optional(v.boolean()),
          description: v.optional(v.union([v.string(), v.object({ content: v.optional(v.string()) })])),
        }),
      ),
    ),
    formdata: v.optional(
      v.array(
        v.object({
          key: v.string(),
          value: v.optional(v.string()),
          type: v.optional(v.picklist(['text', 'file'])),
          src: v.optional(v.union([v.string(), v.array(v.string())])),
          disabled: v.optional(v.boolean()),
          description: v.optional(v.union([v.string(), v.object({ content: v.optional(v.string()) })])),
        }),
      ),
    ),
    graphql: v.optional(
      v.object({
        query: v.string(),
        variables: v.optional(v.string()),
      }),
    ),
    options: v.optional(
      v.object({
        raw: v.optional(
          v.object({
            language: v.optional(v.string()),
          }),
        ),
      }),
    ),
  }),
);

/**
 * Postman request schema
 */
const postmanRequestSchema = v.object({
  method: v.string(),
  url: postmanUrlSchema,
  header: v.optional(v.union([v.array(postmanHeaderSchema), v.string()])),
  body: postmanBodySchema,
  description: v.optional(v.union([v.string(), v.object({ content: v.optional(v.string()) })])),
  auth: v.optional(v.unknown()), // Skipped
});

/**
 * Postman item schema (recursive for folders)
 */
const postmanItemSchema: v.GenericSchema<unknown> = v.object({
  name: v.string(),
  description: v.optional(v.union([v.string(), v.object({ content: v.optional(v.string()) })])),
  request: v.optional(postmanRequestSchema),
  response: v.optional(v.array(v.unknown())),
  item: v.optional(v.lazy(() => v.array(postmanItemSchema))),
  event: v.optional(v.array(v.unknown())), // Skipped
});

/**
 * Postman info schema
 */
const postmanInfoSchema = v.object({
  name: v.string(),
  description: v.optional(v.union([v.string(), v.object({ content: v.optional(v.string()) })])),
  schema: v.string(),
  _postman_id: v.optional(v.string()),
});

/**
 * Postman Collection v2.1 schema
 */
export const postmanCollectionSchema = v.object({
  info: postmanInfoSchema,
  item: v.array(postmanItemSchema),
  variable: v.optional(
    v.array(
      v.object({
        key: v.string(),
        value: v.optional(v.string()),
        type: v.optional(v.string()),
        description: v.optional(v.union([v.string(), v.object({ content: v.optional(v.string()) })])),
      }),
    ),
  ),
  auth: v.optional(v.unknown()),
  event: v.optional(v.array(v.unknown())),
});

// ============================================================================
// Insomnia v4 Schema
// ============================================================================

/**
 * Insomnia resource type enum
 */
const insomniaResourceTypeSchema = v.picklist([
  'workspace',
  'request_group',
  'request',
  'environment',
  'cookie_jar',
  'api_spec',
  'unit_test_suite',
  'unit_test',
]);

/**
 * Insomnia base resource schema
 */
const insomniaBaseResourceSchema = v.object({
  _id: v.string(),
  _type: insomniaResourceTypeSchema,
  parentId: v.nullable(v.string()),
  created: v.optional(v.number()),
  modified: v.optional(v.number()),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
});

/**
 * Insomnia header schema
 */
const insomniaHeaderSchema = v.object({
  name: v.string(),
  value: v.string(),
  disabled: v.optional(v.boolean()),
});

/**
 * Insomnia parameter schema
 */
const insomniaParameterSchema = v.object({
  name: v.string(),
  value: v.string(),
  disabled: v.optional(v.boolean()),
});

/**
 * Insomnia body schema
 */
const insomniaBodySchema = v.object({
  mimeType: v.optional(v.string()),
  text: v.optional(v.string()),
  params: v.optional(v.array(insomniaParameterSchema)),
  fileName: v.optional(v.string()),
});

/**
 * Insomnia request schema (extends base)
 */
const insomniaRequestResourceSchema = v.object({
  ...insomniaBaseResourceSchema.entries,
  _type: v.literal('request'),
  method: v.string(),
  url: v.string(),
  headers: v.optional(v.array(insomniaHeaderSchema), []),
  parameters: v.optional(v.array(insomniaParameterSchema), []),
  body: v.optional(insomniaBodySchema, {}),
  authentication: v.optional(v.unknown()),
  settingEncodeUrl: v.optional(v.boolean()),
  settingSendCookies: v.optional(v.boolean()),
  settingStoreCookies: v.optional(v.boolean()),
  settingRebuildPath: v.optional(v.boolean()),
});

/**
 * Generic Insomnia resource schema (loose, for iteration)
 */
const insomniaResourceSchema = v.looseObject({
  _id: v.string(),
  _type: v.string(),
  parentId: v.optional(v.nullable(v.string())),
  name: v.optional(v.string()),
});

/**
 * Insomnia v4 export schema
 */
export const insomniaExportSchema = v.object({
  _type: v.literal('export'),
  __export_format: v.literal(4),
  __export_date: v.optional(v.string()),
  __export_source: v.optional(v.string()),
  resources: v.array(insomniaResourceSchema),
});

// ============================================================================
// HAR 1.2 Schema
// ============================================================================

/**
 * HAR name-value schema
 */
const harNameValueSchema = v.object({
  name: v.string(),
  value: v.string(),
  comment: v.optional(v.string()),
});

/**
 * HAR cookie schema
 */
const harCookieSchema = v.object({
  name: v.string(),
  value: v.string(),
  path: v.optional(v.string()),
  domain: v.optional(v.string()),
  expires: v.optional(v.nullable(v.string())),
  httpOnly: v.optional(v.boolean()),
  secure: v.optional(v.boolean()),
  comment: v.optional(v.string()),
});

/**
 * HAR post param schema
 */
const harPostParamSchema = v.object({
  name: v.string(),
  value: v.optional(v.string()),
  fileName: v.optional(v.string()),
  contentType: v.optional(v.string()),
  comment: v.optional(v.string()),
});

/**
 * HAR post data schema
 */
const harPostDataSchema = v.optional(
  v.object({
    mimeType: v.string(),
    text: v.optional(v.string()),
    params: v.optional(v.array(harPostParamSchema)),
    comment: v.optional(v.string()),
  }),
);

/**
 * HAR request schema
 */
const harRequestSchema = v.object({
  method: v.string(),
  url: v.string(),
  httpVersion: v.string(),
  cookies: v.optional(v.array(harCookieSchema), []),
  headers: v.optional(v.array(harNameValueSchema), []),
  queryString: v.optional(v.array(harNameValueSchema), []),
  postData: harPostDataSchema,
  headersSize: v.optional(v.number(), -1),
  bodySize: v.optional(v.number(), -1),
  comment: v.optional(v.string()),
});

/**
 * HAR content schema
 */
const harContentSchema = v.object({
  size: v.number(),
  compression: v.optional(v.number()),
  mimeType: v.string(),
  text: v.optional(v.string()),
  encoding: v.optional(v.string()),
  comment: v.optional(v.string()),
});

/**
 * HAR response schema
 */
const harResponseSchema = v.object({
  status: v.number(),
  statusText: v.string(),
  httpVersion: v.string(),
  cookies: v.optional(v.array(harCookieSchema), []),
  headers: v.optional(v.array(harNameValueSchema), []),
  content: harContentSchema,
  redirectURL: v.optional(v.string(), ''),
  headersSize: v.optional(v.number(), -1),
  bodySize: v.optional(v.number(), -1),
  comment: v.optional(v.string()),
});

/**
 * HAR timings schema
 */
const harTimingsSchema = v.object({
  blocked: v.optional(v.number()),
  dns: v.optional(v.number()),
  connect: v.optional(v.number()),
  send: v.number(),
  wait: v.number(),
  receive: v.number(),
  ssl: v.optional(v.number()),
  comment: v.optional(v.string()),
});

/**
 * HAR cache schema
 */
const harCacheSchema = v.optional(
  v.object({
    beforeRequest: v.optional(v.nullable(v.unknown())),
    afterRequest: v.optional(v.nullable(v.unknown())),
    comment: v.optional(v.string()),
  }),
  {},
);

/**
 * HAR entry schema
 */
const harEntrySchema = v.object({
  pageref: v.optional(v.string()),
  startedDateTime: v.string(),
  time: v.number(),
  request: harRequestSchema,
  response: harResponseSchema,
  cache: harCacheSchema,
  timings: harTimingsSchema,
  serverIPAddress: v.optional(v.string()),
  connection: v.optional(v.string()),
  comment: v.optional(v.string()),
});

/**
 * HAR creator schema
 */
const harCreatorSchema = v.object({
  name: v.string(),
  version: v.string(),
  comment: v.optional(v.string()),
});

/**
 * HAR page timings schema
 */
const harPageTimingsSchema = v.object({
  onContentLoad: v.optional(v.number()),
  onLoad: v.optional(v.number()),
  comment: v.optional(v.string()),
});

/**
 * HAR page schema
 */
const harPageSchema = v.object({
  startedDateTime: v.string(),
  id: v.string(),
  title: v.string(),
  pageTimings: harPageTimingsSchema,
  comment: v.optional(v.string()),
});

/**
 * HAR log schema
 */
const harLogSchema = v.object({
  version: v.string(),
  creator: harCreatorSchema,
  browser: v.optional(harCreatorSchema),
  pages: v.optional(v.array(harPageSchema)),
  entries: v.array(harEntrySchema),
  comment: v.optional(v.string()),
});

/**
 * HAR 1.2 archive schema
 */
export const harArchiveSchema = v.object({
  log: harLogSchema,
});

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse Postman collection
 */
export function parsePostmanCollection(data: unknown) {
  return v.safeParse(postmanCollectionSchema, data);
}

/**
 * Parse Insomnia export
 */
export function parseInsomniaExport(data: unknown) {
  return v.safeParse(insomniaExportSchema, data);
}

/**
 * Parse HAR archive
 */
export function parseHarArchive(data: unknown) {
  return v.safeParse(harArchiveSchema, data);
}

// Re-export for testing
export {
  postmanItemSchema,
  postmanRequestSchema,
  insomniaRequestResourceSchema,
  insomniaResourceSchema,
  harEntrySchema,
  harRequestSchema,
};
