/**
 * Tests for HistoryWriter
 */

import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CmdEntry, HttpEntry } from '../types.js';
import { HistoryWriter } from '../writer.js';

describe('HistoryWriter', () => {
  let testDir: string;
  let historyPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `history-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    historyPath = join(testDir, 'history.ndjson');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('logCmd', () => {
    it('should create history file and log command entry', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logCmd('cd', ['/users'], true);

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as CmdEntry;
      expect(entry.type).toBe('cmd');
      expect(entry.command).toBe('cd');
      expect(entry.args).toEqual(['/users']);
      expect(entry.success).toBe(true);
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should log command with error message', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logCmd('get', ['/invalid'], false, 'Not found');

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as CmdEntry;
      expect(entry.success).toBe(false);
      expect(entry.error).toBe('Not found');
    });

    it('should append to existing history', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logCmd('cd', ['/users'], true);
      await writer.logCmd('ls', [], true);

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0] ?? '{}').command).toBe('cd');
      expect(JSON.parse(lines[1] ?? '{}').command).toBe('ls');
    });

    it('should preserve unicode in arguments', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logCmd('get', ['/users?name=日本語'], true);

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as CmdEntry;
      expect(entry.args[0]).toBe('/users?name=日本語');
    });

    it('should not throw on write failure', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath: '/nonexistent/path/history.ndjson' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act & Assert - should not throw
      await expect(writer.logCmd('test', [], true)).resolves.not.toThrow();

      warnSpy.mockRestore();
    });
  });

  describe('logHttp', () => {
    it('should log successful HTTP request', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logHttp({
        method: 'GET',
        url: 'https://api.example.com/users',
        status: 200,
        durationMs: 150,
      });

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as HttpEntry;
      expect(entry.type).toBe('http');
      expect(entry.method).toBe('GET');
      expect(entry.url).toBe('https://api.example.com/users');
      expect(entry.status).toBe(200);
      expect(entry.durationMs).toBe(150);
    });

    it('should log HTTP request with response body', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logHttp({
        method: 'GET',
        url: 'https://api.example.com/users/1',
        status: 200,
        responseBody: '{"id":1,"name":"Alice"}',
      });

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as HttpEntry;
      expect(entry.responseBody).toBe('{"id":1,"name":"Alice"}');
      expect(entry.responseBodyTruncated).toBeUndefined();
    });

    it('should truncate large response body', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath, maxBodySize: 100 });
      const largeBody = 'x'.repeat(200);

      // Act
      await writer.logHttp({
        method: 'GET',
        url: 'https://api.example.com/large',
        status: 200,
        responseBody: largeBody,
      });

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as HttpEntry;
      expect(entry.responseBody?.length).toBeLessThan(200);
      expect(entry.responseBody).toContain('...[truncated]');
      expect(entry.responseBodyTruncated).toBe(true);
    });

    it('should log failed HTTP request', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logHttp({
        method: 'GET',
        url: 'https://api.example.com/timeout',
        status: null,
        error: 'Connection timeout',
      });

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as HttpEntry;
      expect(entry.status).toBeNull();
      expect(entry.error).toBe('Connection timeout');
    });

    it('should redact authorization header', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logHttp({
        method: 'GET',
        url: 'https://api.example.com/protected',
        requestHeaders: {
          Authorization: 'Bearer secret-token-123',
          'Content-Type': 'application/json',
        },
        status: 200,
      });

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as HttpEntry;
      expect(entry.requestHeaders?.['Authorization']).toBe('[REDACTED]');
      expect(entry.requestHeaders?.['Content-Type']).toBe('application/json');
    });

    it('should redact password in request body', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logHttp({
        method: 'POST',
        url: 'https://api.example.com/login',
        requestBody: JSON.stringify({ username: 'alice', password: 'secret123' }),
        status: 200,
      });

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as HttpEntry;
      const bodyParsed = JSON.parse(entry.requestBody as string);
      expect(bodyParsed.username).toBe('alice');
      expect(bodyParsed.password).toBe('[REDACTED]');
    });

    it('should log assertion results', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logHttp({
        method: 'GET',
        url: 'https://api.example.com/test',
        status: 200,
        assertionsPassed: 2,
        assertionsFailed: 1,
      });

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as HttpEntry;
      expect(entry.assertionsPassed).toBe(2);
      expect(entry.assertionsFailed).toBe(1);
    });

    it('should log extracted variable names without values', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logHttp({
        method: 'GET',
        url: 'https://api.example.com/data',
        status: 200,
        extractedVars: ['userId', 'token'],
      });

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as HttpEntry;
      expect(entry.extractedVars).toEqual(['userId', 'token']);
    });

    it('should not include empty optional fields', async () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act
      await writer.logHttp({
        method: 'GET',
        url: 'https://api.example.com/simple',
        status: 200,
      });

      // Assert
      const content = await readFile(historyPath, 'utf8');
      const entry = JSON.parse(content.trim()) as HttpEntry;
      expect(entry.requestHeaders).toBeUndefined();
      expect(entry.requestBody).toBeUndefined();
      expect(entry.responseHeaders).toBeUndefined();
      expect(entry.responseBody).toBeUndefined();
      expect(entry.error).toBeUndefined();
    });
  });

  describe('getPath', () => {
    it('should return the configured history path', () => {
      // Arrange
      const writer = new HistoryWriter({ historyPath });

      // Act & Assert
      expect(writer.getPath()).toBe(historyPath);
    });
  });
});
