/**
 * Tests for HistoryReader
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    await writeFile(historyPath, `${lines}\n`);
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
      const entries = [createCmdEntry('cd', ['/users']), createCmdEntry('ls'), createCmdEntry('get', ['1'])];
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
      const entries = [createCmdEntry('first'), createCmdEntry('second'), createCmdEntry('third')];
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
      const entries = [createCmdEntry('first'), createCmdEntry('second'), createCmdEntry('third')];
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
      const entries = [createCmdEntry('first'), createCmdEntry('second'), createCmdEntry('third')];
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
        responseHeaders: { Location: '/users/123' },
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
      const entries = [createCmdEntry('cd', ['/users']), createCmdEntry('ls'), createCmdEntry('cd', ['/items'])];
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
      const entries = Array.from({ length: 30 }, (_, i) => createHttpEntry('GET', `https://api.example.com/item${i}`));
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
      await writeHistory([createHttpEntry('GET', 'https://api.example.com/users'), createCmdEntry('ls')]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('nonexistent');

      // Assert
      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('large history file', () => {
    it('should read all entries from a file with 1000 entries', async () => {
      // Arrange
      const count = 1000;
      const entries = Array.from({ length: count }, (_, i) => createCmdEntry(`cmd${i}`));
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list(count);

      // Assert
      expect(result.total).toBe(count);
      expect(result.entries).toHaveLength(count);
      // Most recent entry (last written) should be first
      expect((result.entries[0]?.entry as CmdEntry).command).toBe('cmd999');
      expect((result.entries[count - 1]?.entry as CmdEntry).command).toBe('cmd0');
    });

    it('should search efficiently across a large file', async () => {
      // Arrange
      const entries = [
        ...Array.from({ length: 500 }, (_, i) => createCmdEntry(`cmd${i}`)),
        ...Array.from({ length: 500 }, (_, i) => createHttpEntry('GET', `https://api.example.com/item${i}`)),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.search('example.com', 20);

      // Assert
      expect(result.total).toBe(500);
      expect(result.entries).toHaveLength(20);
    });

    it('should list with filter across a large file', async () => {
      // Arrange
      const entries = [
        ...Array.from({ length: 300 }, (_, i) => createCmdEntry(`cmd${i}`)),
        ...Array.from({ length: 700 }, (_, i) => createHttpEntry('GET', `https://api.example.com/item${i}`)),
      ];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list(1000, 'http');

      // Assert
      expect(result.total).toBe(700);
      expect(result.entries.every((e) => e.entry.type === 'http')).toBe(true);
    });
  });

  describe('timestamp ordering', () => {
    it('should return entries ordered by timestamp descending (most recent first)', async () => {
      // Arrange — entries with explicit timestamps in ascending order (oldest first in file)
      const baseTime = new Date('2026-01-01T10:00:00.000Z').getTime();
      const entries = Array.from({ length: 5 }, (_, i) => ({
        type: 'cmd' as const,
        timestamp: new Date(baseTime + i * 60_000).toISOString(), // 1 minute apart
        command: `cmd${i}`,
        args: [] as string[],
        success: true,
      }));
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list(5);

      // Assert — most recent timestamp should be first
      const timestamps = result.entries.map((e) => e.entry.timestamp);
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(new Date(timestamps[i] ?? '').getTime()).toBeGreaterThan(new Date(timestamps[i + 1] ?? '').getTime());
      }
      expect((result.entries[0]?.entry as CmdEntry).command).toBe('cmd4');
      expect((result.entries[4]?.entry as CmdEntry).command).toBe('cmd0');
    });

    it('should preserve timestamp across serialization', async () => {
      // Arrange
      const timestamp = '2026-06-15T14:30:00.000Z';
      const entry: CmdEntry = {
        type: 'cmd',
        timestamp,
        command: 'get',
        args: ['/users'],
        success: true,
      };
      await writeHistory([entry]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(0);

      // Assert
      expect(result?.timestamp).toBe(timestamp);
      expect(new Date(result?.timestamp ?? '').toISOString()).toBe(timestamp);
    });
  });

  describe('NDJSON format integrity', () => {
    it('should store each entry on a single line with no embedded newlines', async () => {
      // Arrange
      const entries = [
        createCmdEntry('first'),
        createHttpEntry('GET', 'https://api.example.com'),
        createCmdEntry('last'),
      ];
      await writeHistory(entries);

      // Act — read raw file content
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(historyPath, 'utf-8');
      const lines = raw.split('\n').filter((l) => l.trim());

      // Assert — each non-empty line must be valid JSON
      expect(lines).toHaveLength(3);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
        const parsed = JSON.parse(line) as { type: string; timestamp: string };
        expect(parsed).toHaveProperty('type');
        expect(parsed).toHaveProperty('timestamp');
      }
    });

    it('should handle entries that have JSON string values containing escaped quotes', async () => {
      // Arrange
      const entry: CmdEntry = {
        type: 'cmd',
        timestamp: new Date().toISOString(),
        command: 'run',
        args: ['collection with "quotes" inside'],
        success: true,
      };
      await writeHistory([entry]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(0);

      // Assert
      expect((result as CmdEntry).args[0]).toBe('collection with "quotes" inside');
    });

    it('should handle whitespace-only lines gracefully (skip them)', async () => {
      // Arrange — write file with blank lines between entries
      const { writeFile } = await import('node:fs/promises');
      const e1 = JSON.stringify(createCmdEntry('first'));
      const e2 = JSON.stringify(createCmdEntry('second'));
      // Insert blank/whitespace lines
      await writeFile(historyPath, `${e1}\n   \n\t\n${e2}\n`);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.list();

      // Assert — only 2 real entries parsed
      expect(result.entries).toHaveLength(2);
    });
  });

  describe('serialization roundtrip', () => {
    it('should roundtrip all HttpEntry fields without loss', async () => {
      // Arrange — a fully-populated HttpEntry
      const original: HttpEntry = {
        type: 'http',
        timestamp: '2026-03-15T08:00:00.000Z',
        method: 'POST',
        url: 'https://api.example.com/v2/users',
        rawCommand: 'post /v2/users -d {"name":"Alice"}',
        requestHeaders: { 'Content-Type': 'application/json', Accept: 'application/json' },
        requestBody: '{"name":"Alice"}',
        requestBodyTruncated: false,
        status: 201,
        responseHeaders: { Location: '/v2/users/42', 'X-Request-Id': 'abc-123' },
        responseBody: '{"id":42,"name":"Alice"}',
        responseBodyTruncated: false,
        durationMs: 87,
        assertionsPassed: 3,
        assertionsFailed: 0,
        extractedVars: ['userId', 'authToken'],
      };
      await writeHistory([original]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(0);

      // Assert
      expect(result).toEqual(original);
    });

    it('should roundtrip all CmdEntry fields without loss', async () => {
      // Arrange
      const original: CmdEntry = {
        type: 'cmd',
        timestamp: '2026-03-15T09:00:00.000Z',
        command: 'run',
        args: ['my-collection', '--env', 'production'],
        success: false,
        error: 'assertion failed: status expected 200 got 404',
      };
      await writeHistory([original]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.show(0);

      // Assert
      expect(result).toEqual(original);
    });

    it('should preserve multiple entries in insertion order when written then read', async () => {
      // Arrange — 10 mixed entries in a specific order
      const entries = Array.from({ length: 10 }, (_, i) =>
        i % 2 === 0
          ? createCmdEntry(`cmd${i}`, [`arg${i}`])
          : createHttpEntry(i % 3 === 0 ? 'POST' : 'GET', `https://api.example.com/item${i}`, 200),
      );
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act — list all (reversed = most-recent first)
      const result = await reader.list(10);

      // Assert — reversed order: entry[9] at index 0, entry[0] at index 9
      expect(result.total).toBe(10);
      for (let i = 0; i < 10; i++) {
        const displayEntry = result.entries[i]?.entry;
        const originalEntry = entries[9 - i];
        expect(displayEntry?.type).toBe(originalEntry?.type);
        expect(displayEntry?.timestamp).toBe(originalEntry?.timestamp);
      }
    });
  });

  describe('delete', () => {
    it('should return false when no history file exists', async () => {
      // Arrange
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.delete(0);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for negative index', async () => {
      // Arrange
      await writeHistory([createCmdEntry('test')]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.delete(-1);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for index out of range', async () => {
      // Arrange
      await writeHistory([createCmdEntry('test')]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.delete(99);

      // Assert
      expect(result).toBe(false);
    });

    it('should delete entry at index 0 (most recent)', async () => {
      // Arrange
      const entries = [createCmdEntry('first'), createCmdEntry('second'), createCmdEntry('third')];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.delete(0);

      // Assert
      expect(result).toBe(true);
      const remaining = await reader.list();
      expect(remaining.entries).toHaveLength(2);
      // 'third' was most recent (index 0), should be deleted
      expect((remaining.entries[0]?.entry as CmdEntry).command).toBe('second');
      expect((remaining.entries[1]?.entry as CmdEntry).command).toBe('first');
    });

    it('should delete entry at specific index', async () => {
      // Arrange
      const entries = [createCmdEntry('first'), createCmdEntry('second'), createCmdEntry('third')];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act - delete 'second' (index 1 in display order: third, second, first)
      const result = await reader.delete(1);

      // Assert
      expect(result).toBe(true);
      const remaining = await reader.list();
      expect(remaining.entries).toHaveLength(2);
      expect((remaining.entries[0]?.entry as CmdEntry).command).toBe('third');
      expect((remaining.entries[1]?.entry as CmdEntry).command).toBe('first');
    });

    it('should delete the oldest entry (last in display order)', async () => {
      // Arrange
      const entries = [createCmdEntry('first'), createCmdEntry('second'), createCmdEntry('third')];
      await writeHistory(entries);
      const reader = new HistoryReader(historyPath);

      // Act - delete 'first' (index 2 in display order)
      const result = await reader.delete(2);

      // Assert
      expect(result).toBe(true);
      const remaining = await reader.list();
      expect(remaining.entries).toHaveLength(2);
      expect((remaining.entries[0]?.entry as CmdEntry).command).toBe('third');
      expect((remaining.entries[1]?.entry as CmdEntry).command).toBe('second');
    });

    it('should handle deleting the only entry', async () => {
      // Arrange
      await writeHistory([createCmdEntry('only')]);
      const reader = new HistoryReader(historyPath);

      // Act
      const result = await reader.delete(0);

      // Assert
      expect(result).toBe(true);
      const remaining = await reader.list();
      expect(remaining.entries).toHaveLength(0);
    });
  });
});
