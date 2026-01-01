/**
 * Tests for HistoryReader
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HistoryReader } from '../reader.js';
import type { CmdEntry, HttpEntry } from '../types.js';

describe('HistoryReader', () => {
  let testDir: string;
  let historyPath: string;

  beforeEach(async () => {
    // Create temp directory
    testDir = join(tmpdir(), `history-reader-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    historyPath = join(testDir, 'history.ndjson');
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  /**
   * Helper to create test entries
   */
  function createCmdEntry(command: string, args: string[] = [], success = true): CmdEntry {
    return {
      type: 'cmd',
      timestamp: new Date().toISOString(),
      command,
      args,
      success,
    };
  }

  function createHttpEntry(method: string, url: string, status: number | null = 200): HttpEntry {
    return {
      type: 'http',
      timestamp: new Date().toISOString(),
      method,
      url,
      status,
      durationMs: 100,
    };
  }

  async function writeHistory(entries: Array<CmdEntry | HttpEntry>): Promise<void> {
    const lines = entries.map((e) => JSON.stringify(e)).join('\n');
    await writeFile(historyPath, lines + '\n');
  }

  describe('exists', () => {
    it('should return false when history file does not exist', async () => {
      // Arrange
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.exists();

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when history file exists', async () => {
      // Arrange
      await writeFile(historyPath, '');
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.exists();

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('list', () => {
    it('should return empty result when no history file exists', async () => {
      // Arrange
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list();

      // Assert
      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return empty result for empty history file', async () => {
      // Arrange
      await writeFile(historyPath, '');
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list();

      // Assert
      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return entries in reverse order (most recent first)', async () => {
      // Arrange
      const entries = [
        createCmdEntry('cd', ['/users']),
        createCmdEntry('ls'),
        createCmdEntry('get', ['1']),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list();

      // Assert
      expect(result.entries).toHaveLength(3);
      expect(result.entries[0]?.entry.type).toBe('cmd');
      expect((result.entries[0]?.entry as CmdEntry).command).toBe('get');
      expect((result.entries[2]?.entry as CmdEntry).command).toBe('cd');
    });

    it('should return default 20 entries', async () => {
      // Arrange
      const entries = Array.from({ length: 30 }, (_, i) => createCmdEntry(`cmd${i}`));
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list();

      // Assert
      expect(result.entries).toHaveLength(20);
      expect(result.total).toBe(30);
    });

    it('should return specified count of entries', async () => {
      // Arrange
      const entries = Array.from({ length: 30 }, (_, i) => createCmdEntry(`cmd${i}`));
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list(5);

      // Assert
      expect(result.entries).toHaveLength(5);
      expect(result.total).toBe(30);
    });

    it('should cap count at 1000', async () => {
      // Arrange
      await writeFile(historyPath, '');
      const reader = new HistoryReader(historyPath);

      // Act - request unreasonably high count
      const result = await reader.list(9999);

      // Assert - should not crash, just return empty
      expect(result.entries).toHaveLength(0);
    });

    it('should filter by http type', async () => {
      // Arrange
      const entries = [
        createCmdEntry('cd', ['/users']),
        createHttpEntry('GET', 'https://api.example.com/users'),
        createCmdEntry('ls'),
        createHttpEntry('POST', 'https://api.example.com/users'),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list(20, 'http');

      // Assert
      expect(result.entries).toHaveLength(2);
      expect(result.entries.every((e) => e.entry.type === 'http')).toBe(true);
      expect(result.total).toBe(2);
    });

    it('should filter by cmd type', async () => {
      // Arrange
      const entries = [
        createCmdEntry('cd', ['/users']),
        createHttpEntry('GET', 'https://api.example.com/users'),
        createCmdEntry('ls'),
        createHttpEntry('POST', 'https://api.example.com/users'),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list(20, 'cmd');

      // Assert
      expect(result.entries).toHaveLength(2);
      expect(result.entries.every((e) => e.entry.type === 'cmd')).toBe(true);
      expect(result.total).toBe(2);
    });

    it('should skip malformed JSON lines', async () => {
      // Arrange
      const validEntry = createCmdEntry('valid');
      const content = `${JSON.stringify(validEntry)}\n{invalid json}\n${JSON.stringify(createCmdEntry('also-valid'))}\n`;
      await writeFile(historyPath, content);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list();

      // Assert
      expect(result.entries).toHaveLength(2);
    });

    it('should skip entries without required fields', async () => {
      // Arrange
      const validEntry = createCmdEntry('valid');
      const content = `${JSON.stringify(validEntry)}\n{"foo":"bar"}\n${JSON.stringify(createCmdEntry('also-valid'))}\n`;
      await writeFile(historyPath, content);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list();

      // Assert
      expect(result.entries).toHaveLength(2);
    });

    it('should include index in results', async () => {
      // Arrange
      const entries = [
        createCmdEntry('first'),
        createCmdEntry('second'),
        createCmdEntry('third'),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list();

      // Assert
      expect(result.entries[0]?.index).toBe(0);
      expect(result.entries[1]?.index).toBe(1);
      expect(result.entries[2]?.index).toBe(2);
    });
  });

  describe('show', () => {
    it('should return null when no history file exists', async () => {
      // Arrange
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(0);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for negative index', async () => {
      // Arrange
      await writeHistory([createCmdEntry('test')]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(-1);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for index out of range', async () => {
      // Arrange
      await writeHistory([createCmdEntry('test')]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(99);

      // Assert
      expect(result).toBeNull();
    });

    it('should return entry at index 0 (most recent)', async () => {
      // Arrange
      const entries = [
        createCmdEntry('first'),
        createCmdEntry('second'),
        createCmdEntry('third'),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(0);

      // Assert
      expect(result).not.toBeNull();
      expect((result as CmdEntry).command).toBe('third');
    });

    it('should return entry at specific index', async () => {
      // Arrange
      const entries = [
        createCmdEntry('first'),
        createCmdEntry('second'),
        createCmdEntry('third'),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(2);

      // Assert
      expect(result).not.toBeNull();
      expect((result as CmdEntry).command).toBe('first');
    });

    it('should return HTTP entry with full details', async () => {
      // Arrange
      const httpEntry: HttpEntry = {
        type: 'http',
        timestamp: '2026-01-01T12:00:00.000Z',
        method: 'POST',
        url: 'https://api.example.com/users',
        requestHeaders: { 'Content-Type': 'application/json' },
        requestBody: '{"name":"test"}',
        status: 201,
        responseHeaders: { 'Location': '/users/123' },
        responseBody: '{"id":"123"}',
        durationMs: 150,
      };
      await writeHistory([httpEntry]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(0);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.type).toBe('http');
      const http = result as HttpEntry;
      expect(http.method).toBe('POST');
      expect(http.url).toBe('https://api.example.com/users');
      expect(http.requestHeaders).toEqual({ 'Content-Type': 'application/json' });
      expect(http.requestBody).toBe('{"name":"test"}');
      expect(http.status).toBe(201);
      expect(http.responseBody).toBe('{"id":"123"}');
      expect(http.durationMs).toBe(150);
    });
  });

  describe('search', () => {
    it('should return empty result when no history file exists', async () => {
      // Arrange
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('test');

      // Assert
      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return empty result for empty search term', async () => {
      // Arrange
      await writeHistory([createHttpEntry('GET', 'https://test.com')]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('');

      // Assert
      expect(result.entries).toHaveLength(0);
    });

    it('should search in HTTP URL', async () => {
      // Arrange
      const entries = [
        createHttpEntry('GET', 'https://api.example.com/users'),
        createHttpEntry('GET', 'https://api.other.com/items'),
        createHttpEntry('POST', 'https://api.example.com/orders'),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('example');

      // Assert
      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should search in HTTP method', async () => {
      // Arrange
      const entries = [
        createHttpEntry('GET', 'https://api.example.com/users'),
        createHttpEntry('POST', 'https://api.example.com/items'),
        createHttpEntry('DELETE', 'https://api.example.com/orders'),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('POST');

      // Assert
      expect(result.entries).toHaveLength(1);
      expect((result.entries[0]?.entry as HttpEntry).method).toBe('POST');
    });

    it('should search in command name', async () => {
      // Arrange
      const entries = [
        createCmdEntry('cd', ['/users']),
        createCmdEntry('ls'),
        createCmdEntry('cd', ['/items']),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('cd');

      // Assert
      expect(result.entries).toHaveLength(2);
    });

    it('should search in command args', async () => {
      // Arrange
      const entries = [
        createCmdEntry('cd', ['/users']),
        createCmdEntry('cd', ['/items']),
        createCmdEntry('run', ['my-collection/test-request']),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('collection');

      // Assert
      expect(result.entries).toHaveLength(1);
      expect((result.entries[0]?.entry as CmdEntry).command).toBe('run');
    });

    it('should be case-insensitive', async () => {
      // Arrange
      await writeHistory([createHttpEntry('GET', 'https://API.EXAMPLE.COM/USERS')]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('example');

      // Assert
      expect(result.entries).toHaveLength(1);
    });

    it('should limit search results', async () => {
      // Arrange
      const entries = Array.from({ length: 30 }, (_, i) =>
        createHttpEntry('GET', `https://api.example.com/item${i}`)
      );
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('example', 5);

      // Assert
      expect(result.entries).toHaveLength(5);
      expect(result.total).toBe(30);
    });

    it('should return no matches message scenario', async () => {
      // Arrange
      await writeHistory([
        createHttpEntry('GET', 'https://api.example.com/users'),
        createCmdEntry('ls'),
      ]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('nonexistent');

      // Assert
      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
