/**
 * History Picker Component
 *
 * Modal for browsing and selecting from command history.
 * Arrow keys to navigate, Enter to select, Escape to close.
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { HistoryReader } from '../../collections/history/index.js';
import type { HistoryEntry, HttpEntry } from '../../collections/history/types.js';

/**
 * History item
 */
export interface HistoryItem {
  /** Command text */
  command: string;
  /** When the command was executed */
  timestamp?: Date;
  /** Status code if it was an HTTP request */
  status?: number;
}

/**
 * Props for HistoryPicker component
 */
export interface HistoryPickerProps {
  /** List of history items (most recent first) - session history */
  items: HistoryItem[];
  /** Callback when an item is selected */
  onSelect: (command: string) => void;
  /** Callback when picker should close */
  onClose: () => void;
  /** Maximum height for the picker */
  maxHeight?: number;
  /** History reader for loading persistent history from NDJSON file */
  historyReader?: HistoryReader;
}

/**
 * Format timestamp for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get status color
 */
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'green';
  if (status >= 300 && status < 400) return 'yellow';
  if (status >= 400) return 'red';
  return 'white';
}

/**
 * Check if entry is an HTTP entry
 */
function isHttpEntry(entry: HistoryEntry): entry is HttpEntry {
  return entry.type === 'http';
}

/**
 * Convert HistoryEntry to HistoryItem for display
 */
function entryToItem(entry: HistoryEntry): HistoryItem {
  if (isHttpEntry(entry)) {
    return {
      command: `${entry.method.toLowerCase()} ${entry.url}`,
      timestamp: new Date(entry.timestamp),
      status: entry.status ?? undefined,
    };
  }
  // CmdEntry
  return {
    command: [entry.command, ...entry.args].join(' '),
    timestamp: new Date(entry.timestamp),
  };
}

/**
 * History Picker
 *
 * Modal for browsing command history.
 * Features:
 * - Arrow keys to navigate
 * - Enter to select
 * - Escape to close
 * - Shows command with timestamp and status
 *
 * @example
 * ```tsx
 * <HistoryPicker
 *   items={[
 *     { command: 'get /users', timestamp: new Date(), status: 200 },
 *     { command: 'post /users', timestamp: new Date(), status: 201 },
 *   ]}
 *   onSelect={(cmd) => setInput(cmd)}
 *   onClose={() => setShowHistory(false)}
 * />
 * ```
 */
export function HistoryPicker({
  items,
  onSelect,
  onClose,
  maxHeight = 15,
  historyReader,
}: HistoryPickerProps): ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(!!historyReader);
  const [persistentItems, setPersistentItems] = useState<HistoryItem[]>([]);

  // Load persistent history from NDJSON file
  useEffect(() => {
    if (!historyReader) {
      return;
    }

    // Capture narrowed type for async closure
    const reader = historyReader;
    let mounted = true;

    async function loadHistory() {
      try {
        const result = await reader.list(100); // Load up to 100 entries
        if (mounted) {
          const loadedItems = result.entries.map((e) => entryToItem(e.entry));
          setPersistentItems(loadedItems);
          setIsLoading(false);
        }
      } catch {
        // Silently fail - fall back to session history
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      mounted = false;
    };
  }, [historyReader]);

  // Use persistent history if available, otherwise fall back to session items
  const displayedItems = historyReader ? persistentItems : items;

  const visibleItems = maxHeight - 4; // Account for header and footer
  const maxScroll = Math.max(0, displayedItems.length - visibleItems);

  // Handle keyboard input
  useInput(
    useCallback(
      (input, key) => {
        if (key.escape) {
          onClose();
          return;
        }

        if (key.return) {
          if (displayedItems.length > 0 && displayedItems[selectedIndex]) {
            onSelect(displayedItems[selectedIndex].command);
            onClose();
          }
          return;
        }

        // Navigation
        if (key.upArrow || input === 'k') {
          setSelectedIndex((prev) => {
            const newIndex = Math.max(0, prev - 1);
            // Scroll up if needed
            if (newIndex < scrollOffset) {
              setScrollOffset(newIndex);
            }
            return newIndex;
          });
          return;
        }

        if (key.downArrow || input === 'j') {
          setSelectedIndex((prev) => {
            const newIndex = Math.min(displayedItems.length - 1, prev + 1);
            // Scroll down if needed
            if (newIndex >= scrollOffset + visibleItems) {
              setScrollOffset(Math.min(maxScroll, newIndex - visibleItems + 1));
            }
            return newIndex;
          });
          return;
        }

        // Page navigation
        if (key.pageUp) {
          setSelectedIndex((prev) => {
            const newIndex = Math.max(0, prev - visibleItems);
            setScrollOffset(Math.max(0, scrollOffset - visibleItems));
            return newIndex;
          });
          return;
        }

        if (key.pageDown) {
          setSelectedIndex((prev) => {
            const newIndex = Math.min(displayedItems.length - 1, prev + visibleItems);
            setScrollOffset(Math.min(maxScroll, scrollOffset + visibleItems));
            return newIndex;
          });
          return;
        }
      },
      [displayedItems, selectedIndex, onSelect, onClose, scrollOffset, visibleItems, maxScroll],
    ),
  );

  // Slice items for display
  const visibleDisplayItems = displayedItems.slice(scrollOffset, scrollOffset + visibleItems);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} width="100%" height={maxHeight}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box gap={1}>
          <Text bold color="yellow">
            History
          </Text>
          {isLoading ? (
            <Text dimColor>Loading...</Text>
          ) : (
            displayedItems.length > 0 && (
              <Text dimColor>
                ({selectedIndex + 1}/{displayedItems.length})
              </Text>
            )
          )}
        </Box>
        <Text dimColor>[Esc] Close · [Enter] Select</Text>
      </Box>

      {/* Items */}
      <Box flexDirection="column" flexGrow={1}>
        {isLoading ? (
          <Text dimColor>Loading history...</Text>
        ) : visibleDisplayItems.length > 0 ? (
          visibleDisplayItems.map((item, index) => {
            const actualIndex = scrollOffset + index;
            const isSelected = actualIndex === selectedIndex;

            return (
              <Box key={actualIndex} gap={1}>
                <Text color={isSelected ? 'yellow' : undefined}>{isSelected ? '>' : ' '}</Text>
                <Text color={isSelected ? 'yellow' : undefined} bold={isSelected} wrap="truncate">
                  {item.command}
                </Text>
                <Box flexGrow={1} />
                {item.status && (
                  <Text color={getStatusColor(item.status)} dimColor={!isSelected}>
                    {item.status}
                  </Text>
                )}
                {item.timestamp && <Text dimColor>{formatTime(item.timestamp)}</Text>}
              </Box>
            );
          })
        ) : (
          <Text dimColor>No history</Text>
        )}
      </Box>

      {/* Scroll indicator */}
      {displayedItems.length > visibleItems && (
        <Box marginTop={1}>
          <Text dimColor>↑↓ navigate · PgUp/PgDn page</Text>
        </Box>
      )}
    </Box>
  );
}
