/**
 * Navigation commands for REPL (cd, ls, pwd)
 * Provides shell-like navigation for API paths
 */

import { consola } from 'consola';
import { resolvePath } from './path-utils.js';
import type { Command, CommandHandler } from './types.js';

/**
 * pwd command handler - Display current path
 */
export const pwdHandler: CommandHandler = async (_args, state) => {
  consola.info(state.currentPath);
};

/**
 * cd command handler - Change directory
 * Supports absolute paths (/foo), relative paths (bar), and parent (..)
 */
export const cdHandler: CommandHandler = async (args, state) => {
  // cd with no argument goes to root
  const targetPath = args[0] ?? '/';

  // Resolve the new path
  const newPath = resolvePath(state.currentPath, targetPath);

  // Update state
  state.currentPath = newPath;
};

/**
 * ls command handler - List current directory contents
 * Currently a placeholder until OpenAPI integration
 */
export const lsHandler: CommandHandler = async (_args, state) => {
  consola.info(`Current path: ${state.currentPath}`);
  consola.info('');
  consola.warn('No OpenAPI spec loaded.');
  consola.info('Load a spec with: import <url-or-file>');
};

/**
 * Create all navigation commands
 */
export function createNavigationCommands(): Command[] {
  return [
    {
      name: 'pwd',
      description: 'Show current API path',
      handler: pwdHandler,
    },
    {
      name: 'cd',
      description: 'Change directory (supports /, .., relative paths)',
      handler: cdHandler,
    },
    {
      name: 'ls',
      description: 'List endpoints at current path',
      handler: lsHandler,
    },
  ];
}
