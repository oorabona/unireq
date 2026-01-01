/**
 * Collection loader - loads and validates collections.yaml
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type * as v from 'valibot';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import { CollectionDuplicateIdError, CollectionParseError, CollectionValidationError } from './errors.js';
import { safeParseCollectionConfig } from './schema.js';
import type { CollectionConfig } from './types.js';

/**
 * Collections file name
 */
export const COLLECTIONS_FILE_NAME = 'collections.yaml';

/**
 * Check for duplicate collection IDs
 */
function checkDuplicateCollectionIds(collections: Array<{ id: string }>): void {
  const seen = new Set<string>();
  for (const collection of collections) {
    if (seen.has(collection.id)) {
      throw new CollectionDuplicateIdError(collection.id, 'collection');
    }
    seen.add(collection.id);
  }
}

/**
 * Check for duplicate item IDs within a collection
 */
function checkDuplicateItemIds(items: Array<{ id: string }>, collectionId: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new CollectionDuplicateIdError(item.id, 'item', collectionId);
    }
    seen.add(item.id);
  }
}

/**
 * Format Valibot validation error path
 */
function formatValidationPath(issues: v.BaseIssue<unknown>[]): string {
  if (issues.length === 0) return 'root';

  const issue = issues[0]!;
  if (!issue.path) return 'root';

  return issue.path
    .map((p) => {
      if (typeof p.key === 'number') {
        return `[${p.key}]`;
      }
      return `.${String(p.key)}`;
    })
    .join('')
    .replace(/^\./, '');
}

/**
 * Load and validate collections from a workspace
 *
 * @param workspacePath - Path to the .unireq directory
 * @returns Parsed and validated CollectionConfig
 * @throws CollectionParseError if YAML is invalid
 * @throws CollectionValidationError if schema validation fails
 * @throws CollectionDuplicateIdError if duplicate IDs found
 */
export async function loadCollections(workspacePath: string): Promise<CollectionConfig> {
  const filePath = join(workspacePath, COLLECTIONS_FILE_NAME);

  // Try to read the file
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'ENOENT') {
      // File doesn't exist - return empty config
      return {
        version: 1,
        collections: [],
      };
    }
    throw error;
  }

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (error: unknown) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0]?.line;
      const col = error.linePos?.[0]?.col;
      throw new CollectionParseError(error.message, line, col);
    }
    throw new CollectionParseError(String(error));
  }

  // Handle empty YAML file (null result)
  if (parsed === null || parsed === undefined) {
    return {
      version: 1,
      collections: [],
    };
  }

  // Validate schema
  const result = safeParseCollectionConfig(parsed);
  if (!result.success) {
    const path = formatValidationPath(result.issues);
    const issue = result.issues[0]!;
    throw new CollectionValidationError(issue.message, path, issue.expected?.toString(), String(issue.received));
  }

  const config = result.output;

  // Check for duplicate collection IDs
  checkDuplicateCollectionIds(config.collections);

  // Check for duplicate item IDs within each collection
  for (const collection of config.collections) {
    if (collection.items && collection.items.length > 0) {
      checkDuplicateItemIds(collection.items, collection.id);
    }
  }

  return config as CollectionConfig;
}

/**
 * Check if collections file exists in workspace
 */
export async function collectionsFileExists(workspacePath: string): Promise<boolean> {
  const filePath = join(workspacePath, COLLECTIONS_FILE_NAME);
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}
