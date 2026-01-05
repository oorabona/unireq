/**
 * REPL command - starts interactive Ink-based terminal UI
 *
 * Ink-only: No fallback to legacy Node.js REPL.
 * Requires TTY - throws TTYRequiredError if not available.
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { formatKeyboardHelp, formatShellHelp } from '../repl/help.js';
import { createReplState } from '../repl/state.js';
import { runInkRepl, TTYRequiredError } from '../ui/index.js';

/**
 * REPL subcommand
 */
export const replCommand = defineCommand({
  meta: {
    name: 'repl',
    description: 'Start interactive REPL mode',
  },
  args: {
    workspace: {
      type: 'string',
      description: 'Workspace directory',
      alias: 'w',
    },
    commands: {
      type: 'boolean',
      description: 'Show available REPL commands',
      alias: 'c',
    },
  },
  async run({ args }) {
    // Show REPL commands help if --commands flag is used
    if (args.commands) {
      consola.info('REPL Commands:');
      consola.log(formatShellHelp());
      consola.log(formatKeyboardHelp());
      return;
    }

    try {
      const state = createReplState({ workspace: args.workspace });
      await runInkRepl(state);
    } catch (error) {
      if (error instanceof TTYRequiredError) {
        consola.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  },
});
