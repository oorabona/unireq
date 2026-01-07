/**
 * Import/Export types for external collection formats
 * Supports: Postman v2.1, Insomnia v4, HAR 1.2
 */

// ============================================================================
// Postman Collection v2.1 Types
// https://schema.getpostman.com/json/collection/v2.1.0/collection.json
// ============================================================================

/**
 * Postman collection info
 */
export interface PostmanInfo {
  name: string;
  description?: string;
  schema: string;
  _postman_id?: string;
}

/**
 * Postman URL representation
 */
export interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQueryParam[];
  variable?: PostmanVariable[];
}

/**
 * Postman query parameter
 */
export interface PostmanQueryParam {
  key: string;
  value?: string;
  disabled?: boolean;
  description?: string;
}

/**
 * Postman variable
 */
export interface PostmanVariable {
  key: string;
  value?: string;
  type?: string;
  description?: string;
}

/**
 * Postman header
 */
export interface PostmanHeader {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
  description?: string;
}

/**
 * Postman body modes
 */
export type PostmanBodyMode = 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql';

/**
 * Postman urlencoded form data
 */
export interface PostmanUrlEncodedParam {
  key: string;
  value?: string;
  type?: string;
  disabled?: boolean;
  description?: string;
}

/**
 * Postman form data
 */
export interface PostmanFormDataParam {
  key: string;
  value?: string;
  type?: 'text' | 'file';
  src?: string;
  disabled?: boolean;
  description?: string;
}

/**
 * Postman request body
 */
export interface PostmanBody {
  mode?: PostmanBodyMode;
  raw?: string;
  urlencoded?: PostmanUrlEncodedParam[];
  formdata?: PostmanFormDataParam[];
  graphql?: {
    query: string;
    variables?: string;
  };
  options?: {
    raw?: {
      language?: string;
    };
  };
}

/**
 * Postman request
 */
export interface PostmanRequest {
  method: string;
  url: string | PostmanUrl;
  header?: PostmanHeader[];
  body?: PostmanBody;
  description?: string;
  auth?: unknown; // Skipped - not imported
}

/**
 * Postman response (for examples)
 */
export interface PostmanResponse {
  name?: string;
  status?: string;
  code?: number;
  header?: PostmanHeader[];
  body?: string;
}

/**
 * Postman item (request or folder)
 * Note: In Postman v2.1, request can be a string URL or a full request object
 */
export interface PostmanItem {
  name: string;
  description?: string;
  request?: string | PostmanRequest;
  response?: PostmanResponse[];
  item?: PostmanItem[]; // Nested items (folder)
  event?: unknown[]; // Skipped - scripts not imported
}

/**
 * Postman Collection v2.1 root
 */
export interface PostmanCollection {
  info: PostmanInfo;
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: unknown; // Skipped
  event?: unknown[]; // Skipped
}

// ============================================================================
// Insomnia v4 Export Types
// ============================================================================

/**
 * Insomnia resource types
 */
export type InsomniaResourceType =
  | 'workspace'
  | 'request_group'
  | 'request'
  | 'environment'
  | 'cookie_jar'
  | 'api_spec'
  | 'unit_test_suite'
  | 'unit_test';

/**
 * Insomnia base resource
 */
export interface InsomniaResource {
  _id: string;
  _type: InsomniaResourceType;
  parentId?: string | null;
  created?: number;
  modified?: number;
  name?: string;
  description?: string;
}

/**
 * Insomnia workspace
 */
export interface InsomniaWorkspace extends InsomniaResource {
  _type: 'workspace';
  scope: 'design' | 'collection';
}

/**
 * Insomnia request group (folder)
 */
export interface InsomniaRequestGroup extends InsomniaResource {
  _type: 'request_group';
  environment?: Record<string, unknown>;
}

/**
 * Insomnia request header
 */
export interface InsomniaHeader {
  name: string;
  value: string;
  disabled?: boolean;
}

/**
 * Insomnia request parameter
 */
export interface InsomniaParameter {
  name: string;
  value: string;
  type?: string;
  disabled?: boolean;
}

/**
 * Insomnia request body
 */
export interface InsomniaBody {
  mimeType?: string;
  text?: string;
  params?: InsomniaParameter[];
  fileName?: string;
}

/**
 * Insomnia request authentication
 */
export interface InsomniaAuthentication {
  type: string;
  token?: string;
  prefix?: string;
  username?: string;
  password?: string;
  // Many other auth fields - skipped
}

/**
 * Insomnia request
 */
export interface InsomniaRequest extends InsomniaResource {
  _type: 'request';
  method: string;
  url: string;
  headers: InsomniaHeader[];
  parameters: InsomniaParameter[];
  body: InsomniaBody;
  authentication?: InsomniaAuthentication; // Skipped
  settingEncodeUrl?: boolean;
  settingSendCookies?: boolean;
  settingStoreCookies?: boolean;
  settingRebuildPath?: boolean;
}

/**
 * Insomnia environment (skipped during import)
 */
export interface InsomniaEnvironment extends InsomniaResource {
  _type: 'environment';
  data: Record<string, unknown>;
}

/**
 * Union of all Insomnia resource types for the export resources array
 */
export type InsomniaResourceUnion =
  | InsomniaResource
  | InsomniaWorkspace
  | InsomniaRequestGroup
  | InsomniaRequest
  | InsomniaEnvironment;

/**
 * Insomnia v4 export root
 */
export interface InsomniaExport {
  _type: 'export';
  __export_format: 4;
  __export_date?: string;
  __export_source?: string;
  resources: InsomniaResourceUnion[];
}

// ============================================================================
// HAR 1.2 Types
// http://www.softwareishard.com/blog/har-12-spec/
// ============================================================================

/**
 * HAR name-value pair
 */
export interface HarNameValue {
  name: string;
  value: string;
  comment?: string;
}

/**
 * HAR cookie
 */
export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string | null;
  httpOnly?: boolean;
  secure?: boolean;
  comment?: string;
}

/**
 * HAR query string parameter
 */
export interface HarQueryParam {
  name: string;
  value: string;
  comment?: string;
}

/**
 * HAR post data parameter
 */
export interface HarPostParam {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
  comment?: string;
}

/**
 * HAR post data
 */
export interface HarPostData {
  mimeType: string;
  text?: string;
  params?: HarPostParam[];
  comment?: string;
}

/**
 * HAR request
 */
export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarNameValue[];
  queryString: HarQueryParam[];
  postData?: HarPostData;
  headersSize: number;
  bodySize: number;
  comment?: string;
}

/**
 * HAR response content
 */
export interface HarContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
  comment?: string;
}

/**
 * HAR response
 */
export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarNameValue[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
  comment?: string;
}

/**
 * HAR cache state
 */
export interface HarCacheState {
  expires?: string;
  lastAccess: string;
  eTag: string;
  hitCount: number;
  comment?: string;
}

/**
 * HAR cache
 */
export interface HarCache {
  beforeRequest?: HarCacheState | null;
  afterRequest?: HarCacheState | null;
  comment?: string;
}

/**
 * HAR timing info
 */
export interface HarTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number;
  receive: number;
  ssl?: number;
  comment?: string;
}

/**
 * HAR entry
 */
export interface HarEntry {
  pageref?: string;
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache: HarCache;
  timings: HarTimings;
  serverIPAddress?: string;
  connection?: string;
  comment?: string;
}

/**
 * HAR page timing
 */
export interface HarPageTiming {
  onContentLoad?: number;
  onLoad?: number;
  comment?: string;
}

/**
 * HAR page
 */
export interface HarPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: HarPageTiming;
  comment?: string;
}

/**
 * HAR creator/browser info
 */
export interface HarCreator {
  name: string;
  version: string;
  comment?: string;
}

/**
 * HAR log
 */
export interface HarLog {
  version: string;
  creator: HarCreator;
  browser?: HarCreator;
  pages?: HarPage[];
  entries: HarEntry[];
  comment?: string;
}

/**
 * HAR 1.2 root
 */
export interface HarArchive {
  log: HarLog;
}

// ============================================================================
// Format Detection Types
// ============================================================================

/**
 * Supported import formats
 */
export type ImportFormat = 'postman' | 'insomnia' | 'har';

/**
 * Format detection result
 */
export interface FormatDetectionResult {
  format: ImportFormat;
  version: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Import result (common for all formats)
 */
export interface ImportResult {
  success: boolean;
  format: ImportFormat;
  collections: ImportedCollection[];
  warnings: string[];
  errors: string[];
}

/**
 * Imported collection result (returned by importers)
 */
export interface ImportedCollection {
  /** Import format */
  format: ImportFormat;
  /** Format version */
  version: string;
  /** Converted collections */
  collections: import('../types.js').Collection[];
  /** Imported items with metadata */
  items: ImportedItem[];
  /** Import warnings */
  warnings: string[];
  /** Import statistics */
  stats: {
    totalItems: number;
    convertedItems: number;
    skippedItems: number;
  };
  /** Collection name (from source) */
  name?: string;
}

/**
 * Imported item (intermediate format)
 */
export interface ImportedItem {
  id: string;
  name: string;
  description?: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  queryParams: Record<string, string>;
  /** Original source ID from the imported format */
  sourceId?: string;
  /** Source path for Postman/Insomnia folder structure */
  sourcePath?: string;
  /** The converted CollectionItem */
  item: import('../types.js').CollectionItem;
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Supported export formats
 */
export type ExportFormat = 'postman' | 'har';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  outputPath?: string;
  includeResponses?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  /** Export format used */
  format: ExportFormat;
  /** The exported data (Postman JSON or HAR JSON) */
  data: unknown;
  /** Export warnings */
  warnings: string[];
  /** Export statistics */
  stats: {
    totalItems: number;
    exportedItems: number;
    skippedItems?: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Import error codes
 */
export type ImportErrorCode =
  | 'INVALID_JSON'
  | 'UNSUPPORTED_FORMAT'
  | 'UNSUPPORTED_VERSION'
  | 'VALIDATION_ERROR'
  | 'MISSING_REQUIRED_FIELD'
  | 'FILE_READ_ERROR'
  | 'CONVERSION_ERROR';

/**
 * Import error
 */
export class ImportError extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

/**
 * Export error codes
 */
export type ExportErrorCode = 'EMPTY_COLLECTION' | 'WRITE_ERROR' | 'INVALID_COLLECTION';

/**
 * Export error
 */
export class ExportError extends Error {
  constructor(
    public readonly code: ExportErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ExportError';
  }
}
