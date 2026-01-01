/**
 * Collection configuration types
 */

import type { HttpMethod } from '../types.js';

/**
 * HTTP methods supported in collections (matches core types)
 */
export type CollectionHttpMethod = HttpMethod;

/**
 * Assertion operators for JSON path assertions
 */
export type AssertOperator = 'equals' | 'contains' | 'exists' | 'matches';

/**
 * JSON path assertion configuration
 */
export interface JsonAssertion {
  /** JSONPath expression (e.g., "$.data.id") */
  path: string;
  /** Assertion operator */
  op: AssertOperator;
  /** Expected value for equals/contains operators */
  value?: unknown;
  /** Regex pattern for matches operator */
  pattern?: string;
}

/**
 * Assertion configuration for a collection item
 * Parsed as-is, evaluated by assertion engine (Task 5.5)
 */
export interface AssertConfig {
  /** Expected HTTP status code */
  status?: number;
  /** Expected headers (key-value pairs) */
  headers?: Record<string, string>;
  /** JSON path assertions */
  json?: JsonAssertion[];
  /** Response body should contain this string */
  contains?: string;
}

/**
 * Variable extraction configuration
 * Parsed as-is, evaluated by extractor (Task 5.4)
 */
export interface ExtractConfig {
  /** Variables to extract: { varName: "$.json.path" } */
  vars?: Record<string, string>;
}

/**
 * Saved request structure within a collection item
 */
export interface SavedRequest {
  /** HTTP method */
  method: CollectionHttpMethod;
  /** Request path (relative to baseUrl) */
  path: string;
  /** Request headers as "Key: Value" strings */
  headers?: string[];
  /** Request body (string or will be JSON stringified) */
  body?: string;
  /** Query parameters as "key=value" strings */
  query?: string[];
}

/**
 * A single item within a collection (a saved request with metadata)
 */
export interface CollectionItem {
  /** Unique identifier within the collection */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** The HTTP request to execute */
  request: SavedRequest;
  /** Assertions to run after request (optional) */
  assert?: AssertConfig;
  /** Variables to extract from response (optional) */
  extract?: ExtractConfig;
  /** Tags for filtering/grouping */
  tags?: string[];
}

/**
 * A collection of related requests
 */
export interface Collection {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Items (saved requests) in this collection */
  items: CollectionItem[];
}

/**
 * Root configuration loaded from collections.yaml
 */
export interface CollectionConfig {
  /** Schema version (must be 1) */
  version: number;
  /** List of collections */
  collections: Collection[];
}

/**
 * Result of loading collections
 */
export interface LoadCollectionsResult {
  /** Whether loading was successful */
  success: boolean;
  /** Loaded configuration (if success) */
  config?: CollectionConfig;
  /** Error message (if failure) */
  error?: string;
}
