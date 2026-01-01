/**
 * Collection saver - save requests to collections.yaml
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml, YAMLParseError } from 'yaml';
import type { ParsedRequest } from '../types.js';
import { CollectionParseError } from './errors.js';
import { safeParseCollectionConfig } from './schema.js';
import type { CollectionConfig, CollectionItem, SavedRequest } from './types.js';

/**
 * Collections file name
 */
const COLLECTIONS_FILE_NAME = 'collections.yaml';

/**
 * Valid ID pattern: alphanumeric, dash, underscore
 */
const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Save arguments
 */
export interface SaveArgs {
  collectionId: string;
  itemId: string;
  name?: string;
}

/**
 * Error thrown when save syntax is invalid
 */
export class SaveSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveSyntaxError';
    Object.setPrototypeOf(this, SaveSyntaxError.prototype);
  }
}

/**
 * Error thrown when no request has been executed
 */
export class NoRequestToSaveError extends Error {
  constructor() {
    super('No request to save. Execute a request first.');
    this.name = 'NoRequestToSaveError';
    Object.setPrototypeOf(this, NoRequestToSaveError.prototype);
  }
}

/**
 * Error thrown when ID format is invalid
 */
export class InvalidIdError extends Error {
  readonly id: string;
  readonly idType: 'collection' | 'item';

  constructor(id: string, idType: 'collection' | 'item') {
    super(`Invalid ${idType} ID: "${id}". Use alphanumeric characters, dashes, or underscores only.`);
    this.name = 'InvalidIdError';
    this.id = id;
    this.idType = idType;
    Object.setPrototypeOf(this, InvalidIdError.prototype);
  }
}

/**
 * Error thrown when writing to collections fails
 */
export class CollectionWriteError extends Error {
  override readonly cause: Error;

  constructor(message: string, cause: Error) {
    super(message);
    this.name = 'CollectionWriteError';
    this.cause = cause;
    Object.setPrototypeOf(this, CollectionWriteError.prototype);
  }
}

/**
 * Validate an ID (collection or item)
 */
export function validateId(id: string, idType: 'collection' | 'item'): void {
  if (!id || !VALID_ID_PATTERN.test(id)) {
    throw new InvalidIdError(id, idType);
  }
}

/**
 * Parse save command arguments
 * @param args - Command arguments ["collection/item", "--name", "Name"]
 * @returns Parsed save arguments
 * @throws SaveSyntaxError if format is invalid
 */
export function parseSaveArgs(args: string[]): SaveArgs {
  if (args.length === 0) {
    throw new SaveSyntaxError('Usage: save <collection>/<item> [--name "Display Name"]');
  }

  const pathArg = args[0];
  if (!pathArg) {
    throw new SaveSyntaxError('Usage: save <collection>/<item> [--name "Display Name"]');
  }

  // Check for slash
  const slashIndex = pathArg.indexOf('/');
  if (slashIndex === -1) {
    throw new SaveSyntaxError(`Usage: save <collection>/<item>. Use 'save ${pathArg}/<item>' format.`);
  }

  const collectionId = pathArg.slice(0, slashIndex);
  const itemId = pathArg.slice(slashIndex + 1);

  if (!collectionId) {
    throw new SaveSyntaxError('Usage: save <collection>/<item>. Collection ID cannot be empty.');
  }

  if (!itemId) {
    throw new SaveSyntaxError(
      `Usage: save <collection>/<item>. Item ID cannot be empty. Use: save ${collectionId}/<item>`,
    );
  }

  // Validate IDs
  validateId(collectionId, 'collection');
  validateId(itemId, 'item');

  // Parse optional flags
  let name: string | undefined;
  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--name' || arg === '-n') {
      i++;
      name = args[i];
      if (!name) {
        throw new SaveSyntaxError('Missing value for --name flag');
      }
      i++;
      continue;
    }
    // Unknown flag
    if (arg?.startsWith('-')) {
      throw new SaveSyntaxError(`Unknown flag: ${arg}`);
    }
    i++;
  }

  return { collectionId, itemId, name };
}

/**
 * Extract path and query from a URL
 */
function extractPathAndQuery(url: string): { path: string; query: string[] } {
  // Try to parse as URL
  try {
    const parsed = new URL(url);
    const query: string[] = [];
    parsed.searchParams.forEach((value, key) => {
      query.push(`${key}=${value}`);
    });
    return { path: parsed.pathname, query };
  } catch {
    // Not a full URL, treat as path
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) {
      return { path: url, query: [] };
    }
    const path = url.slice(0, queryIndex);
    const queryString = url.slice(queryIndex + 1);
    const query = queryString.split('&').filter((p) => p.includes('='));
    return { path, query };
  }
}

/**
 * Convert ParsedRequest to SavedRequest
 * @param request - The parsed request from execution
 * @returns SavedRequest suitable for collections.yaml
 */
export function parsedRequestToSavedRequest(request: ParsedRequest): SavedRequest {
  const { path, query: urlQuery } = extractPathAndQuery(request.url);

  // Merge query from URL and explicit query params
  const allQuery = [...urlQuery, ...request.query];
  const uniqueQuery = [...new Set(allQuery)];

  const saved: SavedRequest = {
    method: request.method,
    path,
  };

  if (request.headers.length > 0) {
    saved.headers = request.headers;
  }

  if (request.body) {
    saved.body = request.body;
  }

  if (uniqueQuery.length > 0) {
    saved.query = uniqueQuery;
  }

  return saved;
}

/**
 * Load existing collections config or create empty one
 */
async function loadOrCreateConfig(workspacePath: string): Promise<CollectionConfig> {
  const filePath = join(workspacePath, COLLECTIONS_FILE_NAME);

  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseYaml(content);

    // Handle empty file
    if (parsed === null || parsed === undefined) {
      return { version: 1, collections: [] };
    }

    const result = safeParseCollectionConfig(parsed);
    if (!result.success) {
      throw new CollectionParseError(`Invalid collections.yaml: ${result.issues[0]?.message}`);
    }

    return result.output as CollectionConfig;
  } catch (error) {
    // File doesn't exist - return empty config
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, collections: [] };
    }
    // YAML parse error
    if (error instanceof YAMLParseError) {
      throw new CollectionParseError(error.message);
    }
    throw error;
  }
}

/**
 * Save collections config to file
 */
async function writeConfig(workspacePath: string, config: CollectionConfig): Promise<void> {
  const filePath = join(workspacePath, COLLECTIONS_FILE_NAME);

  try {
    const yaml = stringifyYaml(config, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(filePath, yaml, 'utf-8');
  } catch (error) {
    throw new CollectionWriteError(`Failed to write collections.yaml: ${(error as Error).message}`, error as Error);
  }
}

/**
 * Save result indicating what action was taken
 */
export interface SaveResult {
  action: 'created' | 'updated';
  collectionId: string;
  itemId: string;
  collectionCreated: boolean;
}

/**
 * Save a request to collections
 * @param workspacePath - Path to .unireq directory
 * @param collectionId - Target collection ID
 * @param itemId - Target item ID
 * @param request - Request to save
 * @param name - Optional display name
 * @returns Save result with action taken
 */
export async function saveToCollections(
  workspacePath: string,
  collectionId: string,
  itemId: string,
  request: ParsedRequest,
  name?: string,
): Promise<SaveResult> {
  // Load existing config
  const config = await loadOrCreateConfig(workspacePath);

  // Find or create collection
  let collection = config.collections.find((c) => c.id === collectionId);
  let collectionCreated = false;

  if (!collection) {
    collection = {
      id: collectionId,
      name: collectionId, // Use ID as name by default
      items: [],
    };
    config.collections.push(collection);
    collectionCreated = true;
  }

  // Ensure items array exists
  if (!collection.items) {
    collection.items = [];
  }

  // Convert request
  const savedRequest = parsedRequestToSavedRequest(request);

  // Find existing item
  const existingIndex = collection.items.findIndex((item) => item.id === itemId);
  const itemName = name || itemId;

  const newItem: CollectionItem = {
    id: itemId,
    name: itemName,
    request: savedRequest,
  };

  let action: 'created' | 'updated';

  if (existingIndex >= 0) {
    // Update existing item
    collection.items[existingIndex] = newItem;
    action = 'updated';
  } else {
    // Add new item
    collection.items.push(newItem);
    action = 'created';
  }

  // Write back to file
  await writeConfig(workspacePath, config);

  return {
    action,
    collectionId,
    itemId,
    collectionCreated,
  };
}
