/**
 * Autocomplete Inline Component
 *
 * Shows autocomplete suggestions on a single line below the command line.
 * Tab cycles through options, Enter/Space selects.
 * Shell-style inline completion.
 */

import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useState } from 'react';

// React is needed for JSX transformation with tsx
void React;

/**
 * Autocomplete suggestion
 */
export interface AutocompleteSuggestion {
  /** Display text */
  label: string;
  /** Value to insert when selected */
  value: string;
  /** Optional description */
  description?: string;
  /** Type of suggestion for styling */
  type?: 'path' | 'command' | 'method' | 'variable';
}

/**
 * Props for AutocompletePopup component
 */
export interface AutocompletePopupProps {
  /** List of suggestions to display */
  suggestions: AutocompleteSuggestion[];
  /** Callback when a suggestion is selected */
  onSelect: (value: string) => void;
  /** Callback when popup should close */
  onClose: () => void;
  /** Maximum number of items to display */
  maxItems?: number;
  /** Whether the popup is visible */
  isVisible?: boolean;
}

/**
 * Get color for suggestion type
 */
function getTypeColor(type: AutocompleteSuggestion['type']): string | undefined {
  switch (type) {
    case 'path':
      return 'cyan';
    case 'command':
      return 'green';
    case 'method':
      return 'yellow';
    case 'variable':
      return 'magenta';
    default:
      return undefined;
  }
}

/**
 * Autocomplete Inline
 *
 * Shows suggestions on a single line. Tab cycles, Enter selects.
 * Shell-style completion that doesn't push layout around much.
 *
 * @example
 * ```tsx
 * <AutocompletePopup
 *   suggestions={[
 *     { label: 'help', value: 'help', type: 'command' },
 *     { label: 'history', value: 'history', type: 'command' },
 *   ]}
 *   onSelect={(value) => setInput(value)}
 *   onClose={() => setShowAutocomplete(false)}
 * />
 * ```
 */
export function AutocompletePopup({
  suggestions,
  onSelect,
  onClose,
  maxItems = 8,
  isVisible = true,
}: AutocompletePopupProps): ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Handle keyboard input
  useInput(
    useCallback(
      (_input, key) => {
        if (!isVisible || suggestions.length === 0) return;

        if (key.escape) {
          onClose();
          return;
        }

        // Tab cycles through suggestions
        if (key.tab) {
          if (key.shift) {
            // Shift+Tab goes backwards
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          } else {
            // Tab goes forward
            setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          }
          return;
        }

        // Enter selects current suggestion
        if (key.return) {
          const selected = suggestions[selectedIndex];
          if (selected) {
            onSelect(selected.value);
          }
          return;
        }

        // Right arrow also selects (like shell)
        if (key.rightArrow) {
          const selected = suggestions[selectedIndex];
          if (selected) {
            onSelect(selected.value);
          }
          return;
        }
      },
      [isVisible, suggestions, selectedIndex, onSelect, onClose],
    ),
    { isActive: isVisible },
  );

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  // Limit displayed items
  const displayedSuggestions = suggestions.slice(0, maxItems);
  const hasMore = suggestions.length > maxItems;

  return (
    <Box flexDirection="row" gap={2} paddingLeft={2}>
      {displayedSuggestions.map((suggestion, index) => {
        const isSelected = index === selectedIndex;
        const typeColor = getTypeColor(suggestion.type);

        return (
          <Text
            key={suggestion.value}
            color={isSelected ? 'black' : typeColor}
            backgroundColor={isSelected ? 'yellow' : undefined}
            bold={isSelected}
          >
            {isSelected ? ` ${suggestion.label} ` : suggestion.label}
          </Text>
        );
      })}

      {hasMore && <Text dimColor>+{suggestions.length - maxItems}</Text>}

      <Text dimColor> (Tab: cycle, Enter: select)</Text>
    </Box>
  );
}
