/**
 * Merge Strategy Engine
 * Handles conflicts when importing collections into existing ones
 */

import type { Collection, CollectionItem } from '../types.js';

/**
 * Merge strategy options
 */
export type MergeStrategy =
  /** Replace existing items with imported ones (no prompts) */
  | 'replace'
  /** Rename conflicting items with suffix (no prompts) */
  | 'rename'
  /** Skip conflicting items (keep existing) */
  | 'skip'
  /** Use interactive prompts for each conflict */
  | 'prompt';

/**
 * Result of a conflict resolution
 */
export type ConflictResolution =
  /** Use the imported (new) item */
  | 'use-new'
  /** Keep the existing item */
  | 'keep-existing'
  /** Rename the new item */
  | 'rename-new';

/**
 * Information about a detected conflict
 */
export interface ConflictInfo {
  /** ID of the conflicting item */
  id: string;
  /** Name of the existing item */
  existingName: string;
  /** Name of the new item */
  newName: string;
  /** Path/location in the collection */
  path?: string;
}

/**
 * Options for the merge operation
 */
export interface MergeOptions {
  /** Strategy for handling conflicts */
  strategy: MergeStrategy;
  /** Callback for interactive conflict resolution */
  onConflict?: (conflict: ConflictInfo) => Promise<ConflictResolution>;
  /** Prefix/suffix for renamed items (default: '-imported') */
  renameSuffix?: string;
}

/**
 * Result of a merge operation
 */
export interface MergeResult {
  /** The merged collection */
  collection: Collection;
  /** Number of items added */
  added: number;
  /** Number of items replaced */
  replaced: number;
  /** Number of items skipped */
  skipped: number;
  /** Number of items renamed */
  renamed: number;
  /** Details of conflicts that were resolved */
  conflicts: Array<{
    id: string;
    resolution: ConflictResolution;
    newId?: string;
  }>;
}

/**
 * Merge imported items into an existing collection
 *
 * @param existing - The existing collection
 * @param imported - Items to import
 * @param options - Merge options
 * @returns Merged collection with statistics
 */
export async function mergeCollections(
  existing: Collection,
  imported: CollectionItem[],
  options: MergeOptions,
): Promise<MergeResult> {
  const { strategy, onConflict, renameSuffix = '-imported' } = options;

  // Build index of existing items by ID
  const existingIndex = new Map<string, CollectionItem>();
  for (const item of existing.items) {
    existingIndex.set(item.id, item);
  }

  const result: MergeResult = {
    collection: {
      ...existing,
      items: [...existing.items],
    },
    added: 0,
    replaced: 0,
    skipped: 0,
    renamed: 0,
    conflicts: [],
  };

  // Track all IDs (existing + new) to avoid collisions when renaming
  const allIds = new Set(existingIndex.keys());

  for (const newItem of imported) {
    const existingItem = existingIndex.get(newItem.id);

    if (!existingItem) {
      // No conflict - just add
      result.collection.items.push(newItem);
      allIds.add(newItem.id);
      result.added++;
      continue;
    }

    // Conflict detected - resolve based on strategy
    const conflict: ConflictInfo = {
      id: newItem.id,
      existingName: existingItem.name,
      newName: newItem.name,
    };

    let resolution: ConflictResolution;

    switch (strategy) {
      case 'replace':
        resolution = 'use-new';
        break;
      case 'skip':
        resolution = 'keep-existing';
        break;
      case 'rename':
        resolution = 'rename-new';
        break;
      case 'prompt':
        if (!onConflict) {
          // Default to skip if no callback provided
          resolution = 'keep-existing';
        } else {
          resolution = await onConflict(conflict);
        }
        break;
    }

    // Apply the resolution
    switch (resolution) {
      case 'use-new': {
        // Replace existing item
        const index = result.collection.items.findIndex((i) => i.id === newItem.id);
        if (index !== -1) {
          result.collection.items[index] = newItem;
        }
        result.replaced++;
        result.conflicts.push({ id: newItem.id, resolution });
        break;
      }
      case 'keep-existing':
        result.skipped++;
        result.conflicts.push({ id: newItem.id, resolution });
        break;
      case 'rename-new': {
        // Generate unique ID
        const newId = generateUniqueId(newItem.id, allIds, renameSuffix);
        const renamedItem: CollectionItem = {
          ...newItem,
          id: newId,
        };
        result.collection.items.push(renamedItem);
        allIds.add(newId);
        result.renamed++;
        result.conflicts.push({ id: newItem.id, resolution, newId });
        break;
      }
    }
  }

  return result;
}

/**
 * Generate a unique ID by appending suffix
 */
function generateUniqueId(baseId: string, existingIds: Set<string>, suffix: string): string {
  let candidate = `${baseId}${suffix}`;
  let counter = 1;

  while (existingIds.has(candidate)) {
    counter++;
    candidate = `${baseId}${suffix}-${counter}`;
  }

  return candidate;
}

/**
 * Check for conflicts between existing collection and imported items
 *
 * @param existing - The existing collection
 * @param imported - Items to check
 * @returns List of conflicts
 */
export function detectConflicts(existing: Collection, imported: CollectionItem[]): ConflictInfo[] {
  const existingIndex = new Map<string, CollectionItem>();
  for (const item of existing.items) {
    existingIndex.set(item.id, item);
  }

  const conflicts: ConflictInfo[] = [];

  for (const newItem of imported) {
    const existingItem = existingIndex.get(newItem.id);
    if (existingItem) {
      conflicts.push({
        id: newItem.id,
        existingName: existingItem.name,
        newName: newItem.name,
      });
    }
  }

  return conflicts;
}

/**
 * Merge multiple collections into one
 *
 * @param collections - Collections to merge
 * @param targetName - Name for the merged collection
 * @param options - Merge options
 * @returns Merged collection with statistics
 */
export async function mergeMultipleCollections(
  collections: Collection[],
  targetName: string,
  options: MergeOptions,
): Promise<MergeResult> {
  if (collections.length === 0) {
    return {
      collection: {
        id: targetName.toLowerCase().replace(/\s+/g, '-'),
        name: targetName,
        items: [],
      },
      added: 0,
      replaced: 0,
      skipped: 0,
      renamed: 0,
      conflicts: [],
    };
  }

  // Start with first collection
  const firstCollection = collections[0]!;
  let result: MergeResult = {
    collection: {
      id: targetName.toLowerCase().replace(/\s+/g, '-'),
      name: targetName,
      description: firstCollection.description,
      items: [...firstCollection.items],
    },
    added: firstCollection.items.length,
    replaced: 0,
    skipped: 0,
    renamed: 0,
    conflicts: [],
  };

  // Merge remaining collections
  for (let i = 1; i < collections.length; i++) {
    const currentCollection = collections[i]!;
    const mergeResult = await mergeCollections(result.collection, currentCollection.items, options);

    result = {
      collection: mergeResult.collection,
      added: result.added + mergeResult.added,
      replaced: result.replaced + mergeResult.replaced,
      skipped: result.skipped + mergeResult.skipped,
      renamed: result.renamed + mergeResult.renamed,
      conflicts: [...result.conflicts, ...mergeResult.conflicts],
    };
  }

  return result;
}
