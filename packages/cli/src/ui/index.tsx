/**
 * Ink UI Entry Point
 *
 * Provides the runInkRepl function that renders the Ink-based terminal UI.
 */

import { render } from 'ink';
import type { ReplState } from '../repl/state.js';
import { App } from './App.js';

/**
 * Run the Ink-based REPL UI
 *
 * @param initialState - Initial REPL state from workspace detection
 * @returns Promise that resolves when UI exits
 */
export async function runInkRepl(initialState: ReplState): Promise<void> {
  const { waitUntilExit } = render(<App initialState={initialState} />);
  await waitUntilExit();
}

/**
 * Check if Ink UI should be used based on environment
 *
 * @returns true if Ink UI should be used
 */
export function shouldUseInk(): boolean {
  // Disable Ink if:
  // - CI environment detected
  // - UNIREQ_LEGACY_REPL=1 env var set
  // - stdout is not a TTY (piped)

  if (process.env['CI']) return false;
  if (process.env['UNIREQ_LEGACY_REPL'] === '1') return false;
  if (!process.stdout.isTTY) return false;

  return true;
}
