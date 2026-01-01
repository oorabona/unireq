/**
 * Collection runner - execute saved requests from collections
 */

import type { ParsedRequest } from '../types.js';
import { interpolate } from '../workspace/variables/resolver.js';
import type { InterpolationContext } from '../workspace/variables/types.js';
import type { CollectionConfig, CollectionItem, SavedRequest } from './types.js';

/**
 * Result of parsing run command arguments
 */
export interface RunArgs {
  collectionId: string;
  itemId: string;
}

/**
 * Error thrown when run command syntax is invalid
 */
export class RunSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunSyntaxError';
    Object.setPrototypeOf(this, RunSyntaxError.prototype);
  }
}

/**
 * Error thrown when collection is not found
 */
export class CollectionNotFoundError extends Error {
  readonly collectionId: string;
  readonly availableCollections: string[];

  constructor(collectionId: string, availableCollections: string[] = []) {
    const message =
      availableCollections.length > 0
        ? `Collection not found: ${collectionId}. Available: ${availableCollections.join(', ')}`
        : `Collection not found: ${collectionId}. No collections defined.`;
    super(message);
    this.name = 'CollectionNotFoundError';
    this.collectionId = collectionId;
    this.availableCollections = availableCollections;
    Object.setPrototypeOf(this, CollectionNotFoundError.prototype);
  }
}

/**
 * Error thrown when item is not found in collection
 */
export class ItemNotFoundError extends Error {
  readonly itemId: string;
  readonly collectionId: string;
  readonly availableItems: string[];

  constructor(itemId: string, collectionId: string, availableItems: string[] = []) {
    const message =
      availableItems.length > 0
        ? `Item not found: ${itemId} in collection: ${collectionId}. Available: ${availableItems.join(', ')}`
        : `Item not found: ${itemId} in collection: ${collectionId}. Collection is empty.`;
    super(message);
    this.name = 'ItemNotFoundError';
    this.itemId = itemId;
    this.collectionId = collectionId;
    this.availableItems = availableItems;
    Object.setPrototypeOf(this, ItemNotFoundError.prototype);
  }
}

/**
 * Parse run command arguments
 *
 * Expected format: "collection/item"
 *
 * @param args - Command arguments
 * @returns Parsed collection and item IDs
 * @throws RunSyntaxError if format is invalid
 */
export function parseRunArgs(args: string[]): RunArgs {
  if (args.length === 0) {
    throw new RunSyntaxError('Usage: run <collection>/<item>');
  }

  const path = args[0];
  if (!path) {
    throw new RunSyntaxError('Usage: run <collection>/<item>');
  }

  const slashIndex = path.indexOf('/');
  if (slashIndex === -1) {
    throw new RunSyntaxError(`Usage: run <collection>/<item>. Got: "${path}". Use format: run ${path}/<item>`);
  }

  const collectionId = path.slice(0, slashIndex).trim();
  const itemId = path.slice(slashIndex + 1).trim();

  if (!collectionId) {
    throw new RunSyntaxError('Usage: run <collection>/<item>. Collection ID cannot be empty.');
  }

  if (!itemId) {
    throw new RunSyntaxError(
      `Usage: run <collection>/<item>. Item ID cannot be empty. Use: run ${collectionId}/<item>`,
    );
  }

  return { collectionId, itemId };
}

/**
 * Find a collection item by collection ID and item ID
 *
 * @param config - Loaded collection configuration
 * @param collectionId - Collection ID to find
 * @param itemId - Item ID to find within the collection
 * @returns The found collection item
 * @throws CollectionNotFoundError if collection doesn't exist
 * @throws ItemNotFoundError if item doesn't exist in collection
 */
export function findCollectionItem(config: CollectionConfig, collectionId: string, itemId: string): CollectionItem {
  const availableCollections = config.collections.map((c) => c.id);

  const collection = config.collections.find((c) => c.id === collectionId);
  if (!collection) {
    throw new CollectionNotFoundError(collectionId, availableCollections);
  }

  const availableItems = collection.items.map((i) => i.id);
  const item = collection.items.find((i) => i.id === itemId);
  if (!item) {
    throw new ItemNotFoundError(itemId, collectionId, availableItems);
  }

  return item;
}

/**
 * Options for transforming a saved request
 */
export interface TransformOptions {
  /** Base URL to prepend to path */
  baseUrl?: string;
  /** Variables for interpolation (merged workspace vars + extracted vars) */
  vars?: Record<string, string>;
}

/**
 * Transform a SavedRequest into a ParsedRequest for the executor
 *
 * Interpolates ${var:name} placeholders in URL, headers, query params, and body.
 *
 * @param saved - Saved request from collection
 * @param options - Transform options including baseUrl and vars for interpolation
 * @returns ParsedRequest ready for executor
 */
export function savedRequestToParsedRequest(saved: SavedRequest, options: TransformOptions = {}): ParsedRequest {
  const { baseUrl, vars = {} } = options;
  const context: InterpolationContext = { vars };

  // Helper to interpolate a string if vars are provided
  const interpolateValue = (value: string): string => {
    if (Object.keys(vars).length === 0) {
      return value;
    }
    try {
      return interpolate(value, context);
    } catch {
      // If interpolation fails (missing var), return original
      return value;
    }
  };

  // Build full URL from path and optional baseUrl
  let url: string;
  const interpolatedPath = interpolateValue(saved.path);
  if (baseUrl) {
    // Ensure proper URL joining
    const interpolatedBase = interpolateValue(baseUrl);
    const base = interpolatedBase.endsWith('/') ? interpolatedBase.slice(0, -1) : interpolatedBase;
    const path = interpolatedPath.startsWith('/') ? interpolatedPath : `/${interpolatedPath}`;
    url = `${base}${path}`;
  } else {
    // Path might be relative or absolute URL
    url = interpolatedPath;
  }

  // Interpolate headers
  const headers = (saved.headers ?? []).map(interpolateValue);

  // Interpolate query params
  const query = (saved.query ?? []).map(interpolateValue);

  // Interpolate body if present
  const body = saved.body ? interpolateValue(saved.body) : undefined;

  return {
    method: saved.method,
    url,
    headers,
    query,
    body,
  };
}

/**
 * Get available collection IDs from config
 */
export function getAvailableCollections(config: CollectionConfig): string[] {
  return config.collections.map((c) => c.id);
}

/**
 * Get available item IDs from a collection
 */
export function getAvailableItems(config: CollectionConfig, collectionId: string): string[] {
  const collection = config.collections.find((c) => c.id === collectionId);
  if (!collection) {
    return [];
  }
  return collection.items.map((i) => i.id);
}
