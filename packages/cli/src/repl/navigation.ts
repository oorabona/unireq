/**
 * Navigation commands for REPL (cd, ls, pwd)
 * Provides shell-like navigation for API paths
 */

import { consola } from 'consola';
import { getMethods, listChildren, pathExists } from '../openapi/navigation/queries.js';
import { getCommandMeta } from './help.js';
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
 * Shows child paths and HTTP methods available at current path
 */
export const lsHandler: CommandHandler = async (_args, state) => {
  // Check if navigation tree is available
  if (!state.navigationTree) {
    consola.info(`Current path: ${state.currentPath}`);
    consola.info('');
    consola.warn('No OpenAPI spec loaded.');
    consola.info('Load a spec with: import <url-or-file>');
    return;
  }

  const tree = state.navigationTree;

  // Check if current path exists in tree
  if (!pathExists(tree, state.currentPath)) {
    consola.warn(`Path not found in spec: ${state.currentPath}`);
    return;
  }

  // Get methods at current path
  const methods = getMethods(tree, state.currentPath);
  if (methods.length > 0) {
    consola.info('Methods:');
    for (const method of methods) {
      consola.info(`  ${method}`);
    }
    consola.info('');
  }

  // Get children
  const children = listChildren(tree, state.currentPath);
  if (children.length > 0) {
    consola.info('Paths:');
    for (const child of children) {
      const childMethods = child.methods.join(', ');
      const paramIndicator = child.isParameter ? ' (param)' : '';
      const methodInfo = childMethods ? ` [${childMethods}]` : '';
      consola.info(`  ${child.name}/${paramIndicator}${methodInfo}`);
    }
  } else if (methods.length === 0) {
    consola.info('(empty)');
  }
};

/**
 * Create all navigation commands
 */
export function createNavigationCommands(): Command[] {
  const pwdMeta = getCommandMeta('pwd');
  const cdMeta = getCommandMeta('cd');
  const lsMeta = getCommandMeta('ls');

  return [
    {
      name: 'pwd',
      description: pwdMeta?.description ?? 'Show current API path',
      handler: pwdHandler,
      helpText: pwdMeta?.helpText,
    },
    {
      name: 'cd',
      description: cdMeta?.description ?? 'Change directory (supports /, .., relative paths)',
      handler: cdHandler,
      helpText: cdMeta?.helpText,
    },
    {
      name: 'ls',
      description: lsMeta?.description ?? 'List endpoints at current path',
      handler: lsHandler,
      helpText: lsMeta?.helpText,
    },
  ];
}
