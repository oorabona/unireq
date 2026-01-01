/**
 * Collections module - saved requests and test scenarios
 */

// Errors
export {
  CollectionDuplicateIdError,
  CollectionError,
  CollectionParseError,
  CollectionValidationError,
} from './errors.js';
// Loader
export { COLLECTIONS_FILE_NAME, collectionsFileExists, loadCollections } from './loader.js';
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
