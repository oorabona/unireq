/**
 * Workspace shell CLI command
 * Wraps REPL workspace handlers for shell usage
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { createReplState } from '../repl/state.js';
import { workspaceHandler } from '../workspace/commands.js';

/**
 * Workspace command for shell CLI
 * Usage: unireq workspace [subcommand] [args]
 */
export const workspaceCommand = defineCommand({
  meta: {
    name: 'workspace',
    description: 'Manage workspaces (list, add, use, remove, doctor, init)',
  },
  args: {
    subcommand: {
      type: 'positional',
      description: 'Subcommand: list, add, use, remove, doctor, init',
      required: false,
    },
    arg1: {
      type: 'positional',
      description: 'First argument (name or path depending on subcommand)',
      required: false,
    },
    arg2: {
      type: 'positional',
      description: 'Second argument (path for add command)',
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

    // Create minimal state for workspace operations
    const state = createReplState();

    try {
      await workspaceHandler(handlerArgs, state);
    } catch (error) {
      consola.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  },
});
