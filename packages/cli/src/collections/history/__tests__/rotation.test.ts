/**
 * Tests for history file rotation
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countEntries, rotateHistory, rotateIfNeeded } from '../rotation.js';

describe('rotation', () => {
  let testDir: string;
  let historyPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `rotation-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    historyPath = join(testDir, 'history.ndjson');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('countEntries', () => {
    it('should return 0 for non-existent file', async () => {
      // Arrange
      const nonExistentPath = join(testDir, 'nonexistent.ndjson');

      // Act
      const count = await countEntries(nonExistentPath);

      // Assert
      expect(count).toBe(0);
    });

    it('should return 0 for empty file', async () => {
      // Arrange
      await writeFile(historyPath, '');

      // Act
      const count = await countEntries(historyPath);

      // Assert
      expect(count).toBe(0);
    });

    it('should count single entry', async () => {
      // Arrange
      await writeFile(historyPath, '{"type":"cmd"}\n');

      // Act
      const count = await countEntries(historyPath);

      // Assert
      expect(count).toBe(1);
    });

    it('should count multiple entries', async () => {
      // Arrange
      const entries = Array.from({ length: 50 }, (_, i) => JSON.stringify({ id: i })).join('\n');
      await writeFile(historyPath, `${entries}\n`);

      // Act
      const count = await countEntries(historyPath);

      // Assert
      expect(count).toBe(50);
    });

    it('should handle entries without trailing newline', async () => {
      // Arrange
      await writeFile(historyPath, '{"a":1}\n{"b":2}\n{"c":3}');

      // Act
      const count = await countEntries(historyPath);

      // Assert
      expect(count).toBe(3);
    });
  });

  describe('rotateHistory', () => {
    it('should keep all entries if below keepCount', async () => {
      // Arrange
      const entries = `${Array.from({ length: 5 }, (_, i) => JSON.stringify({ id: i })).join('\n')}\n`;
      await writeFile(historyPath, entries);

      // Act
      await rotateHistory(historyPath, 10);

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(5);
    });

    it('should keep only most recent entries', async () => {
      // Arrange
      const entries = `${Array.from({ length: 10 }, (_, i) => JSON.stringify({ id: i })).join('\n')}\n`;
      await writeFile(historyPath, entries);

      // Act
      await rotateHistory(historyPath, 5);

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(5);

      // Should keep entries 5-9 (last 5)
      const firstEntry = JSON.parse(lines[0] ?? '{}');
      const lastEntry = JSON.parse(lines[4] ?? '{}');
      expect(firstEntry.id).toBe(5);
      expect(lastEntry.id).toBe(9);
    });

    it('should preserve entry content during rotation', async () => {
      // Arrange
      const originalEntries = [
        { type: 'cmd', command: 'cd', args: ['/users'] },
        { type: 'http', method: 'GET', url: 'https://api.example.com' },
        { type: 'cmd', command: 'ls', args: [] },
      ];
      const content = `${originalEntries.map((e) => JSON.stringify(e)).join('\n')}\n`;
      await writeFile(historyPath, content);

      // Act
      await rotateHistory(historyPath, 2);

      // Assert
      const result = await readFile(historyPath, 'utf8');
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(2);

      const kept1 = JSON.parse(lines[0] ?? '{}');
      const kept2 = JSON.parse(lines[1] ?? '{}');
      expect(kept1).toEqual(originalEntries[1]);
      expect(kept2).toEqual(originalEntries[2]);
    });

    it('should handle unicode content', async () => {
      // Arrange
      const entries = [{ message: '日本語テスト' }, { message: 'Привет мир' }, { message: '🎉 Emoji test 🚀' }];
      const content = `${entries.map((e) => JSON.stringify(e)).join('\n')}\n`;
      await writeFile(historyPath, content);

      // Act
      await rotateHistory(historyPath, 2);

      // Assert
      const result = await readFile(historyPath, 'utf8');
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(2);

      const kept1 = JSON.parse(lines[0] ?? '{}');
      const kept2 = JSON.parse(lines[1] ?? '{}');
      expect(kept1.message).toBe('Привет мир');
      expect(kept2.message).toBe('🎉 Emoji test 🚀');
    });

    it('should skip empty lines during rotation', async () => {
      // Arrange
      const content = '{"id":1}\n\n{"id":2}\n\n{"id":3}\n';
      await writeFile(historyPath, content);

      // Act
      await rotateHistory(historyPath, 2);

      // Assert
      const result = await readFile(historyPath, 'utf8');
      const lines = result.trim().split('\n');
      // Should keep last 2 non-empty entries
      expect(lines.filter((l) => l.trim())).toHaveLength(2);
    });
  });

  describe('rotateIfNeeded', () => {
    it('should not rotate when below max entries', async () => {
      // Arrange
      const entries = `${Array.from({ length: 50 }, (_, i) => JSON.stringify({ id: i })).join('\n')}\n`;
      await writeFile(historyPath, entries);

      // Act
      const rotated = await rotateIfNeeded(historyPath, 100, 0.8);

      // Assert
      expect(rotated).toBe(false);

      const count = await countEntries(historyPath);
      expect(count).toBe(50);
    });

    it('should rotate when above max entries', async () => {
      // Arrange
      const entries = `${Array.from({ length: 100 }, (_, i) => JSON.stringify({ id: i })).join('\n')}\n`;
      await writeFile(historyPath, entries);

      // Act
      const rotated = await rotateIfNeeded(historyPath, 50, 0.8);

      // Assert
      expect(rotated).toBe(true);

      const count = await countEntries(historyPath);
      expect(count).toBe(40); // 50 * 0.8 = 40
    });

    it('should keep correct ratio of entries', async () => {
      // Arrange
      const entries = `${Array.from({ length: 200 }, (_, i) => JSON.stringify({ id: i })).join('\n')}\n`;
      await writeFile(historyPath, entries);

      // Act
      await rotateIfNeeded(historyPath, 100, 0.5);

      // Assert
      const count = await countEntries(historyPath);
      expect(count).toBe(50); // 100 * 0.5 = 50
    });

    it('should handle non-existent file', async () => {
      // Arrange
      const nonExistentPath = join(testDir, 'nonexistent.ndjson');

      // Act
      const rotated = await rotateIfNeeded(nonExistentPath, 100, 0.8);

      // Assert
      expect(rotated).toBe(false);
    });

    it('should handle exactly at max entries', async () => {
      // Arrange
      const entries = `${Array.from({ length: 100 }, (_, i) => JSON.stringify({ id: i })).join('\n')}\n`;
      await writeFile(historyPath, entries);

      // Act
      const rotated = await rotateIfNeeded(historyPath, 100, 0.8);

      // Assert
      expect(rotated).toBe(false); // Should not rotate at exactly max

      const count = await countEntries(historyPath);
      expect(count).toBe(100);
    });
  });
});
