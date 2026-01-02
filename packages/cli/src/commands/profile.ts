/**
 * Profile shell CLI command (kubectl-inspired model)
 * Wraps REPL profile handlers for shell usage
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { createReplState } from '../repl/state.js';
import { loadWorkspaceConfig } from '../workspace/config/loader.js';
import { findWorkspace } from '../workspace/detection.js';
import { getActiveProfile } from '../workspace/global-config.js';
import { profileHandler } from '../workspace/profiles/commands.js';

/**
 * Profile command for shell CLI
 * Usage: unireq profile [subcommand] [name]
 */
export const profileCommand = defineCommand({
  meta: {
    name: 'profile',
    description: 'Manage environment profiles (list, use, show)',
  },
  args: {
    subcommand: {
      type: 'positional',
      description: 'Subcommand: list, use, show',
      required: false,
    },
    name: {
      type: 'positional',
      description: 'Profile name (for use command)',
      required: false,
    },
  },
  async run({ args }) {
    // Build args array for REPL handler
    const handlerArgs: string[] = [];

    if (args.subcommand) {
      handlerArgs.push(args.subcommand as string);
    }
    if (args.name) {
      handlerArgs.push(args.name as string);
    }

    // Create state and load workspace config
    const state = createReplState();

    // Try to find and load workspace
    const workspaceResult = findWorkspace();
    if (workspaceResult) {
      const config = loadWorkspaceConfig(workspaceResult.path);
      if (config) {
        state.workspaceConfig = config;
        // In kubectl model, activeProfile is in GlobalConfig
        state.activeProfile = getActiveProfile();
      }
    }

    try {
      await profileHandler(handlerArgs, state);
    } catch (error) {
      consola.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  },
});
