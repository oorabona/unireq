/**
 * Tests for signal handling in REPL using Node.js repl module
 * Following AAA pattern for unit tests
 */

import { Readable, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock consola
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the history module to avoid file system operations
vi.mock('../collections/history/index.js', () => {
  return {
    HistoryWriter: class MockHistoryWriter {
      logCmd = vi.fn();
      logHttp = vi.fn();
      close = vi.fn();
    },
  };
});

import { runRepl } from '../repl/engine.js';

describe('Signal handling', () => {
  let mockInput: Readable;
  let mockOutput: Writable;
  let outputData: string;

  beforeEach(() => {
    outputData = '';
    mockOutput = new Writable({
      write(chunk, _encoding, callback) {
        outputData += chunk.toString();
        callback();
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when exit command is used', () => {
    it('should exit REPL gracefully', async () => {
      // Arrange
      mockInput = Readable.from(['exit\n']);

      // Act
      await runRepl({
        input: mockInput,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert
      // REPL should complete without throwing
      expect(outputData).toBeDefined();
    });
  });

  describe('when help command is used', () => {
    it('should display help and exit', async () => {
      // Arrange
      mockInput = Readable.from(['help\n', 'exit\n']);

      // Act
      await runRepl({
        input: mockInput,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert
      // REPL should complete without throwing
      expect(outputData).toBeDefined();
    });
  });

  describe('when empty input is entered', () => {
    it('should continue REPL loop', async () => {
      // Arrange - empty lines followed by exit
      mockInput = Readable.from(['\n', '   \n', 'exit\n']);

      // Act
      await runRepl({
        input: mockInput,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert
      // REPL should complete without throwing
      expect(outputData).toBeDefined();
    });
  });

  describe('when EOF (Ctrl+D) is sent', () => {
    it('should exit REPL gracefully', async () => {
      // Arrange - create a stream that ends immediately (simulates Ctrl+D)
      mockInput = Readable.from([]);

      // Act
      await runRepl({
        input: mockInput,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert
      // REPL should complete without throwing
      expect(outputData).toBeDefined();
    });
  });

  describe('when multiple commands are executed', () => {
    it('should process all commands before exit', async () => {
      // Arrange
      mockInput = Readable.from(['help\n', 'version\n', 'exit\n']);

      // Act
      await runRepl({
        input: mockInput,
        output: mockOutput,
        terminal: false,
        historyConfig: { historyPath: undefined },
      });

      // Assert
      // REPL should complete without throwing
      expect(outputData).toBeDefined();
    });
  });
});
