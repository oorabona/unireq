/**
 * REPL command types
 */

import type { ReplState } from './state.js';

/**
 * Command handler function signature
 */
export type CommandHandler = (args: string[], state: ReplState) => Promise<void>;

/**
 * Command definition
 */
export interface Command {
  /** Command name */
  name: string;
  /** Short description for help */
  description: string;
  /** Handler function */
  handler: CommandHandler;
}

/**
 * Result of parsing user input
 */
export interface ParsedInput {
  /** Command name (empty string if no input) */
  command: string;
  /** Arguments after command */
  args: string[];
}
