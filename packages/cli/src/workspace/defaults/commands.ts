/**
 * Defaults command handlers for REPL
 * View, get, set, and reset HTTP output defaults
 */

import { consola } from 'consola';
import type { Command, CommandHandler } from '../../repl/types.js';
import { getSourceDescription, resolveDefaultsWithSource } from './source-tracker.js';
import {
  HTTP_OUTPUT_DEFAULT_KEYS,
  type HttpOutputDefaultKey,
  isValidDefaultKey,
  isValidOutputMode,
  OUTPUT_MODE_VALUES,
  type ResolvedDefaults,
} from './types.js';

/**
 * Find the closest matching key for a typo
 */
function findSimilarKey(input: string): HttpOutputDefaultKey | undefined {
  const lower = input.toLowerCase();
  // Simple Levenshtein-like matching
  for (const key of HTTP_OUTPUT_DEFAULT_KEYS) {
    // Check if input is a substring or prefix
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return key;
    }
    // Check first few characters match
    if (key.toLowerCase().startsWith(lower.slice(0, 3))) {
      return key;
    }
  }
  return undefined;
}

/**
 * Format boolean or string value for display
 */
function formatValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

/**
 * Show all defaults with source tracking
 */
function showAllDefaults(resolved: ResolvedDefaults, sessionOverrideCount: number): void {
  consola.info('HTTP Output Defaults:');
  consola.log('');

  // Calculate column widths
  const keyWidth = Math.max(...HTTP_OUTPUT_DEFAULT_KEYS.map((k) => k.length)) + 2;
  const valueWidth = 10;

  // Header
  const header = `  ${'Key'.padEnd(keyWidth)} ${'Value'.padEnd(valueWidth)} Source`;
  consola.log(header);
  consola.log(`  ${'-'.repeat(keyWidth)} ${'-'.repeat(valueWidth)} ${'------'}`);

  // Rows
  for (const key of HTTP_OUTPUT_DEFAULT_KEYS) {
    const entry = resolved[key];
    const valueStr = formatValue(entry.value).padEnd(valueWidth);
    consola.log(`  ${key.padEnd(keyWidth)} ${valueStr} ${entry.source}`);
  }

  consola.log('');
  consola.info(`Session overrides: ${sessionOverrideCount}`);
}

/**
 * Show single default with detailed info
 */
function showSingleDefault(key: HttpOutputDefaultKey, resolved: ResolvedDefaults): void {
  const entry = resolved[key];
  consola.log(`${key} = ${formatValue(entry.value)}`);
  consola.log(`  Source: ${entry.source}`);
  consola.log(`  Config: ${getSourceDescription(entry.source)}`);
}

/**
 * Parse a value string to the appropriate type for a key
 */
function parseValue(key: HttpOutputDefaultKey, valueStr: string): boolean | 'pretty' | 'json' | 'raw' | null {
  if (key === 'outputMode') {
    if (!isValidOutputMode(valueStr)) {
      return null;
    }
    return valueStr;
  }

  // Boolean keys
  const lower = valueStr.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
    return true;
  }
  if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') {
    return false;
  }

  return null;
}

/**
 * Main defaults command handler
 */
export const defaultsHandler: CommandHandler = async (args, state) => {
  const subcommand = args[0]?.toLowerCase();

  // Resolve current defaults with source tracking
  const workspaceDefaults = state.workspaceConfig?.defaults;
  const activeProfileName = state.activeProfile;
  const profileDefaults = activeProfileName
    ? state.workspaceConfig?.profiles?.[activeProfileName]?.defaults
    : undefined;

  const resolved = resolveDefaultsWithSource(
    undefined, // No method context for general view
    workspaceDefaults,
    profileDefaults,
    activeProfileName,
    state.sessionDefaults,
  );

  const sessionOverrideCount = state.sessionDefaults ? Object.keys(state.sessionDefaults).length : 0;

  // No subcommand: show all
  if (!subcommand) {
    showAllDefaults(resolved, sessionOverrideCount);
    return;
  }

  // Handle subcommands
  switch (subcommand) {
    case 'get': {
      const key = args[1];
      if (!key) {
        consola.warn('Usage: defaults get <key>');
        consola.info(`Valid keys: ${HTTP_OUTPUT_DEFAULT_KEYS.join(', ')}`);
        return;
      }

      if (!isValidDefaultKey(key)) {
        const similar = findSimilarKey(key);
        consola.error(`Unknown key: ${key}`);
        if (similar) {
          consola.info(`Did you mean: ${similar}?`);
        } else {
          consola.info(`Valid keys: ${HTTP_OUTPUT_DEFAULT_KEYS.join(', ')}`);
        }
        return;
      }

      showSingleDefault(key, resolved);
      return;
    }

    case 'set': {
      const key = args[1];
      const valueStr = args[2];

      if (!key || valueStr === undefined) {
        consola.warn('Usage: defaults set <key> <value>');
        consola.info(`Valid keys: ${HTTP_OUTPUT_DEFAULT_KEYS.join(', ')}`);
        return;
      }

      if (!isValidDefaultKey(key)) {
        const similar = findSimilarKey(key);
        consola.error(`Unknown key: ${key}`);
        if (similar) {
          consola.info(`Did you mean: ${similar}?`);
        }
        return;
      }

      const parsedValue = parseValue(key, valueStr);
      if (parsedValue === null) {
        if (key === 'outputMode') {
          consola.error(`Invalid value '${valueStr}' for outputMode`);
          consola.info(`Valid values: ${OUTPUT_MODE_VALUES.join(', ')}`);
        } else {
          consola.error(`Invalid boolean value: ${valueStr}`);
          consola.info('Use: true, false, yes, no, 1, 0');
        }
        return;
      }

      // Initialize session defaults if needed
      if (!state.sessionDefaults) {
        state.sessionDefaults = {};
      }

      // Set the value
      (state.sessionDefaults as Record<string, unknown>)[key] = parsedValue;
      consola.success(`Set ${key} = ${formatValue(parsedValue)} (session override)`);
      return;
    }

    case 'reset': {
      const key = args[1];

      if (!key) {
        // Reset all session overrides
        if (!state.sessionDefaults || Object.keys(state.sessionDefaults).length === 0) {
          consola.info('No session overrides to clear.');
          return;
        }

        const count = Object.keys(state.sessionDefaults).length;
        const keys = Object.keys(state.sessionDefaults);
        state.sessionDefaults = undefined;

        consola.success(`Cleared ${count} session override${count === 1 ? '' : 's'}:`);
        for (const k of keys) {
          if (isValidDefaultKey(k)) {
            const newResolved = resolveDefaultsWithSource(
              undefined,
              workspaceDefaults,
              profileDefaults,
              activeProfileName,
              undefined,
            );
            consola.log(`  - ${k} (now: ${formatValue(newResolved[k].value)} from ${newResolved[k].source})`);
          }
        }
        return;
      }

      // Reset single key
      if (!isValidDefaultKey(key)) {
        const similar = findSimilarKey(key);
        consola.error(`Unknown key: ${key}`);
        if (similar) {
          consola.info(`Did you mean: ${similar}?`);
        }
        return;
      }

      if (!state.sessionDefaults || !(key in state.sessionDefaults)) {
        consola.info(`No session override for ${key}`);
        return;
      }

      // Remove the override
      delete (state.sessionDefaults as Record<string, unknown>)[key];

      // Clean up empty object
      if (Object.keys(state.sessionDefaults).length === 0) {
        state.sessionDefaults = undefined;
      }

      // Show the new value
      const newResolved = resolveDefaultsWithSource(
        undefined,
        workspaceDefaults,
        profileDefaults,
        activeProfileName,
        state.sessionDefaults,
      );
      consola.success(`Reset ${key} (now: ${formatValue(newResolved[key].value)} from ${newResolved[key].source})`);
      return;
    }

    default: {
      // Treat as key name for get (use original case for key validation)
      const originalArg = args[0];
      if (originalArg && isValidDefaultKey(originalArg)) {
        showSingleDefault(originalArg, resolved);
        return;
      }

      const similar = findSimilarKey(subcommand);
      consola.error(`Unknown subcommand or key: ${subcommand}`);
      if (similar) {
        consola.info(`Did you mean: defaults get ${similar}?`);
      } else {
        consola.info('Usage: defaults [get|set|reset] [<key>] [<value>]');
      }
    }
  }
};

/**
 * Create defaults command
 */
export function createDefaultsCommand(): Command {
  return {
    name: 'defaults',
    description: 'View and manage HTTP output defaults',
    handler: defaultsHandler,
    helpText: `Usage: defaults [get|set|reset] [<key>] [<value>]

Subcommands:
  defaults              Show all defaults with sources
  defaults get <key>    Show single default with source
  defaults set <key> <value>  Set session override
  defaults reset [<key>]      Clear session override(s)

Valid keys:
  includeHeaders   Include response headers (-i)
  outputMode       Output mode: pretty, json, raw (-o)
  showSummary      Show summary footer (-S)
  trace            Show timing information (--trace)
  showSecrets      Disable secret redaction (--no-redact)
  hideBody         Hide response body (-B)

Priority order (highest to lowest):
  1. CLI flags
  2. Session overrides (set via this command)
  3. Profile method-specific
  4. Profile general
  5. Workspace method-specific
  6. Workspace general
  7. Built-in defaults

Examples:
  defaults                    Show all current defaults
  defaults get includeHeaders Get specific value and source
  defaults set trace true     Enable trace for this session
  defaults reset trace        Clear trace override
  defaults reset              Clear all session overrides`,
  };
}
