/**
 * Collection-specific error classes
 */

/**
 * Base class for collection errors
 */
export class CollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionError';
    Object.setPrototypeOf(this, CollectionError.prototype);
  }
}

/**
 * Error thrown when YAML parsing fails
 */
export class CollectionParseError extends CollectionError {
  /** Line number where the error occurred (if available) */
  readonly line?: number;
  /** Column number where the error occurred (if available) */
  readonly column?: number;

  constructor(message: string, line?: number, column?: number) {
    const locationInfo = line !== undefined ? ` at line ${line}${column !== undefined ? `:${column}` : ''}` : '';
    super(`Failed to parse collections YAML${locationInfo}: ${message}`);
    this.name = 'CollectionParseError';
    this.line = line;
    this.column = column;
    Object.setPrototypeOf(this, CollectionParseError.prototype);
  }
}

/**
 * Error thrown when schema validation fails
 */
export class CollectionValidationError extends CollectionError {
  /** Path to the invalid field */
  readonly path: string;
  /** Expected type or value */
  readonly expected?: string;
  /** Received value */
  readonly received?: string;

  constructor(message: string, path: string, expected?: string, received?: string) {
    super(`Collection validation failed at ${path}: ${message}`);
    this.name = 'CollectionValidationError';
    this.path = path;
    this.expected = expected;
    this.received = received;
    Object.setPrototypeOf(this, CollectionValidationError.prototype);
  }
}

/**
 * Error thrown when duplicate IDs are found
 */
export class CollectionDuplicateIdError extends CollectionError {
  /** The duplicate ID */
  readonly duplicateId: string;
  /** The collection ID (if duplicate is an item) */
  readonly collectionId?: string;
  /** Whether this is a collection or item duplicate */
  readonly type: 'collection' | 'item';

  constructor(duplicateId: string, type: 'collection' | 'item', collectionId?: string) {
    const context = type === 'item' && collectionId ? ` in collection: ${collectionId}` : '';
    super(`Duplicate ${type} ID: ${duplicateId}${context}`);
    this.name = 'CollectionDuplicateIdError';
    this.duplicateId = duplicateId;
    this.collectionId = collectionId;
    this.type = type;
    Object.setPrototypeOf(this, CollectionDuplicateIdError.prototype);
  }
}
