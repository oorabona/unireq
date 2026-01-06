/**
 * CommandLine Component
 *
 * Simple input field for entering commands.
 * Uses custom input handling instead of @inkjs/ui TextInput
 * to avoid issues with built-in suggestion rendering.
 */

import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCursor } from '../hooks/useCursor.js';
import { useRawKeyDetection } from '../hooks/useRawKeyDetection.js';
import type { CursorSettings } from '../state/types.js';

// React is needed for JSX transformation with tsx
void React;

export interface CommandLineProps {
  /** Called when user presses Enter */
  onSubmit: (value: string) => void;
  /** Called when input value changes (for autocomplete) */
  onChange?: (value: string) => void;
  /** Prompt character to display (default: ">") */
  prompt?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether input is disabled */
  isDisabled?: boolean;
  /** Controlled value */
  value?: string;
  /** Command history for arrow key navigation (newest first) */
  history?: string[];
  /** Border color (default: "gray") */
  borderColor?: string;
  /** Whether autocomplete is active (Enter will be handled by autocomplete) */
  autocompleteActive?: boolean;
  /** Cursor display settings */
  cursorSettings?: CursorSettings;
}

/**
 * CommandLine component
 *
 * Renders an input prompt with history navigation.
 * Arrow Up/Down navigates command history.
 * Claude Code style: bordered box with ">" prompt.
 */
export function CommandLine({
  onSubmit,
  onChange,
  prompt = '>',
  placeholder = 'Type a command...',
  isDisabled = false,
  value = '',
  history = [],
  borderColor = 'gray',
  autocompleteActive = false,
  cursorSettings,
}: CommandLineProps): ReactNode {
  // Internal value state (for uncontrolled mode)
  const [internalValue, setInternalValue] = useState('');

  // Use cursor hook with settings (blinking cursor)
  const { visible: cursorVisible } = useCursor({
    blink: cursorSettings?.blink ?? true,
    blinkInterval: cursorSettings?.blinkInterval ?? 530,
    active: !isDisabled,
    style: cursorSettings?.style ?? 'block',
  });

  // Use controlled value if provided, otherwise internal
  const currentValue = value || internalValue;

  // History navigation state (-1 = not navigating, 0+ = index in history)
  const historyIndexRef = useRef(-1);
  const savedInputRef = useRef('');

  // Cursor position
  const [cursorPos, setCursorPos] = useState(0);

  // Track previous controlled value to detect external changes
  const prevValueRef = useRef(value);

  // When controlled value changes externally, move cursor to end
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      // Move cursor to end of new value (for autocomplete selection, history, etc.)
      setCursorPos(value.length);
    }
  }, [value]);

  // Use shared hook for Backspace/Delete detection
  const { detectKey } = useRawKeyDetection();

  // Update value helper
  const updateValue = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      onChange?.(newValue);
    },
    [onChange],
  );

  // Delete word before cursor (Ctrl+W behavior)
  const deleteWordBeforeCursor = useCallback(() => {
    if (cursorPos === 0) return;

    // Find the start of the word before cursor
    let wordStart = cursorPos - 1;

    // Skip trailing spaces
    while (wordStart > 0 && currentValue[wordStart - 1] === ' ') {
      wordStart--;
    }

    // Find start of word (non-space characters)
    while (wordStart > 0 && currentValue[wordStart - 1] !== ' ') {
      wordStart--;
    }

    const newValue = currentValue.slice(0, wordStart) + currentValue.slice(cursorPos);
    updateValue(newValue);
    setCursorPos(wordStart);
  }, [currentValue, cursorPos, updateValue]);

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (isDisabled) return;

      // Home - go to beginning of line
      if (key.home) {
        setCursorPos(0);
        return;
      }

      // End - go to end of line
      if (key.end) {
        setCursorPos(currentValue.length);
        return;
      }

      // Handle Ctrl+W - delete word before cursor
      if (key.ctrl && input === 'w') {
        deleteWordBeforeCursor();
        return;
      }

      // Handle Ctrl+U - clear line before cursor
      if (key.ctrl && input === 'u') {
        const newValue = currentValue.slice(cursorPos);
        updateValue(newValue);
        setCursorPos(0);
        return;
      }

      // Handle Ctrl+K - clear line after cursor
      if (key.ctrl && input === 'k') {
        const newValue = currentValue.slice(0, cursorPos);
        updateValue(newValue);
        return;
      }

      // Handle Ctrl+A - go to beginning
      if (key.ctrl && input === 'a') {
        setCursorPos(0);
        return;
      }

      // Handle Ctrl+D - delete character at cursor (since Delete key doesn't work reliably)
      if (key.ctrl && input === 'd') {
        if (cursorPos < currentValue.length) {
          const newValue = currentValue.slice(0, cursorPos) + currentValue.slice(cursorPos + 1);
          updateValue(newValue);
          // Cursor stays in place
        }
        return;
      }

      // Handle Ctrl+E - go to end (note: also triggers editor in useKeyBindings)
      // Skip - let useKeyBindings handle it

      // Backspace/Delete handling using shared hook
      if (key.backspace || key.delete) {
        const { isBackspace, isDelete } = detectKey();

        if (isBackspace && cursorPos > 0) {
          // Backspace - delete character before cursor
          const newValue = currentValue.slice(0, cursorPos - 1) + currentValue.slice(cursorPos);
          updateValue(newValue);
          setCursorPos(cursorPos - 1);
          return;
        }

        if (isDelete && cursorPos < currentValue.length) {
          // Delete - delete character at cursor
          const newValue = currentValue.slice(0, cursorPos) + currentValue.slice(cursorPos + 1);
          updateValue(newValue);
          return;
        }
        return;
      }

      // Skip other Ctrl+letter shortcuts - they're handled by useKeyBindings
      if (key.ctrl) {
        return;
      }

      // Submit on Enter (but not when autocomplete is active - it handles Enter)
      if (key.return) {
        if (autocompleteActive) {
          // Let AutocompletePopup handle Enter
          return;
        }
        const trimmed = currentValue.trim();
        if (trimmed) {
          onSubmit(trimmed);
          updateValue('');
          setCursorPos(0);
          historyIndexRef.current = -1;
          savedInputRef.current = '';
        }
        return;
      }

      // Arrow left
      if (key.leftArrow) {
        setCursorPos(Math.max(0, cursorPos - 1));
        return;
      }

      // Arrow right
      if (key.rightArrow) {
        setCursorPos(Math.min(currentValue.length, cursorPos + 1));
        return;
      }

      // Arrow up - history navigation
      if (key.upArrow) {
        if (history.length === 0) return;

        // Save current input when starting to navigate
        if (historyIndexRef.current === -1) {
          savedInputRef.current = currentValue;
        }

        if (historyIndexRef.current < history.length - 1) {
          historyIndexRef.current++;
          const histValue = history[historyIndexRef.current] ?? '';
          updateValue(histValue);
          setCursorPos(histValue.length);
        }
        return;
      }

      // Arrow down - history navigation
      if (key.downArrow) {
        if (historyIndexRef.current === -1) return;

        historyIndexRef.current--;

        if (historyIndexRef.current === -1) {
          // Back to saved input
          updateValue(savedInputRef.current);
          setCursorPos(savedInputRef.current.length);
        } else {
          const histValue = history[historyIndexRef.current] ?? '';
          updateValue(histValue);
          setCursorPos(histValue.length);
        }
        return;
      }

      // Home - go to start
      if (key.meta && key.leftArrow) {
        setCursorPos(0);
        return;
      }

      // End - go to end
      if (key.meta && key.rightArrow) {
        setCursorPos(currentValue.length);
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        // Reset history navigation on new input
        if (historyIndexRef.current !== -1) {
          historyIndexRef.current = -1;
          savedInputRef.current = '';
        }

        const newValue = currentValue.slice(0, cursorPos) + input + currentValue.slice(cursorPos);
        updateValue(newValue);
        setCursorPos(cursorPos + input.length);
      }
    },
    { isActive: !isDisabled },
  );

  // Render value with cursor (uses cursorVisible from useCursor for blinking)
  const renderInputWithCursor = () => {
    if (!currentValue && placeholder) {
      // Show cursor even with placeholder
      return (
        <Text>
          {cursorVisible ? <Text inverse> </Text> : <Text> </Text>}
          <Text dimColor>{placeholder}</Text>
        </Text>
      );
    }

    const beforeCursor = currentValue.slice(0, cursorPos);
    const atCursor = currentValue[cursorPos] || ' ';
    const afterCursor = currentValue.slice(cursorPos + 1);

    return (
      <Text>
        {beforeCursor}
        {cursorVisible ? <Text inverse>{atCursor}</Text> : <Text>{atCursor}</Text>}
        {afterCursor}
      </Text>
    );
  };

  return (
    <Box borderStyle="round" borderColor={borderColor} paddingX={1} width="100%">
      <Text color="green" bold>
        {prompt}{' '}
      </Text>
      <Box flexGrow={1}>{renderInputWithCursor()}</Box>
    </Box>
  );
}
