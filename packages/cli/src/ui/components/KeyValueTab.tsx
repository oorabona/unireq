/**
 * KeyValueTab — renders the Headers or Variables tab of ProfileConfigModal
 *
 * Displays key-value pairs with navigation, inline editing, and add/delete support.
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import type { ColorSettings } from '../../workspace/settings/types.js';
import type { KeyValueItem } from './ProfileConfigTypes.js';

export interface KeyValueTabProps {
  /** 'headers' or 'variables' — controls separator char and placeholder text */
  tabId: 'headers' | 'variables';
  items: KeyValueItem[];
  selectedIndex: number;
  editingField: string | null;
  addingKey: boolean;
  newKey: string;
  colors: ColorSettings;
  renderInput: (placeholder: string) => ReactNode;
}

/**
 * Key-value tab content for ProfileConfigModal.
 *
 * Handles add-new flow (key entry → value entry), existing-item editing,
 * and truncation of long values.
 */
export function KeyValueTab({
  tabId,
  items,
  selectedIndex,
  editingField,
  addingKey,
  newKey,
  renderInput,
}: KeyValueTabProps): ReactNode {
  const separator = tabId === 'headers' ? ':' : '=';
  const keyPlaceholder = tabId === 'headers' ? 'Header-Name' : 'variable_name';
  const valuePlaceholder = 'value';

  return (
    <Box flexDirection="column">
      {items.length === 1 && items[0]?.isAddNew && (
        <Box marginBottom={1}>
          <Text dimColor>No {tabId} configured</Text>
        </Box>
      )}

      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const isEditingThis = !item.isAddNew && editingField === item.key;

        if (item.isAddNew) {
          if (addingKey) {
            return (
              <Box key="__add__" gap={1}>
                <Text color="green" bold>
                  +
                </Text>
                <Text>{renderInput(keyPlaceholder)}</Text>
              </Box>
            );
          }
          if (editingField === 'new-value') {
            return (
              <Box key="__add__" gap={1}>
                <Text color="green" bold>
                  +
                </Text>
                <Text>{newKey}</Text>
                <Text dimColor> {separator} </Text>
                <Text>{renderInput(valuePlaceholder)}</Text>
              </Box>
            );
          }
          return (
            <Box key="__add__" gap={1}>
              <Text color={isSelected ? 'cyan' : 'green'} bold={isSelected}>
                + Add new
              </Text>
              {isSelected && <Text dimColor>← enter</Text>}
            </Box>
          );
        }

        // Existing item
        const displayValue = item.value.length > 30 ? `${item.value.slice(0, 27)}...` : item.value;

        return (
          <Box key={item.key} gap={1}>
            {/* Key */}
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {item.key}
            </Text>

            <Text dimColor> {separator} </Text>

            {/* Value */}
            {isEditingThis ? (
              <Text>
                <Text color="cyan">[</Text>
                {renderInput(valuePlaceholder)}
                <Text color="cyan">]</Text>
              </Text>
            ) : (
              <Text dimColor>{displayValue}</Text>
            )}

            {/* Hint */}
            {isSelected && !isEditingThis && <Text dimColor>← enter edit · d delete</Text>}
          </Box>
        );
      })}
    </Box>
  );
}
