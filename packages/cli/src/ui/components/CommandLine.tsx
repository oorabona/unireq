/**
 * CommandLine Component
 *
 * Input field for entering commands with autocomplete support.
 * Uses @inkjs/ui TextInput for rich input handling.
 */

import { TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { type ReactNode, useState } from 'react';

export interface CommandLineProps {
  /** Called when user presses Enter */
  onSubmit: (value: string) => void;
  /** Called when input value changes (for autocomplete) */
  onChange?: (value: string) => void;
  /** Prompt string to display */
  prompt?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Autocomplete suggestions */
  suggestions?: string[];
  /** Whether input is disabled */
  isDisabled?: boolean;
}

/**
 * CommandLine component
 *
 * Renders an input prompt with optional autocomplete suggestions.
 * Uses uncontrolled TextInput from @inkjs/ui.
 */
export function CommandLine({
  onSubmit,
  onChange,
  prompt = 'unireq>',
  placeholder = 'Type a command...',
  suggestions = [],
  isDisabled = false,
}: CommandLineProps): ReactNode {
  // Key to reset input after submit
  const [inputKey, setInputKey] = useState(0);

  const handleSubmit = (value: string): void => {
    if (value.trim()) {
      onSubmit(value.trim());
      // Reset input by changing key
      setInputKey((k) => k + 1);
    }
  };

  return (
    <Box>
      <Text color="green" bold>
        {prompt}{' '}
      </Text>
      <TextInput
        key={inputKey}
        placeholder={placeholder}
        suggestions={suggestions}
        onChange={onChange}
        onSubmit={handleSubmit}
        isDisabled={isDisabled}
      />
    </Box>
  );
}
