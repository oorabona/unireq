/**
 * Variable-related REPL commands: echo, set
 *
 * Provides expression evaluation and variable assignment using
 * the underscore (_) pseudo-variable for last response access.
 */

import { consola } from 'consola';
import {
  createResponseContext,
  ExpressionError,
  evaluateExpression,
  isUnderscoreExpression,
  NoResponseError,
  valueToString,
} from './expression.js';
import type { ReplState } from './state.js';
import type { Command, CommandHandler } from './types.js';

/**
 * Evaluate an expression against the current state
 * Supports both underscore expressions (_.body) and regular variables ($varname)
 */
function evalExpression(expr: string, state: ReplState): string {
  const trimmed = expr.trim();

  // Handle underscore expressions (_.property)
  if (isUnderscoreExpression(trimmed)) {
    const ctx = createResponseContext(state);
    const result = evaluateExpression(trimmed, ctx);
    return valueToString(result);
  }

  // Handle variable references ($varname or ${varname})
  const varMatch = trimmed.match(/^\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?$/);
  if (varMatch) {
    const varName = varMatch[1];
    if (!varName) {
      throw new ExpressionError(`Invalid variable name: ${trimmed}`);
    }

    // Check extractedVars
    if (state.extractedVars?.[varName] !== undefined) {
      return state.extractedVars[varName];
    }

    // Check profile vars
    if (state.workspaceConfig?.profiles && state.activeProfile) {
      const profile = state.workspaceConfig.profiles[state.activeProfile];
      if (profile?.vars?.[varName] !== undefined) {
        return String(profile.vars[varName]);
      }
    }

    throw new ExpressionError(`Variable not found: ${varName}`);
  }

  // Plain string - return as-is
  return trimmed;
}

/**
 * Parse echo command arguments, handling quoted strings
 */
function parseEchoArgs(args: string[]): string {
  if (args.length === 0) {
    throw new ExpressionError('No expression provided');
  }

  // Join args back and handle quotes
  const joined = args.join(' ');
  return joined;
}

/**
 * Parse set command arguments: set <name> = <expression>
 * Returns { name, expression }
 */
function parseSetArgs(args: string[]): { name: string; expression: string } {
  if (args.length < 3) {
    throw new ExpressionError('Usage: set <name> = <expression>');
  }

  const name = args[0];
  if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new ExpressionError(`Invalid variable name: ${name}`);
  }

  // Find = sign
  const eqIndex = args.indexOf('=');
  if (eqIndex === -1 || eqIndex !== 1) {
    throw new ExpressionError('Usage: set <name> = <expression>');
  }

  // Everything after = is the expression
  const expression = args.slice(2).join(' ');
  if (!expression) {
    throw new ExpressionError('Usage: set <name> = <expression>');
  }

  return { name, expression };
}

/**
 * Echo command handler
 * Evaluates an expression and displays the result
 *
 * Usage:
 *   echo _.status           - Show last response status
 *   echo _.body             - Show last response body
 *   echo _.headers.content-type - Show specific header
 *   echo $token             - Show extracted variable
 */
export const echoHandler: CommandHandler = async (args, state) => {
  try {
    const expr = parseEchoArgs(args);
    const result = evalExpression(expr, state);
    consola.log(result);
  } catch (error) {
    if (error instanceof NoResponseError) {
      consola.error('No response available. Execute an HTTP request first.');
    } else if (error instanceof ExpressionError) {
      consola.error(error.message);
    } else {
      throw error;
    }
  }
};

/**
 * Set command handler
 * Evaluates an expression and stores the result in a variable
 *
 * Usage:
 *   set token = _.body.access_token  - Extract and store token
 *   set id = _.body.data[0].id       - Extract nested value
 *   set status = _.status            - Store status code
 */
export const setHandler: CommandHandler = async (args, state) => {
  try {
    const { name, expression } = parseSetArgs(args);
    const value = evalExpression(expression, state);

    // Initialize extractedVars if needed
    if (!state.extractedVars) {
      state.extractedVars = {};
    }

    // Store the value
    state.extractedVars[name] = value;
    consola.success(`${name} = "${value.slice(0, 50)}${value.length > 50 ? '...' : ''}"`);
  } catch (error) {
    if (error instanceof NoResponseError) {
      consola.error('No response available. Execute an HTTP request first.');
    } else if (error instanceof ExpressionError) {
      consola.error(error.message);
    } else {
      throw error;
    }
  }
};

/**
 * Create echo command
 */
export function createEchoCommand(): Command {
  return {
    name: 'echo',
    description: 'Evaluate and display an expression',
    handler: echoHandler,
    helpText: `Usage: echo <expression>

Evaluate an expression and display the result.

Underscore expressions (last response):
  echo _.status            Show status code (e.g., 200)
  echo _.statusText        Show status text (e.g., "OK")
  echo _.headers           Show all response headers
  echo _.headers.content-type  Show specific header (case-insensitive)
  echo _.body              Show response body
  echo _.body.data[0].name JSONPath extraction from body
  echo _.timing            Show timing information
  echo _.timing.total      Show specific timing (ms)

Variable references:
  echo $token              Show extracted variable
  echo \${token}            Same as above

Examples:
  get /users
  echo _.status            → 200
  echo _.body.users[0].id  → "abc123"`,
  };
}

/**
 * Create set command
 */
export function createSetCommand(): Command {
  return {
    name: 'set',
    description: 'Set a variable from an expression',
    handler: setHandler,
    helpText: `Usage: set <name> = <expression>

Evaluate an expression and store the result in a variable.
Variables can be used in subsequent requests with \${name} syntax.

Examples:
  set token = _.body.access_token
  set userId = _.body.data[0].id
  set status = _.status

Then use in requests:
  get /users/\${userId}
  post /api --header "Authorization: Bearer \${token}"

View stored variables with 'vars' command.`,
  };
}
