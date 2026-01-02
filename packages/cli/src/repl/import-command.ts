/**
 * Import command for loading OpenAPI specs
 * @module repl/import-command
 */

import { consola } from 'consola';
import { getSpecInfoString, loadSpecIntoState } from '../openapi/state-loader.js';
import { isUrl } from '../openapi/utils.js';
import type { Command, CommandHandler } from './types.js';

/**
 * Parse import command arguments
 */
function parseImportArgs(args: string[]): { source?: string; forceReload: boolean } {
  let source: string | undefined;
  let forceReload = false;

  for (const arg of args) {
    if (arg === '--reload' || arg === '-r') {
      forceReload = true;
    } else if (!source && !arg.startsWith('-')) {
      source = arg;
    }
  }

  return { source, forceReload };
}

/**
 * Import command handler
 * Loads an OpenAPI spec from file path or URL
 */
export const importHandler: CommandHandler = async (args, state) => {
  const { source, forceReload } = parseImportArgs(args);

  // Validate source argument
  if (!source) {
    consola.error('Usage: import <path-or-url> [--reload]');
    consola.info('Examples:');
    consola.info('  import ./api.yaml         Load from local file');
    consola.info('  import https://...        Load from URL');
    consola.info('  import ./api.yaml -r      Force reload (bypass cache)');
    return;
  }

  // Validate HTTP URLs are rejected (HTTPS only)
  if (isUrl(source) && source.toLowerCase().startsWith('http://')) {
    consola.error('HTTPS required for remote URLs');
    consola.info('Use https:// instead of http://');
    return;
  }

  // Load the spec
  const result = await loadSpecIntoState(state, source, {
    workspacePath: state.workspace,
    forceReload,
  });

  // Show spec info on success
  if (result.success) {
    const info = getSpecInfoString(state);
    if (info) {
      consola.success(`Loaded OpenAPI spec: ${info}${forceReload ? ' (cache bypassed)' : ''}`);
    }
  }
  // Error message is already shown by loadSpecIntoState
};

/**
 * Create the import command
 */
export function createImportCommand(): Command {
  return {
    name: 'import',
    description: 'Load an OpenAPI spec from file or URL',
    handler: importHandler,
    helpText: `Usage: import <path-or-url> [options]

Load an OpenAPI spec to enable navigation and validation.

Options:
  --reload, -r    Force reload (bypass cache)

Examples:
  import ./openapi.yaml          Load from relative path
  import /path/to/spec.json      Load from absolute path
  import https://api.example.com/openapi.json  Load from URL

The loaded spec enables:
  - ls/cd navigation through API paths
  - describe command for endpoint documentation
  - Request body validation (coming soon)

Notes:
  - Only HTTPS URLs are allowed (no HTTP)
  - Relative paths are resolved from workspace directory
  - Loading a new spec replaces the current one`,
  };
}
