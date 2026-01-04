/**
 * Autocomplete Popup Component
 *
 * Shows autocomplete suggestions below the command line.
 * Supports keyboard navigation and selection.
 */

import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

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
 * Autocomplete Popup
 *
 * Shows suggestions below input with keyboard navigation.
 * Features:
 * - Arrow keys/j/k to navigate
 * - Tab/Enter to select
 * - Escape to close
 * - Type-based coloring
 *
 * @example
 * ```tsx
 * <AutocompletePopup
 *   suggestions={[
 *     { label: '/users', value: '/users', type: 'path' },
 *     { label: '/users/{id}', value: '/users/{id}', type: 'path' },
 *   ]}
 *   onSelect={(value) => setInput(input + value)}
 *   onClose={() => setShowAutocomplete(false)}
 *   isVisible={showAutocomplete}
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
      (input, key) => {
        if (!isVisible || suggestions.length === 0) return;

        if (key.escape) {
          onClose();
          return;
        }

        if (key.tab || key.return) {
          const selected = suggestions[selectedIndex];
          if (selected) {
            onSelect(selected.value);
          }
          return;
        }

        // Navigation
        if (key.upArrow || input === 'k') {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          return;
        }

        if (key.downArrow || input === 'j') {
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
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
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
      {displayedSuggestions.map((suggestion, index) => {
        const isSelected = index === selectedIndex;
        const typeColor = getTypeColor(suggestion.type);

        return (
          <Box key={suggestion.value} gap={1}>
            <Text color={isSelected ? 'yellow' : undefined}>{isSelected ? '>' : ' '}</Text>
            <Text color={isSelected ? 'yellow' : typeColor} bold={isSelected}>
              {suggestion.label}
            </Text>
            {suggestion.description && (
              <>
                <Box flexGrow={1} />
                <Text dimColor>{suggestion.description}</Text>
              </>
            )}
          </Box>
        );
      })}

      {hasMore && <Text dimColor>... and {suggestions.length - maxItems} more</Text>}
    </Box>
  );
}
