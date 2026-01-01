/**
 * REPL engine - main interactive loop
 */

import { cancel, intro, isCancel, outro, text } from '@clack/prompts';
import { consola } from 'consola';
import { HistoryWriter } from '../collections/history/index.js';
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

    const input = await text({
      message: prompt,
      placeholder: '',
    });

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
