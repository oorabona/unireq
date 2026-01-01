/**
 * REPL engine - main interactive loop
 */

import { autocomplete, cancel, intro, isCancel, outro, text } from '@clack/prompts';
import { consola } from 'consola';
import { HistoryWriter } from '../collections/history/index.js';
import { getSuggestions } from './autocomplete.js';
import { type CommandRegistry, createDefaultRegistry, parseInput } from './commands.js';
import { createReplState, formatPrompt, getHistoryPath } from './state.js';

/**
 * REPL options
 */
export interface ReplOptions {
  /** Workspace directory */
  workspace?: string;
  /** Custom command registry (for testing) */
  registry?: CommandRegistry;
}

/**
 * Run the interactive REPL loop
 */
export async function runRepl(options?: ReplOptions): Promise<void> {
  // Create history writer if path available
  const historyPath = getHistoryPath(options?.workspace);
  const historyWriter = historyPath ? new HistoryWriter({ historyPath }) : undefined;

  const state = createReplState({ workspace: options?.workspace, historyWriter });
  const registry = options?.registry ?? createDefaultRegistry();

  // Welcome message
  intro('Welcome to unireq REPL');

  if (state.workspace) {
    consola.info(`Workspace: ${state.workspace}`);
  }

  consola.info("Type 'help' for available commands, 'exit' to quit.");

  // Main REPL loop
  while (state.running) {
    const prompt = formatPrompt(state);

    // Use autocomplete with dynamic suggestions when navigation tree is loaded
    // Otherwise fall back to simple text input
    let input: string | symbol;

    if (state.navigationTree) {
      // Dynamic autocomplete with suggestions from navigation tree and commands
      input = await autocomplete({
        message: prompt,
        placeholder: 'Type command or path...',
        maxItems: 10,
        options: function () {
          // Get current user input from the prompt
          // For single-select, this.value is string (not array)
          // Use userInputWithCursor for the raw typed input, strip the cursor marker
          const rawInput = this.userInputWithCursor.replace('█', '');

          // Get suggestions based on current input
          const suggestions = getSuggestions(state, registry, rawInput);

          // Convert to @clack/prompts Option format
          return suggestions.map((s) => ({
            value: s.value,
            label: s.label,
            hint: s.hint,
          }));
        },
      });
    } else {
      // Simple text input when no OpenAPI spec loaded
      input = await text({
        message: prompt,
        placeholder: '',
      });
    }

    // Handle cancel (Ctrl+C) or EOF (Ctrl+D)
    // @clack/prompts returns symbol for Ctrl+C (isCancel) or undefined for EOF
    if (isCancel(input) || input === undefined) {
      cancel('Goodbye!');
      break;
    }

    // Parse input
    const parsed = parseInput(input as string);

    // Skip empty input
    if (!parsed.command) {
      continue;
    }

    // Execute command
    let success = true;
    let errorMsg: string | undefined;
    try {
      await registry.execute(parsed.command, parsed.args, state);
    } catch (error) {
      success = false;
      if (error instanceof Error) {
        errorMsg = error.message;
        consola.error(error.message);
      } else {
        errorMsg = String(error);
        consola.error(`Error: ${errorMsg}`);
      }
    }

    // Log command to history (non-blocking)
    if (state.historyWriter) {
      state.historyWriter.logCmd(parsed.command, parsed.args, success, errorMsg);
    }
  }

  // Goodbye message (only if not cancelled)
  if (!state.running) {
    outro('Goodbye!');
  }
}
