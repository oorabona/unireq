/**
 * Key-Value List Modal Component
 *
 * Modal for managing a list of key-value pairs (headers, variables).
 * Supports add, edit, and delete operations.
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useRawKeyDetection } from '../hooks/useRawKeyDetection.js';
import { Modal } from './Modal.js';

/**
 * Props for KeyValueListModal component
 */
export interface KeyValueListModalProps {
  /** Modal title */
  title: string;
  /** Current key-value pairs */
  items: Record<string, string>;
  /** Placeholder for new key input */
  keyPlaceholder?: string;
  /** Placeholder for value input */
  valuePlaceholder?: string;
  /** Separator between key and value for display */
  separator?: string;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when an item is added or updated */
  onSave: (key: string, value: string) => void;
  /** Callback when an item is deleted */
  onDelete: (key: string) => void;
}

/**
 * Mode states for the modal
 */
type ModalMode = 'list' | 'addKey' | 'addValue' | 'editValue';

/**
 * List item for rendering
 */
interface ListItem {
  key: string;
  value: string;
  isAddNew: boolean;
}

/**
 * Key-Value List Modal
 *
 * Modal for managing key-value pairs with:
 * - Arrow navigation
 * - Enter to add/edit
 * - Delete/Backspace to remove items
 * - Inline editing
 */
export function KeyValueListModal({
  title,
  items,
  keyPlaceholder = 'key',
  valuePlaceholder = 'value',
  separator = ':',
  onClose,
  onSave,
  onDelete,
}: KeyValueListModalProps): ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<ModalMode>('list');
  const [editValue, setEditValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [newKey, setNewKey] = useState('');

  // Use shared hook for Backspace/Delete detection
  const { detectKey } = useRawKeyDetection();

  // Build list items (existing + "Add new" option)
  const listItems = useMemo((): ListItem[] => {
    const result: ListItem[] = Object.entries(items).map(([key, value]) => ({
      key,
      value,
      isAddNew: false,
    }));
    // Add "new" option at the end
    result.push({ key: '', value: '', isAddNew: true });
    return result;
  }, [items]);

  // Ensure selectedIndex is in bounds
  const safeIndex = Math.min(selectedIndex, listItems.length - 1);

  // Start adding a new item
  const startAdd = useCallback(() => {
    setEditValue('');
    setCursorPos(0);
    setNewKey('');
    setMode('addKey');
  }, []);

  // Start editing an existing item's value
  const startEdit = useCallback(
    (index: number) => {
      const item = listItems[index];
      if (!item || item.isAddNew) return;

      setEditValue(item.value);
      setCursorPos(item.value.length);
      setMode('editValue');
    },
    [listItems],
  );

  // Delete an item
  const deleteItem = useCallback(
    (index: number) => {
      const item = listItems[index];
      if (!item || item.isAddNew) return;

      onDelete(item.key);
      // Adjust selection if needed
      if (safeIndex >= listItems.length - 1) {
        setSelectedIndex(Math.max(0, listItems.length - 2));
      }
    },
    [listItems, safeIndex, onDelete],
  );

  // Save the current edit
  const saveEdit = useCallback(() => {
    const item = listItems[safeIndex];
    if (!item) return;

    if (mode === 'addKey') {
      // Move to value input
      const key = editValue.trim();
      if (key) {
        setNewKey(key);
        setEditValue('');
        setCursorPos(0);
        setMode('addValue');
      }
      return;
    }

    if (mode === 'addValue') {
      // Save new item
      const value = editValue.trim();
      if (newKey && value) {
        onSave(newKey, value);
      }
      setNewKey('');
      setEditValue('');
      setCursorPos(0);
      setMode('list');
      return;
    }

    if (mode === 'editValue') {
      // Save edited value
      const value = editValue.trim();
      if (value) {
        onSave(item.key, value);
      }
      setEditValue('');
      setCursorPos(0);
      setMode('list');
    }
  }, [mode, editValue, newKey, listItems, safeIndex, onSave]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditValue('');
    setCursorPos(0);
    setNewKey('');
    setMode('list');
  }, []);

  // Handle keyboard input
  useInput(
    useCallback(
      (char, key) => {
        const isEditing = mode !== 'list';

        // Escape - cancel edit or close modal
        if (key.escape) {
          if (isEditing) {
            cancelEdit();
          } else {
            onClose();
          }
          return;
        }

        // When editing
        if (isEditing) {
          // Enter - save
          if (key.return) {
            saveEdit();
            return;
          }

          // Backspace/Delete detection using shared hook
          if (key.backspace || key.delete) {
            const { isBackspace, isDelete } = detectKey();

            if (isBackspace && cursorPos > 0) {
              const newValue = editValue.slice(0, cursorPos - 1) + editValue.slice(cursorPos);
              setEditValue(newValue);
              setCursorPos(cursorPos - 1);
              return;
            }

            if (isDelete && cursorPos < editValue.length) {
              const newValue = editValue.slice(0, cursorPos) + editValue.slice(cursorPos + 1);
              setEditValue(newValue);
              return;
            }
          }

          // Ctrl+H as alternative backspace, Ctrl+D as alternative delete
          if (key.ctrl && char === 'h' && cursorPos > 0) {
            const newValue = editValue.slice(0, cursorPos - 1) + editValue.slice(cursorPos);
            setEditValue(newValue);
            setCursorPos(cursorPos - 1);
            return;
          }
          if (key.ctrl && char === 'd' && cursorPos < editValue.length) {
            const newValue = editValue.slice(0, cursorPos) + editValue.slice(cursorPos + 1);
            setEditValue(newValue);
            return;
          }

          // Left arrow
          if (key.leftArrow) {
            setCursorPos(Math.max(0, cursorPos - 1));
            return;
          }

          // Right arrow
          if (key.rightArrow) {
            setCursorPos(Math.min(editValue.length, cursorPos + 1));
            return;
          }

          // Regular character input (exclude control characters)
          const isPrintable =
            char && char.charCodeAt(0) >= 32 && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow;
          if (isPrintable) {
            const newValue = editValue.slice(0, cursorPos) + char + editValue.slice(cursorPos);
            setEditValue(newValue);
            setCursorPos(cursorPos + char.length);
          }
          return;
        }

        // When in list mode

        // Up arrow
        if (key.upArrow) {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : listItems.length - 1));
          return;
        }

        // Down arrow
        if (key.downArrow) {
          setSelectedIndex((prev) => (prev < listItems.length - 1 ? prev + 1 : 0));
          return;
        }

        // Enter - add or edit
        if (key.return) {
          const item = listItems[safeIndex];
          if (item?.isAddNew) {
            startAdd();
          } else {
            startEdit(safeIndex);
          }
          return;
        }

        // Delete list item with 'd', 'x' (vim-style), or Backspace/Delete keys
        if (char === 'd' || char === 'x' || key.backspace || key.delete) {
          const item = listItems[safeIndex];
          if (item && !item.isAddNew) {
            deleteItem(safeIndex);
          }
          return;
        }

        // Q to quit
        if (char === 'q' || char === 'Q') {
          onClose();
        }
      },
      [
        mode,
        editValue,
        cursorPos,
        listItems,
        safeIndex,
        cancelEdit,
        saveEdit,
        startAdd,
        startEdit,
        deleteItem,
        onClose,
      ],
    ),
  );

  // Render input with cursor
  const renderInputWithCursor = (placeholder: string) => {
    if (!editValue) {
      return (
        <Text>
          <Text dimColor>{placeholder}</Text>
          <Text inverse> </Text>
        </Text>
      );
    }

    const beforeCursor = editValue.slice(0, cursorPos);
    const atCursor = editValue[cursorPos] || ' ';
    const afterCursor = editValue.slice(cursorPos + 1);

    return (
      <Text>
        {beforeCursor}
        <Text inverse>{atCursor}</Text>
        {afterCursor}
      </Text>
    );
  };

  // Render a list item
  const renderItem = (item: ListItem, index: number) => {
    const isSelected = index === safeIndex;
    const indicator = isSelected ? '>' : ' ';

    if (item.isAddNew) {
      // "Add new" row
      if (mode === 'addKey' && isSelected) {
        return (
          <Box key="__add__">
            <Text color="magenta" bold>
              {indicator}{' '}
            </Text>
            <Text color="green">+ </Text>
            {renderInputWithCursor(keyPlaceholder)}
          </Box>
        );
      }

      if (mode === 'addValue' && isSelected) {
        return (
          <Box key="__add__">
            <Text color="magenta" bold>
              {indicator}{' '}
            </Text>
            <Text color="green">+ </Text>
            <Text>{newKey}</Text>
            <Text dimColor>{separator} </Text>
            {renderInputWithCursor(valuePlaceholder)}
          </Box>
        );
      }

      return (
        <Box key="__add__">
          <Text color={isSelected ? 'magenta' : undefined} bold={isSelected}>
            {indicator}{' '}
          </Text>
          <Text color="green">+ Add new</Text>
        </Box>
      );
    }

    // Existing item
    if (mode === 'editValue' && isSelected) {
      return (
        <Box key={item.key}>
          <Text color="magenta" bold>
            {indicator}{' '}
          </Text>
          <Text>{item.key}</Text>
          <Text dimColor>{separator} </Text>
          {renderInputWithCursor(valuePlaceholder)}
        </Box>
      );
    }

    const displayValue = item.value.length > 40 ? `${item.value.slice(0, 37)}...` : item.value;

    return (
      <Box key={item.key}>
        <Text color={isSelected ? 'magenta' : undefined} bold={isSelected}>
          {indicator}{' '}
        </Text>
        <Text bold={isSelected}>{item.key}</Text>
        <Text dimColor>{separator} </Text>
        <Text dimColor>{displayValue}</Text>
      </Box>
    );
  };

  // Help text based on mode
  let helpText: string;
  if (mode === 'addKey') {
    helpText = `Enter ${keyPlaceholder} · Escape to cancel`;
  } else if (mode === 'addValue' || mode === 'editValue') {
    helpText = 'Enter to save · Escape to cancel';
  } else {
    helpText = '↑↓ navigate · Enter edit · d/x delete · Esc close';
  }

  // Force remount when item count changes to ensure shadow recalculates
  const itemCount = Object.keys(items).length;

  return (
    <Modal
      key={`modal-${itemCount}`}
      title={title}
      titleColor="cyan"
      borderColor="cyan"
      footer={helpText}
      minWidth={52}
    >
      <Box flexDirection="column">
        {listItems.length === 1 && listItems[0]?.isAddNew ? (
          <Box marginBottom={1}>
            <Text dimColor italic>
              No items yet
            </Text>
          </Box>
        ) : null}
        {listItems.map((item, index) => renderItem(item, index))}
      </Box>
    </Modal>
  );
}
