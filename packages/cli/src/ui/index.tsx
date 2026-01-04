/**
 * Ink UI Entry Point
 *
 * Provides the runInkRepl function that renders the Ink-based terminal UI.
 * Ink-only: no fallback to legacy readline.
 */

import { render } from 'ink';
import type { ReplState } from '../repl/state.js';
import { App } from './App.js';

/**
 * Error thrown when REPL requires TTY but none is available
 */
export class TTYRequiredError extends Error {
  constructor() {
    super('Interactive mode requires a TTY. Use one-shot commands instead (e.g., unireq get /users).');
    this.name = 'TTYRequiredError';
  }
}

/**
 * Check TTY requirement for interactive mode
 *
 * @throws TTYRequiredError if stdout is not a TTY
 */
export function requireTTY(): void {
  if (!process.stdout.isTTY) {
    throw new TTYRequiredError();
  }
}

/**
 * Run the Ink-based REPL UI
 *
 * @param initialState - Initial REPL state from workspace detection
 * @returns Promise that resolves when UI exits
 * @throws TTYRequiredError if stdout is not a TTY
 */
export async function runInkRepl(initialState: ReplState): Promise<void> {
  requireTTY();
  const { waitUntilExit } = render(<App initialState={initialState} />);
  await waitUntilExit();
}
