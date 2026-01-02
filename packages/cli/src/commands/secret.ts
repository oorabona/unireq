/**
 * Secret shell CLI command
 * Wraps REPL secret handlers for shell usage
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { createReplState } from '../repl/state.js';
import { secretHandler } from '../secrets/commands.js';

/**
 * Secret command for shell CLI
 * Usage: unireq secret [subcommand] [args...]
 */
export const secretCommand = defineCommand({
  meta: {
    name: 'secret',
    description: 'Manage secrets (init, unlock, lock, set, get, list, delete, status)',
  },
  args: {
    subcommand: {
      type: 'positional',
      description: 'Subcommand: init, unlock, lock, set, get, list, delete, status, backend',
      required: false,
    },
    arg1: {
      type: 'positional',
      description: 'First argument (secret name)',
      required: false,
    },
    arg2: {
      type: 'positional',
      description: 'Second argument (secret value for set)',
      required: false,
    },
  },
  async run({ args }) {
    // Build args array for REPL handler
    const handlerArgs: string[] = [];

    if (args.subcommand) {
      handlerArgs.push(args.subcommand as string);
    }
    if (args.arg1) {
      handlerArgs.push(args.arg1 as string);
    }
    if (args.arg2) {
      handlerArgs.push(args.arg2 as string);
    }

    // Create minimal state for secret operations
    const state = createReplState();

    try {
      await secretHandler(handlerArgs, state);
    } catch (error) {
      consola.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  },
});
