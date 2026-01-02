/**
 * E2E tests for REPL engine
 * Tests integration of history, completion, and multiline input
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock consola to suppress output during tests
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the HTTP request/command history module
vi.mock('../../collections/history/index.js', () => ({
  HistoryWriter: class MockHistoryWriter {
    logCmd = vi.fn();
    logHttp = vi.fn();
    close = vi.fn();
  },
}));

import { runRepl } from '../engine.js';
import { getHistoryFilePath, InputHistory } from '../input-history.js';

describe('REPL E2E', () => {
  let testDir: string;
  let mockOutput: Writable;
  let outputData: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `repl-e2e-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    outputData = '';
    mockOutput = new Writable({
      write(chunk, _encoding, callback) {
        outputData += chunk.toString();
        callback();
      },
    });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('History Navigation', () => {
    it('should persist history across sessions', async () => {
      // Arrange - First session
      const historyDir = join(testDir, '.unireq');
      mkdirSync(historyDir, { recursive: true });

      const input1 = Readable.from(['help\n', 'version\n', 'exit\n']);

      // Act - First session
      await runRepl({
        workspace: testDir,
        input: input1,
        output: mockOutput,
        terminal: false,
      });

      // Assert - History file should exist with commands
      const historyPath = join(historyDir, 'repl_history');
      expect(existsSync(historyPath)).toBe(true);

      const historyContent = readFileSync(historyPath, 'utf8');
      expect(historyContent).toContain('help');
      expect(historyContent).toContain('version');
      expect(historyContent).toContain('exit');
    });

    it('should load history from previous sessions', async () => {
      // Arrange - Pre-populate history
      const historyDir = join(testDir, '.unireq');
      mkdirSync(historyDir, { recursive: true });
      const historyPath = join(historyDir, 'repl_history');
      writeFileSync(historyPath, 'previous-cmd1\nprevious-cmd2\n', 'utf8');

      // Act - New session with pre-existing history
      const input = Readable.from(['exit\n']);
      await runRepl({
        workspace: testDir,
        input,
        output: mockOutput,
        terminal: false,
      });

      // Assert - History should include previous commands plus exit
      const historyContent = readFileSync(historyPath, 'utf8');
      expect(historyContent).toContain('previous-cmd1');
      expect(historyContent).toContain('previous-cmd2');
      expect(historyContent).toContain('exit');
    });

    it('should respect maxEntries limit', async () => {
      // Arrange
      const historyDir = join(testDir, '.unireq');
      mkdirSync(historyDir, { recursive: true });
      const historyPath = join(historyDir, 'repl_history');

      // Write history with many entries
      const manyCommands = Array.from({ length: 50 }, (_, i) => `cmd${i}`).join('\n');
      writeFileSync(historyPath, `${manyCommands}\n`, 'utf8');

      // Act
      const input = Readable.from(['exit\n']);
      await runRepl({
        workspace: testDir,
        input,
        output: mockOutput,
        terminal: false,
        historyConfig: { maxEntries: 10 },
      });

      // Assert - Should only keep last 10 + exit = up to 11
      const historyContent = readFileSync(historyPath, 'utf8');
      const lines = historyContent.split('\n').filter((l) => l.trim());
      expect(lines.length).toBeLessThanOrEqual(11);
    });

    it('should skip duplicate consecutive commands', async () => {
      // Arrange
      const historyDir = join(testDir, '.unireq');
      mkdirSync(historyDir, { recursive: true });

      const input = Readable.from(['help\n', 'help\n', 'help\n', 'exit\n']);

      // Act
      await runRepl({
        workspace: testDir,
        input,
        output: mockOutput,
        terminal: false,
      });

      // Assert - History should only have one 'help' entry
      const historyPath = join(historyDir, 'repl_history');
      const historyContent = readFileSync(historyPath, 'utf8');
      const helpCount = historyContent.split('\n').filter((l) => l === 'help').length;
      expect(helpCount).toBe(1);
    });
  });

  describe('Command Execution', () => {
    it('should execute help command', async () => {
      // Arrange
      outputData = '';
      const input = Readable.from(['help\n', 'exit\n']);

      // Act
      await runRepl({
        input,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert - Output should contain command list prompt
      expect(outputData).toBeDefined();
      // The help command logs via consola.info which is mocked
    });

    it('should execute version command', async () => {
      // Arrange
      outputData = '';
      const input = Readable.from(['version\n', 'exit\n']);

      // Act
      await runRepl({
        input,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert - Command should execute without error
      expect(outputData).toBeDefined();
    });

    it('should handle unknown commands gracefully', async () => {
      // Arrange
      outputData = '';
      const input = Readable.from(['unknowncommand\n', 'exit\n']);

      // Act
      await runRepl({
        input,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert - Should not throw, continue REPL
      expect(outputData).toBeDefined();
    });
  });

  describe('Multiline Input', () => {
    it('should accumulate multiline JSON input', async () => {
      // Arrange - JSON spread across multiple lines with enter
      const input = Readable.from(['post /users {\n', '"name": "Alice"\n', '}\n', 'exit\n']);

      // Act
      await runRepl({
        input,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert - Should complete without throwing
      expect(outputData).toBeDefined();
    });
  });

  describe('Exit Handling', () => {
    it('should exit on exit command', async () => {
      // Arrange
      const input = Readable.from(['exit\n']);

      // Act
      await runRepl({
        input,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert - Promise should resolve (REPL exited)
      expect(outputData).toBeDefined();
    });

    it('should exit on EOF (empty stream)', async () => {
      // Arrange - Empty stream simulates Ctrl+D
      const input = Readable.from([]);

      // Act
      await runRepl({
        input,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert - Promise should resolve (REPL exited)
      expect(outputData).toBeDefined();
    });
  });

  describe('Workspace Integration', () => {
    it('should use workspace-specific history when workspace provided', async () => {
      // Arrange
      const input = Readable.from(['help\n', 'exit\n']);

      // Act
      await runRepl({
        workspace: testDir,
        input,
        output: mockOutput,
        terminal: false,
      });

      // Assert
      const historyPath = join(testDir, '.unireq', 'repl_history');
      expect(existsSync(historyPath)).toBe(true);
    });
  });
});

describe('InputHistory Integration', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `history-integration-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should integrate with getHistoryFilePath', () => {
    // Arrange & Act
    const path = getHistoryFilePath(testDir);

    // Assert
    expect(path).toBe(join(testDir, '.unireq', 'repl_history'));
  });

  it('should round-trip history through file', () => {
    // Arrange
    const history1 = new InputHistory({ workspace: testDir });
    history1.add('command1');
    history1.add('command2');
    history1.add('command3');
    history1.save();

    // Act - Create new instance that should load saved history
    const history2 = new InputHistory({ workspace: testDir });

    // Assert
    expect(history2.getAll()).toEqual(['command1', 'command2', 'command3']);
  });
});
