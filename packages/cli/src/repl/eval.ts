/**
 * Custom eval function for Node.js REPL
 * Handles command parsing, multiline detection, and execution
 */

import * as nodeRepl from 'node:repl';
import type { CommandRegistry } from './commands.js';
import { parseInput } from './commands.js';
import type { ReplState } from './state.js';

/**
 * REPL eval callback signature
 */
export type EvalCallback = (err: Error | null, result?: unknown) => void;

/**
 * Custom eval function for the REPL
 * @param registry - Command registry for executing commands
 * @param state - REPL state
 * @returns Async eval function compatible with Node.js REPL
 */
export function createEval(
  registry: CommandRegistry,
  state: ReplState,
): (cmd: string, _context: unknown, _filename: string, callback: EvalCallback) => void {
  return (cmd: string, _context: unknown, _filename: string, callback: EvalCallback): void => {
    // Handle the evaluation asynchronously
    evalCommand(cmd, registry, state)
      .then((result) => {
        callback(null, result);
      })
      .catch((error) => {
        // For multiline, throw Recoverable to continue on next line
        if (error instanceof MultilineIncomplete) {
          callback(new nodeRepl.Recoverable(error));
          return;
        }
        // For other errors, report but don't crash
        callback(null, undefined);
      });
  };
}

/**
 * Error indicating incomplete multiline input
 */
export class MultilineIncomplete extends Error {
  constructor(message = 'Incomplete input') {
    super(message);
    this.name = 'MultilineIncomplete';
  }
}

/**
 * Evaluate a command string
 */
async function evalCommand(cmd: string, registry: CommandRegistry, state: ReplState): Promise<unknown> {
  const trimmed = cmd.trim();

  // Empty input - just return
  if (!trimmed) {
    return undefined;
  }

  // Check for multiline JSON body
  if (isIncompleteJson(trimmed)) {
    throw new MultilineIncomplete('Incomplete JSON body');
  }

  // Parse and execute
  const parsed = parseInput(trimmed);

  // Empty command after parsing
  if (!parsed.command) {
    return undefined;
  }

  // Execute command - errors propagate to createEval callback handler
  await registry.execute(parsed.command, parsed.args, state);

  // Return undefined to prevent REPL from printing result
  return undefined;
}

/**
 * Check if input contains incomplete JSON
 * Returns true if braces/brackets are unbalanced
 */
export function isIncompleteJson(input: string): boolean {
  // Look for JSON-like patterns
  const trimmed = input.trim();

  // Quick check: does it look like it might contain JSON?
  if (!trimmed.includes('{') && !trimmed.includes('[')) {
    return false;
  }

  // Count braces and brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let isEscaped = false;

  for (const char of trimmed) {
    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    switch (char) {
      case '{':
        braceCount++;
        break;
      case '}':
        braceCount--;
        break;
      case '[':
        bracketCount++;
        break;
      case ']':
        bracketCount--;
        break;
    }
  }

  // Incomplete if any count is positive (unclosed)
  // Negative means too many closing, which is an error not multiline
  return braceCount > 0 || bracketCount > 0;
}

/**
 * Create a multiline-aware input processor
 * Accumulates lines until JSON is complete
 */
export class MultilineBuffer {
  private lines: string[] = [];

  /**
   * Add a line to the buffer
   * @returns true if input is complete, false if more lines needed
   */
  addLine(line: string): boolean {
    this.lines.push(line);
    const combined = this.lines.join('\n');

    if (isIncompleteJson(combined)) {
      return false;
    }

    return true;
  }

  /**
   * Get the complete input
   */
  getInput(): string {
    return this.lines.join('\n');
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.lines = [];
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.lines.length === 0;
  }
}
