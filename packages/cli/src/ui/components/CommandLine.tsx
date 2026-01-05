/**
 * CommandLine Component
 *
 * Simple input field for entering commands.
 * Uses custom input handling instead of @inkjs/ui TextInput
 * to avoid issues with built-in suggestion rendering.
 */

import { Box, Text, useInput, useStdin } from 'ink';
import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

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
}: CommandLineProps): ReactNode {
  // Internal value state (for uncontrolled mode)
  const [internalValue, setInternalValue] = useState('');

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

  // Track raw key code to distinguish Backspace (\x7f) from Delete (\x1b[3~)
  // Ink reports both as key.delete=true, but raw stdin has the actual characters
  const lastRawKeyRef = useRef<string | null>(null);
  const { stdin } = useStdin();

  useEffect(() => {
    if (!stdin) return;

    const handleData = (data: string | Buffer) => {
      // Convert to string if Buffer
      lastRawKeyRef.current = typeof data === 'string' ? data : data.toString();
    };

    stdin.on('data', handleData);
    return () => {
      stdin.off('data', handleData);
    };
  }, [stdin]);

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

      // Backspace/Delete handling
      // Ink reports both as key.delete=true, so we check the raw stdin data:
      // - Backspace sends \x7f (single byte, value 127)
      // - Delete sends \x1b[3~ (4 bytes escape sequence)
      // Note: stdin data comes as string, not Buffer, so use charCodeAt()
      if (key.backspace || key.delete) {
        const rawKey = lastRawKeyRef.current;
        const firstCharCode = rawKey ? rawKey.charCodeAt(0) : 0;
        const isBackspace = rawKey && rawKey.length === 1 && firstCharCode === 0x7f;
        const isRealDelete = rawKey && rawKey.length === 4 && firstCharCode === 0x1b;

        if (key.backspace || isBackspace) {
          // Backspace - delete character before cursor
          if (cursorPos > 0) {
            const newValue = currentValue.slice(0, cursorPos - 1) + currentValue.slice(cursorPos);
            updateValue(newValue);
            setCursorPos(cursorPos - 1);
          }
        } else if (isRealDelete) {
          // Delete - delete character at cursor
          if (cursorPos < currentValue.length) {
            const newValue = currentValue.slice(0, cursorPos) + currentValue.slice(cursorPos + 1);
            updateValue(newValue);
            // Cursor stays in place
          }
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

  // Render value with cursor
  const renderInputWithCursor = () => {
    if (!currentValue && placeholder) {
      return <Text dimColor>{placeholder}</Text>;
    }

    const beforeCursor = currentValue.slice(0, cursorPos);
    const atCursor = currentValue[cursorPos] || ' ';
    const afterCursor = currentValue.slice(cursorPos + 1);

    return (
      <Text>
        {beforeCursor}
        <Text inverse>{atCursor}</Text>
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
