/**
 * Tests for Keyboard Bindings Hook
 */

import { Box, Text } from 'ink';
import { render } from 'ink-testing-library';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { KeyBindingsConfig } from '../useKeyBindings.js';
import { useKeyBindings } from '../useKeyBindings.js';

/**
 * Test component that uses the hook
 */
function TestComponent(props: Partial<KeyBindingsConfig>): ReactNode {
  const { activeModal } = useKeyBindings({
    isInputFocused: props.isInputFocused ?? false,
    ...props,
  });

  return (
    <Box flexDirection="column">
      <Text>Modal: {activeModal ?? 'none'}</Text>
      <Text>Input focused: {props.isInputFocused ? 'yes' : 'no'}</Text>
    </Box>
  );
}

describe('useKeyBindings', () => {
  describe('Shortcut callbacks', () => {
    it('should call onInspector on "i" key when not focused', async () => {
      const onInspector = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} onInspector={onInspector} />);

      await stdin.write('i');

      expect(onInspector).toHaveBeenCalledTimes(1);
    });

    it('should call onHistory on "h" key when not focused', async () => {
      const onHistory = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} onHistory={onHistory} />);

      await stdin.write('h');

      expect(onHistory).toHaveBeenCalledTimes(1);
    });

    it('should call onHelp on "?" key when not focused', async () => {
      const onHelp = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} onHelp={onHelp} />);

      await stdin.write('?');

      expect(onHelp).toHaveBeenCalledTimes(1);
    });

    it('should call onQuit on "q" key when not focused', async () => {
      const onQuit = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} onQuit={onQuit} />);

      await stdin.write('q');

      expect(onQuit).toHaveBeenCalledTimes(1);
    });

    it('should call onQuit on Ctrl+C even when input is focused', async () => {
      const onQuit = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onQuit={onQuit} />);

      await stdin.write('\x03'); // Ctrl+C

      expect(onQuit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input focus handling', () => {
    it('should not call onInspector when input is focused', async () => {
      const onInspector = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onInspector={onInspector} />);

      await stdin.write('i');

      expect(onInspector).not.toHaveBeenCalled();
    });

    it('should not call onHistory when input is focused', async () => {
      const onHistory = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onHistory={onHistory} />);

      await stdin.write('h');

      expect(onHistory).not.toHaveBeenCalled();
    });

    it('should not call onHelp when input is focused', async () => {
      const onHelp = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onHelp={onHelp} />);

      await stdin.write('?');

      expect(onHelp).not.toHaveBeenCalled();
    });

    it('should not call onQuit on "q" when input is focused', async () => {
      const onQuit = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onQuit={onQuit} />);

      await stdin.write('q');

      expect(onQuit).not.toHaveBeenCalled();
    });
  });

  describe('Case insensitivity', () => {
    it('should handle uppercase "I" for inspector', async () => {
      const onInspector = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} onInspector={onInspector} />);

      await stdin.write('I');

      expect(onInspector).toHaveBeenCalledTimes(1);
    });

    it('should handle uppercase "H" for history', async () => {
      const onHistory = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} onHistory={onHistory} />);

      await stdin.write('H');

      expect(onHistory).toHaveBeenCalledTimes(1);
    });

    it('should handle uppercase "Q" for quit', async () => {
      const onQuit = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} onQuit={onQuit} />);

      await stdin.write('Q');

      expect(onQuit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Escape key', () => {
    it('should call onCloseModal on Escape when modal is open', async () => {
      const onCloseModal = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} isModalOpen={true} onCloseModal={onCloseModal} />);

      await stdin.write('\x1B'); // Escape

      expect(onCloseModal).toHaveBeenCalledTimes(1);
    });

    it('should not call shortcuts when modal is open', async () => {
      const onInspector = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} isModalOpen={true} onInspector={onInspector} />);

      await stdin.write('i');

      expect(onInspector).not.toHaveBeenCalled();
    });
  });

  describe('Initial state', () => {
    it('should start with no active modal', () => {
      const { lastFrame } = render(<TestComponent isInputFocused={false} />);

      expect(lastFrame()).toContain('Modal: none');
    });

    it('should show input focused state', () => {
      const { lastFrame } = render(<TestComponent isInputFocused={true} />);

      expect(lastFrame()).toContain('Input focused: yes');
    });
  });
});
