/**
 * Collections module - saved requests and test scenarios
 */

// Commands
export {
  createExtractCommand,
  createRunCommand,
  createSaveCommand,
  createVarsCommand,
  extractHandler,
  runHandler,
  saveHandler,
  varsHandler,
} from './commands.js';
// Errors
export {
  CollectionDuplicateIdError,
  CollectionError,
  CollectionParseError,
  CollectionValidationError,
} from './errors.js';
// Extractor
export type { ExtractionResult } from './extractor.js';
export { ExtractionError, extractSingleVariable, extractVariables } from './extractor.js';
// JSONPath
export type { JsonPathSegment, ParsedJsonPath } from './jsonpath.js';
export {
  evaluateJsonPath,
  extractByPath,
  InvalidJsonPathError,
  JsonPathNotFoundError,
  parseJsonPath,
} from './jsonpath.js';
// Loader
export { COLLECTIONS_FILE_NAME, collectionsFileExists, loadCollections } from './loader.js';
export type { RunArgs } from './runner.js';
// Runner
export {
  CollectionNotFoundError,
  findCollectionItem,
  getAvailableCollections,
  getAvailableItems,
  ItemNotFoundError,
  parseRunArgs,
  RunSyntaxError,
  savedRequestToParsedRequest,
} from './runner.js';
// Saver
export type { SaveArgs, SaveResult } from './saver.js';
export {
  CollectionWriteError,
  InvalidIdError,
  NoRequestToSaveError,
  parsedRequestToSavedRequest,
  parseSaveArgs,
  SaveSyntaxError,
  saveToCollections,
  validateId,
} from './saver.js';
// Schema
export {
  collectionConfigSchema,
  parseCollectionConfig,
  safeParseCollectionConfig,
} from './schema.js';
// Types
export type {
  AssertConfig,
  AssertOperator,
  Collection,
  CollectionConfig,
  CollectionHttpMethod,
  CollectionItem,
  ExtractConfig,
  JsonAssertion,
  LoadCollectionsResult,
  SavedRequest,
} from './types.js';
