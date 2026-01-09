/**
 * Tests for Keyboard Bindings Hook
 *
 * Tests Claude Code style Ctrl shortcuts
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
  const { activeModal, pendingQuit } = useKeyBindings({
    isInputFocused: props.isInputFocused ?? false,
    ...props,
  });

  return (
    <Box flexDirection="column">
      <Text>Modal: {activeModal ?? 'none'}</Text>
      <Text>Input focused: {props.isInputFocused ? 'yes' : 'no'}</Text>
      <Text>Pending quit: {pendingQuit ? 'yes' : 'no'}</Text>
    </Box>
  );
}

describe('useKeyBindings', () => {
  describe('Ctrl shortcuts (work even when input is focused)', () => {
    it('should call onInspector on Ctrl+Q', async () => {
      const onInspector = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onInspector={onInspector} />);

      await stdin.write('\x11'); // Ctrl+Q (ASCII 17)

      expect(onInspector).toHaveBeenCalledTimes(1);
    });

    it('should call onProfileConfig on Ctrl+P', async () => {
      const onProfileConfig = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onProfileConfig={onProfileConfig} />);

      await stdin.write('\x10'); // Ctrl+P (ASCII 16)

      expect(onProfileConfig).toHaveBeenCalledTimes(1);
    });

    it('should call onHistory on Ctrl+R', async () => {
      const onHistory = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onHistory={onHistory} />);

      await stdin.write('\x12'); // Ctrl+R (ASCII 18)

      expect(onHistory).toHaveBeenCalledTimes(1);
    });

    it('should clear input AND set pendingQuit on first Ctrl+C when input is not empty', async () => {
      const onQuit = vi.fn();
      const onClearInput = vi.fn();
      const { stdin, lastFrame } = render(
        <TestComponent isInputFocused={true} currentInput="some text" onQuit={onQuit} onClearInput={onClearInput} />,
      );

      await stdin.write('\x03'); // Ctrl+C (ASCII 3)

      // Wait for React to re-render with updated state
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onClearInput).toHaveBeenCalledTimes(1);
      expect(onQuit).not.toHaveBeenCalled();
      // Now always shows pending quit message, even after clearing input
      expect(lastFrame()).toContain('Pending quit: yes');
    });

    it('should set pendingQuit on first Ctrl+C when input is empty', async () => {
      const onQuit = vi.fn();
      const onClearInput = vi.fn();
      const { stdin, lastFrame } = render(
        <TestComponent isInputFocused={true} currentInput="" onQuit={onQuit} onClearInput={onClearInput} />,
      );

      await stdin.write('\x03'); // Ctrl+C (ASCII 3)

      // Wait for React to re-render with updated state
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onClearInput).not.toHaveBeenCalled();
      expect(onQuit).not.toHaveBeenCalled();
      expect(lastFrame()).toContain('Pending quit: yes');
    });

    it('should call onQuit on double Ctrl+C', async () => {
      const onQuit = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} currentInput="" onQuit={onQuit} />);

      await stdin.write('\x03'); // First Ctrl+C
      await stdin.write('\x03'); // Second Ctrl+C

      expect(onQuit).toHaveBeenCalledTimes(1);
    });

    it('should call onQuit on Ctrl+D', async () => {
      const onQuit = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onQuit={onQuit} />);

      await stdin.write('\x04'); // Ctrl+D (ASCII 4)

      expect(onQuit).toHaveBeenCalledTimes(1);
    });

    it('should call onClear on Ctrl+L', async () => {
      const onClear = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={true} onClear={onClear} />);

      await stdin.write('\x0C'); // Ctrl+L (ASCII 12)

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('should call onSettings on Ctrl+O', async () => {
      const onSettings = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} onSettings={onSettings} />);

      await stdin.write('\x0F'); // Ctrl+O (ASCII 15)

      expect(onSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ctrl+/ shortcut for help', () => {
    it('should call onHelp on Ctrl+/ (sent as Ctrl+_)', async () => {
      const onHelp = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} onHelp={onHelp} />);

      await stdin.write('\x1F'); // Ctrl+/ = ASCII 31 (Ctrl+_)

      expect(onHelp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Escape key', () => {
    it('should call onCloseModal on Escape when modal is open', async () => {
      const onCloseModal = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} isModalOpen={true} onCloseModal={onCloseModal} />);

      await stdin.write('\x1B'); // Escape

      expect(onCloseModal).toHaveBeenCalledTimes(1);
    });

    it('should not open inspector when modal is already open', async () => {
      const onInspector = vi.fn();
      const { stdin } = render(<TestComponent isInputFocused={false} isModalOpen={true} onInspector={onInspector} />);

      await stdin.write('\x09'); // Ctrl+I

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
