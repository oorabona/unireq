import { describe, expect, it, vi } from 'vitest';
import type { Collection, CollectionItem } from '../../types.js';
import type { ConflictInfo, ConflictResolution } from '../merge.js';
import { detectConflicts, mergeCollections, mergeMultipleCollections } from '../merge.js';

/**
 * Create a minimal collection item for testing
 */
function createItem(id: string, name?: string): CollectionItem {
  return {
    id,
    name: name || id,
    request: {
      method: 'GET',
      path: `/${id}`,
    },
  };
}

/**
 * Create a minimal collection for testing
 */
function createCollection(id: string, items: CollectionItem[]): Collection {
  return {
    id,
    name: id,
    items,
  };
}

describe('mergeCollections', () => {
  describe('no conflicts', () => {
    it('should add all items when no conflicts exist', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1'), createItem('item-2')]);
      const imported = [createItem('item-3'), createItem('item-4')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'replace' });

      // Assert
      expect(result.collection.items).toHaveLength(4);
      expect(result.added).toBe(2);
      expect(result.replaced).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.renamed).toBe(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should preserve existing items when adding new ones', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1', 'First Item')]);
      const imported = [createItem('item-2', 'Second Item')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'replace' });

      // Assert
      expect(result.collection.items[0]!.name).toBe('First Item');
      expect(result.collection.items[1]!.name).toBe('Second Item');
    });
  });

  describe('replace strategy', () => {
    it('should replace conflicting items', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1', 'Old Name')]);
      const imported = [createItem('item-1', 'New Name')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'replace' });

      // Assert
      expect(result.collection.items).toHaveLength(1);
      expect(result.collection.items[0]!.name).toBe('New Name');
      expect(result.replaced).toBe(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]!.resolution).toBe('use-new');
    });

    it('should handle multiple replacements', async () => {
      // Arrange
      const existing = createCollection('test', [
        createItem('item-1', 'Old 1'),
        createItem('item-2', 'Old 2'),
        createItem('item-3', 'Old 3'),
      ]);
      const imported = [createItem('item-1', 'New 1'), createItem('item-3', 'New 3')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'replace' });

      // Assert
      expect(result.collection.items).toHaveLength(3);
      expect(result.replaced).toBe(2);
      expect(result.collection.items.find((i) => i.id === 'item-1')?.name).toBe('New 1');
      expect(result.collection.items.find((i) => i.id === 'item-2')?.name).toBe('Old 2');
      expect(result.collection.items.find((i) => i.id === 'item-3')?.name).toBe('New 3');
    });
  });

  describe('skip strategy', () => {
    it('should skip conflicting items and keep existing', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1', 'Existing')]);
      const imported = [createItem('item-1', 'Imported')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'skip' });

      // Assert
      expect(result.collection.items).toHaveLength(1);
      expect(result.collection.items[0]!.name).toBe('Existing');
      expect(result.skipped).toBe(1);
      expect(result.conflicts[0]!.resolution).toBe('keep-existing');
    });

    it('should add non-conflicting items while skipping conflicts', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1', 'Existing')]);
      const imported = [createItem('item-1', 'Conflict'), createItem('item-2', 'New')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'skip' });

      // Assert
      expect(result.collection.items).toHaveLength(2);
      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe('rename strategy', () => {
    it('should rename conflicting items with suffix', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1', 'Existing')]);
      const imported = [createItem('item-1', 'Imported')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'rename' });

      // Assert
      expect(result.collection.items).toHaveLength(2);
      expect(result.renamed).toBe(1);
      expect(result.conflicts[0]!.resolution).toBe('rename-new');
      expect(result.conflicts[0]!.newId).toBe('item-1-imported');
    });

    it('should use custom rename suffix', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1')]);
      const imported = [createItem('item-1')];

      // Act
      const result = await mergeCollections(existing, imported, {
        strategy: 'rename',
        renameSuffix: '-new',
      });

      // Assert
      expect(result.conflicts[0]!.newId).toBe('item-1-new');
    });

    it('should increment suffix when renamed ID also exists', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1'), createItem('item-1-imported')]);
      const imported = [createItem('item-1')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'rename' });

      // Assert
      expect(result.conflicts[0]!.newId).toBe('item-1-imported-2');
    });

    it('should handle multiple renames', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1')]);
      const imported = [createItem('item-1', 'First'), createItem('item-1', 'Second')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'rename' });

      // Assert
      expect(result.collection.items).toHaveLength(3);
      expect(result.renamed).toBe(2);
      expect(result.conflicts[0]!.newId).toBe('item-1-imported');
      expect(result.conflicts[1]!.newId).toBe('item-1-imported-2');
    });
  });

  describe('prompt strategy', () => {
    it('should call onConflict callback for each conflict', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1'), createItem('item-2')]);
      const imported = [createItem('item-1'), createItem('item-2')];
      const onConflict = vi.fn().mockResolvedValue('use-new' as ConflictResolution);

      // Act
      await mergeCollections(existing, imported, {
        strategy: 'prompt',
        onConflict,
      });

      // Assert
      expect(onConflict).toHaveBeenCalledTimes(2);
    });

    it('should provide conflict info to callback', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1', 'Old Name')]);
      const imported = [createItem('item-1', 'New Name')];
      let receivedConflict: ConflictInfo | undefined;
      const onConflict = vi.fn().mockImplementation((conflict: ConflictInfo) => {
        receivedConflict = conflict;
        return Promise.resolve('use-new' as ConflictResolution);
      });

      // Act
      await mergeCollections(existing, imported, {
        strategy: 'prompt',
        onConflict,
      });

      // Assert
      expect(receivedConflict).toBeDefined();
      expect(receivedConflict?.id).toBe('item-1');
      expect(receivedConflict?.existingName).toBe('Old Name');
      expect(receivedConflict?.newName).toBe('New Name');
    });

    it('should respect different resolutions from callback', async () => {
      // Arrange
      const existing = createCollection('test', [
        createItem('item-1', 'Old 1'),
        createItem('item-2', 'Old 2'),
        createItem('item-3', 'Old 3'),
      ]);
      const imported = [createItem('item-1', 'New 1'), createItem('item-2', 'New 2'), createItem('item-3', 'New 3')];
      let callCount = 0;
      const onConflict = vi.fn().mockImplementation(() => {
        callCount++;
        const resolutions: ConflictResolution[] = ['use-new', 'keep-existing', 'rename-new'];
        return Promise.resolve(resolutions[callCount - 1]);
      });

      // Act
      const result = await mergeCollections(existing, imported, {
        strategy: 'prompt',
        onConflict,
      });

      // Assert
      expect(result.replaced).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.renamed).toBe(1);
    });

    it('should default to skip when no callback provided', async () => {
      // Arrange
      const existing = createCollection('test', [createItem('item-1', 'Existing')]);
      const imported = [createItem('item-1', 'Imported')];

      // Act
      const result = await mergeCollections(existing, imported, {
        strategy: 'prompt',
        // No onConflict callback
      });

      // Assert
      expect(result.skipped).toBe(1);
      expect(result.collection.items[0]!.name).toBe('Existing');
    });
  });

  describe('collection metadata', () => {
    it('should preserve collection metadata', async () => {
      // Arrange
      const existing: Collection = {
        id: 'test-collection',
        name: 'Test Collection',
        description: 'A test collection',
        items: [],
      };
      const imported = [createItem('item-1')];

      // Act
      const result = await mergeCollections(existing, imported, { strategy: 'replace' });

      // Assert
      expect(result.collection.id).toBe('test-collection');
      expect(result.collection.name).toBe('Test Collection');
      expect(result.collection.description).toBe('A test collection');
    });
  });
});

describe('detectConflicts', () => {
  it('should detect conflicting items', () => {
    // Arrange
    const existing = createCollection('test', [createItem('item-1', 'Old'), createItem('item-2', 'Keep')]);
    const imported = [createItem('item-1', 'New'), createItem('item-3', 'Add')];

    // Act
    const conflicts = detectConflicts(existing, imported);

    // Assert
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.id).toBe('item-1');
    expect(conflicts[0]!.existingName).toBe('Old');
    expect(conflicts[0]!.newName).toBe('New');
  });

  it('should return empty array when no conflicts', () => {
    // Arrange
    const existing = createCollection('test', [createItem('item-1')]);
    const imported = [createItem('item-2')];

    // Act
    const conflicts = detectConflicts(existing, imported);

    // Assert
    expect(conflicts).toHaveLength(0);
  });

  it('should detect all conflicts', () => {
    // Arrange
    const existing = createCollection('test', [createItem('a'), createItem('b'), createItem('c')]);
    const imported = [createItem('a'), createItem('b'), createItem('c')];

    // Act
    const conflicts = detectConflicts(existing, imported);

    // Assert
    expect(conflicts).toHaveLength(3);
  });
});

describe('mergeMultipleCollections', () => {
  it('should merge multiple collections', async () => {
    // Arrange
    const collections = [
      createCollection('a', [createItem('item-1')]),
      createCollection('b', [createItem('item-2')]),
      createCollection('c', [createItem('item-3')]),
    ];

    // Act
    const result = await mergeMultipleCollections(collections, 'Merged', { strategy: 'replace' });

    // Assert
    expect(result.collection.items).toHaveLength(3);
    expect(result.collection.name).toBe('Merged');
    expect(result.added).toBe(3);
  });

  it('should handle empty collections array', async () => {
    // Act
    const result = await mergeMultipleCollections([], 'Empty', { strategy: 'replace' });

    // Assert
    expect(result.collection.items).toHaveLength(0);
    expect(result.collection.name).toBe('Empty');
    expect(result.added).toBe(0);
  });

  it('should handle conflicts across collections', async () => {
    // Arrange
    const collections = [
      createCollection('a', [createItem('shared', 'From A')]),
      createCollection('b', [createItem('shared', 'From B')]),
    ];

    // Act
    const result = await mergeMultipleCollections(collections, 'Merged', { strategy: 'rename' });

    // Assert
    expect(result.collection.items).toHaveLength(2);
    expect(result.renamed).toBe(1);
  });

  it('should create proper collection ID from name', async () => {
    // Act
    const result = await mergeMultipleCollections([], 'My Test Collection', { strategy: 'replace' });

    // Assert
    expect(result.collection.id).toBe('my-test-collection');
  });
});
