/**
 * Input processor for special syntax
 *
 * Handles:
 * - `!cmd args` - Shell escape (execute external command)
 * - `expr | cmd` - Pipe expression result to external command
 */

import { consola } from 'consola';
import { createResponseContext, evaluateExpression, isUnderscoreExpression, valueToString } from './expression.js';
import {
  executeShellCommand,
  extractShellCommand,
  hasPipeOperator,
  isShellEscape,
  pipeToCommand,
  splitByPipe,
} from './shell.js';
import type { ReplState } from './state.js';

/**
 * Result of processing input
 */
export interface InputProcessResult {
  /** Whether the input was handled as special syntax */
  handled: boolean;
  /** Output from shell command (if executed) */
  output?: string;
  /** Error from shell command (if any) */
  error?: string;
  /** Exit code from shell command */
  exitCode?: number;
}

/**
 * Check if input is a special syntax that should be handled before command parsing
 */
export function isSpecialSyntax(input: string): boolean {
  const trimmed = input.trim();
  return isShellEscape(trimmed) || hasPipeOperator(trimmed) || isUnderscoreExpression(trimmed);
}

/**
 * Process shell escape command (!cmd)
 */
async function processShellEscape(input: string): Promise<InputProcessResult> {
  const command = extractShellCommand(input);
  const result = await executeShellCommand(command);

  // Display output
  if (result.stdout) {
    consola.log(result.stdout.trimEnd());
  }
  if (result.stderr) {
    consola.warn(result.stderr.trimEnd());
  }
  if (result.exitCode !== 0) {
    consola.error(`Command exited with code ${result.exitCode}`);
  }

  return {
    handled: true,
    output: result.stdout,
    error: result.stderr || undefined,
    exitCode: result.exitCode,
  };
}

/**
 * Evaluate an expression (underscore or variable)
 */
function evaluateLeftSide(expr: string, state: ReplState): string {
  const trimmed = expr.trim();

  // Handle underscore expressions
  if (isUnderscoreExpression(trimmed)) {
    const ctx = createResponseContext(state);
    const result = evaluateExpression(trimmed, ctx);
    return valueToString(result);
  }

  // Handle variable references ($varname)
  const varMatch = trimmed.match(/^\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?$/);
  if (varMatch?.[1]) {
    const varName = varMatch[1];
    if (state.extractedVars?.[varName]) {
      return state.extractedVars[varName];
    }
    throw new Error(`Variable not found: ${varName}`);
  }

  // Return as plain string (for piping literal text)
  return trimmed;
}

/**
 * Process pipe expression (expr | cmd)
 */
async function processPipe(input: string, state: ReplState): Promise<InputProcessResult> {
  const split = splitByPipe(input);
  if (!split) {
    return { handled: false };
  }

  const { left, right } = split;

  // Evaluate left side
  let inputText: string;
  try {
    inputText = evaluateLeftSide(left, state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    consola.error(message);
    return {
      handled: true,
      error: message,
    };
  }

  // Pipe to right side command
  const result = await pipeToCommand(inputText, right);

  // Display output
  if (result.stdout) {
    consola.log(result.stdout.trimEnd());
  }
  if (result.stderr) {
    consola.warn(result.stderr.trimEnd());
  }
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    // Exit code 1 is common for grep with no matches, don't show error
    consola.error(`Command exited with code ${result.exitCode}`);
  }

  return {
    handled: true,
    output: result.stdout,
    error: result.stderr || undefined,
    exitCode: result.exitCode,
  };
}

/**
 * Process input for special syntax
 *
 * Call this before regular command parsing. If it returns handled: true,
 * the input has been processed and should not be passed to the command registry.
 *
 * @param input - Raw user input
 * @param state - REPL state for expression evaluation
 * @returns Processing result
 */
export async function processSpecialInput(input: string, state: ReplState): Promise<InputProcessResult> {
  const trimmed = input.trim();

  // Check for shell escape (!cmd)
  if (isShellEscape(trimmed)) {
    return processShellEscape(trimmed);
  }

  // Check for pipe (expr | cmd)
  if (hasPipeOperator(trimmed)) {
    return processPipe(trimmed, state);
  }

  // Check for bare underscore expression (_.status, _.body, etc.)
  if (isUnderscoreExpression(trimmed)) {
    try {
      const ctx = createResponseContext(state);
      const result = evaluateExpression(trimmed, ctx);
      const output = valueToString(result);
      consola.log(output);
      return {
        handled: true,
        output,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      consola.error(message);
      return {
        handled: true,
        error: message,
      };
    }
  }

  // Not special syntax
  return { handled: false };
}
