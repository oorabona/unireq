/**
 * Main CLI command definition using citty
 */

import { defineCommand, showUsage } from 'citty';
import { consola } from 'consola';
import { VERSION } from '../index.js';
import { formatKeyboardHelp, formatShellHelp } from '../repl/help.js';
import { replCommand } from './repl.js';
import { requestCommand } from './request.js';
import { createHttpShortcut } from './shortcuts.js';

/**
 * Main CLI command with subcommands
 */
export const mainCommand = defineCommand({
  meta: {
    name: 'unireq',
    version: VERSION,
    description: 'HTTP CLI client with REPL mode for API exploration and testing',
  },
  args: {
    timeout: {
      type: 'string',
      description: 'Request timeout in milliseconds',
      alias: 't',
    },
    trace: {
      type: 'boolean',
      description: 'Show request/response details',
      default: false,
    },
    output: {
      type: 'string',
      description: 'Output mode: pretty (default), json, raw',
      alias: 'o',
    },
    'no-color': {
      type: 'boolean',
      description: 'Disable colors in output',
      default: false,
    },
    'repl-commands': {
      type: 'boolean',
      description: 'Show all available REPL commands',
      default: false,
    },
  },
  subCommands: {
    repl: replCommand,
    request: requestCommand,
    get: createHttpShortcut('GET'),
    post: createHttpShortcut('POST'),
    put: createHttpShortcut('PUT'),
    patch: createHttpShortcut('PATCH'),
    delete: createHttpShortcut('DELETE'),
    head: createHttpShortcut('HEAD'),
    options: createHttpShortcut('OPTIONS'),
  },
  async run({ cmd, args, rawArgs }) {
    // Show REPL commands if --repl-commands flag
    if (args['repl-commands']) {
      consola.info('REPL Commands (use in interactive mode with `unireq repl`):');
      consola.log(formatShellHelp());
      consola.log(formatKeyboardHelp());
      return;
    }

    // Only show help when NO subcommand was executed
    // Check if any known subcommand is in the raw args
    const knownSubCommands = ['repl', 'request', 'get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    const hasSubCommand = rawArgs.some((arg) => knownSubCommands.includes(arg));

    if (!hasSubCommand) {
      await showUsage(cmd);
      consola.log('');
      consola.info('Tip: Use `unireq --repl-commands` to see all REPL commands');
      consola.info('Tip: Use `unireq repl` to start interactive mode');
    }
  },
});
