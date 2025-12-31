/**
 * REPL command - starts interactive mode
 */

import { defineCommand } from 'citty';
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
  },
  async run({ args }) {
    await runRepl({
      workspace: args.workspace,
    });
  },
});
