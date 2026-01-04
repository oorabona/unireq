/**
 * Autocomplete Hook
 *
 * Provides autocomplete suggestions based on input context.
 * Integrates with OpenAPI specs, REPL commands, and HTTP methods.
 */

import { useCallback, useMemo, useState } from 'react';
import type { AutocompleteSuggestion } from '../components/AutocompletePopup.js';

/**
 * OpenAPI path info for autocomplete
 */
export interface PathInfo {
  /** Path template (e.g., /users/{id}) */
  path: string;
  /** Supported HTTP methods */
  methods: string[];
  /** Operation summary/description */
  description?: string;
}

/**
 * Autocomplete configuration
 */
export interface AutocompleteConfig {
  /** Available paths from OpenAPI spec */
  paths?: PathInfo[];
  /** Available REPL commands */
  commands?: string[];
  /** Current working directory (for relative path suggestions) */
  cwd?: string;
  /** Minimum characters before suggesting */
  minChars?: number;
  /** Maximum suggestions to return */
  maxSuggestions?: number;
}

/**
 * Autocomplete hook state
 */
export interface UseAutocompleteState {
  /** Current suggestions */
  suggestions: AutocompleteSuggestion[];
  /** Whether autocomplete is visible */
  isVisible: boolean;
  /** Update input and compute suggestions */
  updateInput: (input: string) => void;
  /** Show autocomplete */
  show: () => void;
  /** Hide autocomplete */
  hide: () => void;
  /** Select a suggestion */
  select: (value: string) => string;
}

/**
 * HTTP methods for autocomplete
 */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/**
 * Built-in REPL commands
 */
const BUILTIN_COMMANDS = [
  'help',
  'exit',
  'quit',
  'clear',
  'history',
  'cd',
  'ls',
  'pwd',
  'env',
  'set',
  'unset',
  'auth',
  'headers',
  'body',
  'spec',
  'workspace',
  'profile',
];

/**
 * Match input against paths
 */
function matchPaths(input: string, paths: PathInfo[]): AutocompleteSuggestion[] {
  const lowerInput = input.toLowerCase();

  return paths
    .filter((p) => p.path.toLowerCase().includes(lowerInput))
    .map((p) => ({
      label: p.path,
      value: p.path,
      type: 'path' as const,
      description: p.description || p.methods.join(', ').toUpperCase(),
    }));
}

/**
 * Match input against commands
 */
function matchCommands(input: string, commands: string[]): AutocompleteSuggestion[] {
  const lowerInput = input.toLowerCase();

  return commands
    .filter((c) => c.toLowerCase().startsWith(lowerInput))
    .map((c) => ({
      label: c,
      value: c,
      type: 'command' as const,
    }));
}

/**
 * Match input against HTTP methods
 */
function matchMethods(input: string): AutocompleteSuggestion[] {
  const lowerInput = input.toLowerCase();

  return HTTP_METHODS.filter((m) => m.toLowerCase().startsWith(lowerInput)).map((m) => ({
    label: m,
    value: m.toLowerCase(),
    type: 'method' as const,
  }));
}

/**
 * Parse input to determine context
 */
function parseInputContext(input: string): {
  type: 'method' | 'path' | 'command' | 'arg';
  value: string;
  prefix: string;
} {
  const trimmed = input.trimStart();
  const parts = trimmed.split(/\s+/);

  const firstPart = parts[0];
  if (parts.length === 0 || !firstPart || firstPart === '') {
    return { type: 'command', value: '', prefix: '' };
  }

  const firstWord = firstPart.toLowerCase();

  // If first word looks like a method, suggest paths
  if (HTTP_METHODS.map((m) => m.toLowerCase()).includes(firstWord)) {
    const pathPart = parts[1] || '';
    const prefix = `${parts.slice(0, 1).join(' ')} `;
    return { type: 'path', value: pathPart, prefix };
  }

  // If input starts with /, suggest paths
  if (trimmed.startsWith('/')) {
    return { type: 'path', value: trimmed, prefix: '' };
  }

  // If single word, could be method or command
  if (parts.length === 1) {
    // Check if it looks like a method prefix
    if (HTTP_METHODS.some((m) => m.toLowerCase().startsWith(firstWord))) {
      return { type: 'method', value: firstWord, prefix: '' };
    }
    return { type: 'command', value: firstWord, prefix: '' };
  }

  // Otherwise, suggest based on current word
  const lastPart = parts[parts.length - 1] || '';
  return { type: 'arg', value: lastPart, prefix: `${parts.slice(0, -1).join(' ')} ` };
}

/**
 * Compute suggestions for given input (pure function for testing)
 */
export function computeSuggestions(input: string, config: AutocompleteConfig = {}): AutocompleteSuggestion[] {
  const { paths = [], commands = BUILTIN_COMMANDS, minChars = 1, maxSuggestions = 10 } = config;

  if (input.length < minChars) {
    return [];
  }

  // Merge built-in and custom commands
  const allCommands = [...new Set([...BUILTIN_COMMANDS, ...commands])].sort();

  const context = parseInputContext(input);
  let results: AutocompleteSuggestion[] = [];

  switch (context.type) {
    case 'method':
      results = matchMethods(context.value);
      break;

    case 'path':
      results = matchPaths(context.value, paths);
      break;

    case 'command':
      // Show both commands and methods
      results = [...matchCommands(context.value, allCommands), ...matchMethods(context.value)];
      break;

    case 'arg':
      // Could suggest paths, variables, etc.
      if (context.value.startsWith('/')) {
        results = matchPaths(context.value, paths);
      }
      break;
  }

  return results.slice(0, maxSuggestions);
}

/**
 * Complete input with selected value (pure function for testing)
 */
export function completeInput(input: string, selectedValue: string): string {
  const context = parseInputContext(input);

  switch (context.type) {
    case 'path':
      return context.prefix + selectedValue;

    case 'method':
      return `${selectedValue} `;

    case 'command':
      return `${selectedValue} `;

    default:
      return context.prefix + selectedValue;
  }
}

/**
 * Hook for autocomplete functionality
 *
 * @example
 * ```tsx
 * function CommandLine() {
 *   const { suggestions, isVisible, updateInput, select, hide } = useAutocomplete({
 *     paths: spec?.paths,
 *     commands: ['help', 'exit', 'clear'],
 *   });
 *
 *   const handleChange = (value: string) => {
 *     setInput(value);
 *     updateInput(value);
 *   };
 *
 *   const handleSelect = (value: string) => {
 *     const completed = select(value);
 *     setInput(completed);
 *   };
 *
 *   return (
 *     <>
 *       <TextInput value={input} onChange={handleChange} />
 *       <AutocompletePopup
 *         suggestions={suggestions}
 *         isVisible={isVisible}
 *         onSelect={handleSelect}
 *         onClose={hide}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useAutocomplete(config: AutocompleteConfig = {}): UseAutocompleteState {
  const { minChars = 1 } = config;

  const [input, setInput] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  // Compute suggestions based on input
  const suggestions = useMemo(() => computeSuggestions(input, config), [input, config]);

  const updateInput = useCallback(
    (newInput: string) => {
      setInput(newInput);

      // Auto-show when there are suggestions
      const context = parseInputContext(newInput);
      if (newInput.length >= minChars && context.type !== 'arg') {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    },
    [minChars],
  );

  const show = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  const select = useCallback(
    (value: string): string => {
      const completed = completeInput(input, value);
      setInput(completed);
      setIsVisible(false);
      return completed;
    },
    [input],
  );

  return {
    suggestions,
    isVisible: isVisible && suggestions.length > 0,
    updateInput,
    show,
    hide,
    select,
  };
}
