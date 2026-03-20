/**
 * ConnectionTab — renders the Connection tab of ProfileConfigModal
 *
 * Shows Base URL, Timeout, and Verify TLS fields with inline editing support.
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import type { ColorSettings } from '../../workspace/settings/types.js';
import type { PendingChanges } from './ProfileConfigTypes.js';
import { CONNECTION_FIELDS } from './ProfileConfigTypes.js';

export interface ConnectionTabProps {
  pending: PendingChanges;
  effectiveBaseUrl: string;
  effectiveTimeoutMs: number;
  effectiveVerifyTls: boolean;
  selectedIndex: number;
  editingField: string | null;
  colors: ColorSettings;
  renderInput: (placeholder: string) => ReactNode;
}

/**
 * Connection tab content for ProfileConfigModal.
 *
 * Renders the three connection fields (Base URL, Timeout, Verify TLS)
 * with selection highlight, modified indicator, and inline edit support.
 */
export function ConnectionTab({
  pending,
  effectiveBaseUrl,
  effectiveTimeoutMs,
  effectiveVerifyTls,
  selectedIndex,
  editingField,
  renderInput,
}: ConnectionTabProps): ReactNode {
  return (
    <Box flexDirection="column">
      {CONNECTION_FIELDS.map((field, index) => {
        const isSelected = index === selectedIndex;
        const isEditing = editingField === field.id;

        let value: string;
        let isModified = false;

        if (field.id === 'base-url') {
          value = effectiveBaseUrl || '(not set)';
          isModified = pending.baseUrl !== undefined;
        } else if (field.id === 'timeout') {
          value = `${effectiveTimeoutMs}ms`;
          isModified = pending.timeoutMs !== undefined;
        } else {
          value = effectiveVerifyTls ? 'Yes' : 'No';
          isModified = pending.verifyTls !== undefined;
        }

        return (
          <Box key={field.id} gap={1}>
            {/* Modified indicator */}
            <Text color="yellow" bold>
              {isModified ? '*' : ' '}
            </Text>

            {/* Label */}
            <Box width={12}>
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {field.label}
              </Text>
            </Box>

            {/* Value */}
            <Box minWidth={20}>
              {isEditing ? (
                <Text>
                  <Text color="cyan">[</Text>
                  {renderInput('Enter value...')}
                  <Text color="cyan">]</Text>
                </Text>
              ) : field.type === 'toggle' ? (
                <Text color={effectiveVerifyTls ? 'green' : 'gray'}>
                  [{effectiveVerifyTls ? '✓' : ' '}] {value}
                </Text>
              ) : (
                <Text color={isSelected ? 'cyan' : 'gray'}>[{value}]</Text>
              )}
            </Box>

            {/* Hint */}
            {isSelected && !isEditing && (
              <Text dimColor>{field.type === 'toggle' ? '← space/enter' : '← enter to edit'}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
