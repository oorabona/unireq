/**
 * Collections import module
 * Supports: Postman v2.1, Insomnia v4, HAR 1.2, cURL
 */

// cURL importer
export type { CurlImportOptions, ParsedCurl } from './curl.js';
export { importCurlCommand, isCurlCommand, parseCurlCommand } from './curl.js';
// Format detection
export { detectFormat, detectFormatFromString, getFormatDisplayName, getFormatFileExtension } from './detect.js';
export type { HarExportOptions } from './export-har.js';
// HAR exporter
export { expandVariables as expandHarVariables, exportCollectionToHar, exportToHar } from './export-har.js';
export type { PostmanExportOptions } from './export-postman.js';
// Postman exporter
export {
  convertVariableSyntax as convertToPostmanVariables,
  exportCollectionToPostman,
  exportToPostman,
} from './export-postman.js';
export type { HarImportOptions } from './har.js';
// HAR importer
export { importHarArchive } from './har.js';
export type { InsomniaImportOptions } from './insomnia.js';
// Insomnia importer
export { convertVariableSyntax as convertInsomniaVariableSyntax, importInsomniaExport } from './insomnia.js';
export type { ConflictInfo, ConflictResolution, MergeOptions, MergeResult, MergeStrategy } from './merge.js';
// Merge strategies
export { detectConflicts, mergeCollections, mergeMultipleCollections } from './merge.js';
export type { PostmanImportOptions } from './postman.js';
// Postman importer
export { convertVariableSyntax, importPostmanCollection, slugify } from './postman.js';
// Schemas
export {
  harArchiveSchema,
  insomniaExportSchema,
  parseHarArchive,
  parseInsomniaExport,
  parsePostmanCollection,
  postmanCollectionSchema,
} from './schemas.js';
// Types
export type {
  ExportErrorCode,
  ExportFormat,
  ExportOptions,
  ExportResult,
  FormatDetectionResult,
  // HAR types
  HarArchive,
  HarCache,
  HarCacheState,
  HarContent,
  HarCookie,
  HarCreator,
  HarEntry,
  HarLog,
  HarNameValue,
  HarPage,
  HarPageTiming,
  HarPostData,
  HarPostParam,
  HarQueryParam,
  HarRequest,
  HarResponse,
  HarTimings,
  ImportErrorCode,
  ImportedCollection,
  ImportedItem,
  // Common types
  ImportFormat,
  ImportResult,
  InsomniaAuthentication,
  InsomniaBody,
  InsomniaEnvironment,
  // Insomnia types
  InsomniaExport,
  InsomniaHeader,
  InsomniaParameter,
  InsomniaRequest,
  InsomniaRequestGroup,
  InsomniaResource,
  InsomniaResourceType,
  InsomniaWorkspace,
  PostmanBody,
  PostmanBodyMode,
  // Postman types
  PostmanCollection,
  PostmanFormDataParam,
  PostmanHeader,
  PostmanInfo,
  PostmanItem,
  PostmanQueryParam,
  PostmanRequest,
  PostmanResponse,
  PostmanUrl,
  PostmanUrlEncodedParam,
  PostmanVariable,
} from './types.js';
// Error classes
export { ExportError, ImportError } from './types.js';
