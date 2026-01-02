/**
 * Tab completer for Node.js readline/repl
 * Adapts existing autocomplete logic to readline interface
 */

import type { CompleterResult } from 'node:readline';
import { getSuggestions } from './autocomplete.js';
import type { CommandRegistry } from './commands.js';
import type { ReplState } from './state.js';

/**
 * Readline-compatible completer function type
 */
export type CompleterFn = (line: string) => CompleterResult;

/**
 * Create a readline-compatible completer function
 * Uses the existing getSuggestions() logic for consistency
 *
 * @param state - REPL state (provides navigation tree, current path)
 * @param registry - Command registry (provides command list)
 * @returns Completer function for readline/repl
 */
export function createCompleter(state: ReplState, registry: CommandRegistry): CompleterFn {
  return (line: string): CompleterResult => {
    const trimmed = line.trimStart();

    // Get suggestions using existing logic
    const suggestions = getSuggestions(state, registry, trimmed);

    if (suggestions.length === 0) {
      // No completions available
      return [[], line];
    }

    // Extract completion values
    const completions = suggestions.map((s) => s.value);

    // Determine what part of the input we're completing
    // For readline, we need to return the substring being completed
    const completionBase = getCompletionBase(trimmed);

    // Filter completions to those matching the current input
    const matches = completions.filter((c) => c.toLowerCase().startsWith(completionBase.toLowerCase()));

    if (matches.length === 0) {
      return [completions, completionBase];
    }

    return [matches, completionBase];
  };
}

/**
 * Get the base string being completed
 * This is the last "word" in the input that should be completed
 */
function getCompletionBase(input: string): string {
  const trimmed = input.trim();

  // If input has a space, get the last part
  const lastSpaceIndex = trimmed.lastIndexOf(' ');
  if (lastSpaceIndex !== -1) {
    return trimmed.slice(lastSpaceIndex + 1);
  }

  return trimmed;
}

/**
 * Format completions for display when multiple matches exist
 * Shows hints alongside values when available
 */
export function formatCompletionsForDisplay(state: ReplState, registry: CommandRegistry, input: string): string[] {
  const suggestions = getSuggestions(state, registry, input.trim());

  return suggestions.map((s) => {
    if (s.hint) {
      return `${s.value.padEnd(20)} ${s.hint}`;
    }
    return s.value;
  });
}
