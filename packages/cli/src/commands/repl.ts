/**
 * REPL command - starts interactive mode
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';

/**
 * REPL subcommand (placeholder)
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
  run({ args }) {
    // Placeholder - REPL implementation is Task 1.3
    consola.start('Starting REPL mode...');
    if (args.workspace) {
      consola.info(`Workspace: ${args.workspace}`);
    }
    consola.warn('REPL not yet implemented - see Task 1.3');
  },
});
