/**
 * Autocomplete Hook
 *
 * Provides autocomplete suggestions based on input context.
 * Integrates with OpenAPI specs, REPL commands, HTTP methods,
 * subcommands, flags, and flag values.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  findFlagSchema,
  getCommandSchema,
  getSubcommandNames,
  getSubcommandSchema,
  hasSubcommands,
  type CommandSchema,
  type FlagSchema,
  type SubcommandSchema,
} from '../../repl/command-schema.js';
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
 * Extended context types for autocomplete
 */
export type ContextType = 'method' | 'path' | 'command' | 'subcommand' | 'flag' | 'flag_value' | 'arg';

/**
 * Extended context information for autocomplete
 */
export interface InputContext {
  /** Type of context for current word */
  type: ContextType;
  /** Current word being typed */
  value: string;
  /** Input prefix (everything before current word) */
  prefix: string;
  /** Command name (if identified) */
  command?: string;
  /** Subcommand name (if identified) */
  subcommand?: string;
  /** Flags already used in the input */
  usedFlags: string[];
  /** The flag that expects a value (for flag_value context) */
  pendingFlag?: string;
}

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
 * Match input against subcommands
 */
export function matchSubcommands(input: string, commandName: string): AutocompleteSuggestion[] {
  const subcommands = getSubcommandNames(commandName);
  const lowerInput = input.toLowerCase();

  return subcommands
    .filter((s) => s.toLowerCase().startsWith(lowerInput))
    .map((s) => {
      const subSchema = getSubcommandSchema(commandName, s);
      return {
        label: s,
        value: s,
        type: 'subcommand' as const,
        description: subSchema?.description,
      };
    });
}

/**
 * Match input against flags
 */
export function matchFlags(
  input: string,
  schema: CommandSchema | SubcommandSchema,
  usedFlags: string[],
): AutocompleteSuggestion[] {
  const flags = schema.flags ?? [];
  const lowerInput = input.toLowerCase();
  const results: AutocompleteSuggestion[] = [];

  for (const flag of flags) {
    // Check if flag is already used and not repeatable
    const isUsed =
      usedFlags.includes(flag.long) || (flag.short && usedFlags.includes(flag.short));

    if (isUsed && !flag.repeatable) {
      continue;
    }

    // Match short flag
    if (flag.short && flag.short.toLowerCase().startsWith(lowerInput)) {
      results.push({
        label: flag.short,
        value: flag.short,
        type: 'flag' as const,
        description: flag.description,
      });
    }

    // Match long flag
    if (flag.long.toLowerCase().startsWith(lowerInput)) {
      results.push({
        label: flag.long,
        value: flag.long,
        type: 'flag' as const,
        description: flag.description,
      });
    }
  }

  // Sort: short flags first, then long flags, alphabetically
  return results.sort((a, b) => {
    const aIsShort = a.label.length === 2;
    const bIsShort = b.label.length === 2;
    if (aIsShort && !bIsShort) return -1;
    if (!aIsShort && bIsShort) return 1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Match input against flag values
 */
export function matchFlagValues(input: string, flagSchema: FlagSchema): AutocompleteSuggestion[] {
  if (!flagSchema.values) {
    return [];
  }

  const lowerInput = input.toLowerCase();

  return flagSchema.values
    .filter((v) => v.toLowerCase().startsWith(lowerInput))
    .map((v) => ({
      label: v,
      value: v,
      type: 'value' as const,
    }));
}

/**
 * Parse flags from input string
 *
 * Returns array of flag strings used in the input (e.g., ["-H", "--output"])
 */
export function parseUsedFlags(parts: string[]): string[] {
  const usedFlags: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part?.startsWith('-')) {
      // Handle --flag=value syntax
      const flagPart = part.includes('=') ? part.split('=')[0] : part;
      if (flagPart) {
        usedFlags.push(flagPart);
      }
    }
  }

  return usedFlags;
}

/**
 * Parse input to determine extended context
 */
export function parseInputContext(input: string): InputContext {
  const trimmed = input.trimStart();
  const parts = trimmed.split(/\s+/);

  const firstPart = parts[0];
  if (parts.length === 0 || !firstPart || firstPart === '') {
    return { type: 'command', value: '', prefix: '', usedFlags: [] };
  }

  const firstWord = firstPart.toLowerCase();
  // Only include completed flags in usedFlags (exclude the current word being typed)
  const usedFlags = parseUsedFlags(parts.slice(0, -1));

  // If first word looks like an HTTP method, handle specially
  if (HTTP_METHODS.map((m) => m.toLowerCase()).includes(firstWord)) {
    return handleHttpMethodContext(parts, firstWord, usedFlags);
  }

  // If input starts with /, suggest paths
  if (trimmed.startsWith('/')) {
    return { type: 'path', value: trimmed, prefix: '', usedFlags: [] };
  }

  // If single word, could be method or command
  if (parts.length === 1) {
    if (HTTP_METHODS.some((m) => m.toLowerCase().startsWith(firstWord))) {
      return { type: 'method', value: firstWord, prefix: '', usedFlags: [] };
    }
    return { type: 'command', value: firstWord, prefix: '', usedFlags: [] };
  }

  // Get command schema
  const commandSchema = getCommandSchema(firstWord);
  const lastPart = parts[parts.length - 1] || '';
  const prefix = `${parts.slice(0, -1).join(' ')} `;

  // Check if command has subcommands
  if (hasSubcommands(firstWord)) {
    return handleSubcommandContext(parts, firstWord, commandSchema, usedFlags);
  }

  // Command without subcommands - check for flags
  if (commandSchema) {
    return handleFlagContext(parts, firstWord, undefined, commandSchema, usedFlags);
  }

  // Unknown command - fallback to arg context
  if (lastPart.startsWith('/')) {
    return { type: 'path', value: lastPart, prefix, usedFlags, command: firstWord };
  }

  return { type: 'arg', value: lastPart, prefix, usedFlags, command: firstWord };
}

/**
 * Handle context for HTTP method commands (get, post, etc.)
 */
function handleHttpMethodContext(parts: string[], method: string, usedFlags: string[]): InputContext {
  const commandSchema = getCommandSchema(method);

  // Second word: either path or flag
  if (parts.length === 2) {
    const secondPart = parts[1] || '';
    const prefix = `${parts[0]} `;

    // If second part starts with -, it's a flag
    if (secondPart.startsWith('-')) {
      return {
        type: 'flag',
        value: secondPart,
        prefix,
        command: method,
        usedFlags,
      };
    }

    // Otherwise it's a path
    return {
      type: 'path',
      value: secondPart,
      prefix,
      command: method,
      usedFlags,
    };
  }

  // More than 2 parts - check for flags and flag values
  const lastPart = parts[parts.length - 1] || '';
  const prefix = `${parts.slice(0, -1).join(' ')} `;

  // Check if previous part was a flag that takes a value
  if (parts.length >= 2) {
    const prevPart = parts[parts.length - 2];
    if (prevPart && commandSchema) {
      const prevFlag = findFlagSchema(commandSchema, prevPart);
      if (prevFlag?.takesValue && !lastPart.startsWith('-')) {
        return {
          type: 'flag_value',
          value: lastPart,
          prefix,
          command: method,
          usedFlags,
          pendingFlag: prevPart,
        };
      }
    }
  }

  // Current word is a flag
  if (lastPart.startsWith('-')) {
    return {
      type: 'flag',
      value: lastPart,
      prefix,
      command: method,
      usedFlags,
    };
  }

  // Could be a path or other arg
  if (lastPart.startsWith('/') || lastPart === '') {
    return {
      type: 'path',
      value: lastPart,
      prefix,
      command: method,
      usedFlags,
    };
  }

  return {
    type: 'arg',
    value: lastPart,
    prefix,
    command: method,
    usedFlags,
  };
}

/**
 * Handle context for commands with subcommands (workspace, profile, auth, etc.)
 */
function handleSubcommandContext(
  parts: string[],
  commandName: string,
  _commandSchema: CommandSchema | undefined,
  usedFlags: string[],
): InputContext {
  const prefix = `${parts.slice(0, -1).join(' ')} `;
  const lastPart = parts[parts.length - 1] || '';

  // Second word: subcommand
  if (parts.length === 2) {
    return {
      type: 'subcommand',
      value: lastPart,
      prefix: `${parts[0]} `,
      command: commandName,
      usedFlags,
    };
  }

  // Third or more words: check if subcommand exists
  const subcommandName = parts[1]?.toLowerCase();
  if (!subcommandName) {
    return { type: 'arg', value: lastPart, prefix, command: commandName, usedFlags };
  }

  const subcommandSchema = getSubcommandSchema(commandName, subcommandName);

  // If valid subcommand, check for flags
  if (subcommandSchema) {
    return handleFlagContext(parts, commandName, subcommandName, subcommandSchema, usedFlags);
  }

  // Invalid subcommand - fallback to arg
  return {
    type: 'arg',
    value: lastPart,
    prefix,
    command: commandName,
    subcommand: subcommandName,
    usedFlags,
  };
}

/**
 * Handle context for flag/flag_value detection
 */
function handleFlagContext(
  parts: string[],
  commandName: string,
  subcommandName: string | undefined,
  schema: CommandSchema | SubcommandSchema,
  usedFlags: string[],
): InputContext {
  const prefix = `${parts.slice(0, -1).join(' ')} `;
  const lastPart = parts[parts.length - 1] || '';

  // Check if previous part was a flag that takes a value
  if (parts.length >= 2) {
    const prevPart = parts[parts.length - 2];
    if (prevPart) {
      const prevFlag = findFlagSchema(schema, prevPart);
      if (prevFlag?.takesValue && !lastPart.startsWith('-')) {
        return {
          type: 'flag_value',
          value: lastPart,
          prefix,
          command: commandName,
          subcommand: subcommandName,
          usedFlags,
          pendingFlag: prevPart,
        };
      }
    }
  }

  // Current word is a flag
  if (lastPart.startsWith('-')) {
    return {
      type: 'flag',
      value: lastPart,
      prefix,
      command: commandName,
      subcommand: subcommandName,
      usedFlags,
    };
  }

  // Empty or other - show flags
  if (lastPart === '' && schema.flags && schema.flags.length > 0) {
    return {
      type: 'flag',
      value: '',
      prefix,
      command: commandName,
      subcommand: subcommandName,
      usedFlags,
    };
  }

  return {
    type: 'arg',
    value: lastPart,
    prefix,
    command: commandName,
    subcommand: subcommandName,
    usedFlags,
  };
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

    case 'subcommand':
      if (context.command) {
        results = matchSubcommands(context.value, context.command);
      }
      break;

    case 'flag': {
      // Get the appropriate schema (command or subcommand)
      let schema: CommandSchema | SubcommandSchema | undefined;
      if (context.command && context.subcommand) {
        schema = getSubcommandSchema(context.command, context.subcommand);
      } else if (context.command) {
        schema = getCommandSchema(context.command);
      }
      if (schema) {
        results = matchFlags(context.value, schema, context.usedFlags);
      }
      break;
    }

    case 'flag_value': {
      // Get flag schema and match values
      let schema: CommandSchema | SubcommandSchema | undefined;
      if (context.command && context.subcommand) {
        schema = getSubcommandSchema(context.command, context.subcommand);
      } else if (context.command) {
        schema = getCommandSchema(context.command);
      }
      if (schema && context.pendingFlag) {
        const flagSchema = findFlagSchema(schema, context.pendingFlag);
        if (flagSchema) {
          results = matchFlagValues(context.value, flagSchema);
        }
      }
      break;
    }

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

    case 'subcommand':
      return `${context.prefix}${selectedValue} `;

    case 'flag':
      return `${context.prefix}${selectedValue} `;

    case 'flag_value':
      return `${context.prefix}${selectedValue} `;

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

      // Auto-show when there are suggestions (for first word only)
      const context = parseInputContext(newInput);
      if (newInput.length >= minChars && (context.type === 'command' || context.type === 'method')) {
        setIsVisible(true);
      } else {
        // For subsequent words, require explicit Tab (hide auto-show)
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
