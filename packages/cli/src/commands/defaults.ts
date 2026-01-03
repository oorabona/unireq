/**
 * Defaults shell CLI command
 * View HTTP output defaults with source tracking (read-only)
 * Set/reset operations are REPL-only (session-based)
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { createReplState } from '../repl/state.js';
import { loadWorkspaceConfig } from '../workspace/config/loader.js';
import { defaultsHandler } from '../workspace/defaults/commands.js';
import { findWorkspace } from '../workspace/detection.js';
import { getActiveProfile } from '../workspace/global-config.js';

/**
 * Defaults command for shell CLI
 * Usage: unireq defaults [get <key>]
 *
 * Note: set/reset are REPL-only since they modify session state
 */
export const defaultsCommand = defineCommand({
  meta: {
    name: 'defaults',
    description: 'View HTTP output defaults with source tracking',
  },
  args: {
    subcommand: {
      type: 'positional',
      description: 'Subcommand: get',
      required: false,
    },
    key: {
      type: 'positional',
      description: 'Default key to get (for get subcommand)',
      required: false,
    },
  },
  async run({ args }) {
    // Build args array for REPL handler
    const handlerArgs: string[] = [];

    if (args.subcommand) {
      const subcommand = args.subcommand as string;

      // Reject set/reset in CLI mode
      if (subcommand === 'set' || subcommand === 'reset') {
        consola.error(`The '${subcommand}' subcommand is only available in REPL mode.`);
        consola.info('Session overrides persist only during a REPL session.');
        consola.info('Use `unireq repl` to start interactive mode.');
        process.exitCode = 1;
        return;
      }

      handlerArgs.push(subcommand);
    }
    if (args.key) {
      handlerArgs.push(args.key as string);
    }

    // Create state with workspace config loaded
    const state = createReplState();

    // Try to load workspace config for context
    const workspaceInfo = findWorkspace();
    if (workspaceInfo) {
      const config = loadWorkspaceConfig(workspaceInfo.path);
      if (config) {
        state.workspaceConfig = config;
        state.workspace = workspaceInfo.path;
        state.activeProfile = getActiveProfile();
      }
    }

    try {
      await defaultsHandler(handlerArgs, state);
    } catch (error) {
      consola.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  },
});
