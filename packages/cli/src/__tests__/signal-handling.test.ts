/**
 * Tests for signal handling in REPL
 * Following AAA pattern for unit tests
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock @clack/prompts before importing engine
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  text: vi.fn(),
  isCancel: vi.fn(),
}));

// Mock consola
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { cancel, intro, isCancel, outro, text } from '@clack/prompts';
import { runRepl } from '../repl/engine.js';

describe('Signal handling', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when Ctrl+D (EOF) is pressed', () => {
    it('should exit REPL gracefully', async () => {
      // Arrange
      // @ts-expect-error - simulating EOF which returns undefined in @clack/prompts
      vi.mocked(text).mockResolvedValueOnce(undefined);
      vi.mocked(isCancel).mockReturnValue(false);

      // Act
      await runRepl();

      // Assert
      expect(intro).toHaveBeenCalledWith('Welcome to unireq REPL');
      expect(cancel).toHaveBeenCalledWith('Goodbye!');
    });

    it('should display Goodbye message via cancel', async () => {
      // Arrange
      // @ts-expect-error - simulating EOF which returns undefined in @clack/prompts
      vi.mocked(text).mockResolvedValueOnce(undefined);
      vi.mocked(isCancel).mockReturnValue(false);

      // Act
      await runRepl();

      // Assert
      expect(cancel).toHaveBeenCalledWith('Goodbye!');
      expect(outro).not.toHaveBeenCalled();
    });
  });

  describe('when Ctrl+C is pressed', () => {
    it('should exit REPL gracefully', async () => {
      // Arrange
      const cancelSymbol = Symbol('cancel');
      vi.mocked(text).mockResolvedValueOnce(cancelSymbol as unknown as string);
      vi.mocked(isCancel).mockReturnValue(true);

      // Act
      await runRepl();

      // Assert
      expect(intro).toHaveBeenCalledWith('Welcome to unireq REPL');
      expect(cancel).toHaveBeenCalledWith('Goodbye!');
    });

    it('should display Goodbye message via cancel', async () => {
      // Arrange
      const cancelSymbol = Symbol('cancel');
      vi.mocked(text).mockResolvedValueOnce(cancelSymbol as unknown as string);
      vi.mocked(isCancel).mockReturnValue(true);

      // Act
      await runRepl();

      // Assert
      expect(cancel).toHaveBeenCalledWith('Goodbye!');
      expect(outro).not.toHaveBeenCalled();
    });
  });

  describe('when exit command is used', () => {
    it('should exit via outro not cancel', async () => {
      // Arrange
      vi.mocked(text).mockResolvedValueOnce('exit');
      vi.mocked(isCancel).mockReturnValue(false);

      // Act
      await runRepl();

      // Assert
      expect(outro).toHaveBeenCalledWith('Goodbye!');
      expect(cancel).not.toHaveBeenCalled();
    });
  });

  describe('when multiple inputs before exit', () => {
    it('should process commands then exit on EOF', async () => {
      // Arrange
      // @ts-expect-error - simulating EOF which returns undefined in @clack/prompts
      vi.mocked(text).mockResolvedValueOnce('help').mockResolvedValueOnce('version').mockResolvedValueOnce(undefined);
      vi.mocked(isCancel).mockReturnValue(false);

      // Act
      await runRepl();

      // Assert
      expect(text).toHaveBeenCalledTimes(3);
      expect(cancel).toHaveBeenCalledWith('Goodbye!');
    });

    it('should process commands then exit on Ctrl+C', async () => {
      // Arrange
      const cancelSymbol = Symbol('cancel');
      vi.mocked(text)
        .mockResolvedValueOnce('help')
        .mockResolvedValueOnce(cancelSymbol as unknown as string);
      vi.mocked(isCancel).mockReturnValueOnce(false).mockReturnValueOnce(true);

      // Act
      await runRepl();

      // Assert
      expect(text).toHaveBeenCalledTimes(2);
      expect(cancel).toHaveBeenCalledWith('Goodbye!');
    });
  });

  describe('when empty input is entered', () => {
    it('should continue REPL loop', async () => {
      // Arrange
      // @ts-expect-error - simulating EOF which returns undefined in @clack/prompts
      vi.mocked(text).mockResolvedValueOnce('').mockResolvedValueOnce('   ').mockResolvedValueOnce(undefined);
      vi.mocked(isCancel).mockReturnValue(false);

      // Act
      await runRepl();

      // Assert
      expect(text).toHaveBeenCalledTimes(3);
      expect(cancel).toHaveBeenCalledWith('Goodbye!');
    });
  });
});
