/**
 * REPL command - starts interactive mode
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { formatKeyboardHelp, formatShellHelp } from '../repl/help.js';
import { runRepl } from '../repl/index.js';

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

    await runRepl({
      workspace: args.workspace,
    });
  },
});
