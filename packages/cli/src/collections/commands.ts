/**
 * Collection REPL commands
 */

import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import { getHistoryPath } from '../repl/state.js';
import type { Command, CommandHandler } from '../repl/types.js';
import { type AssertableResponse, allPassed, assertResponse, getFailures } from './asserter.js';
import { ExtractionError, extractSingleVariable, extractVariables } from './extractor.js';
import type { CmdEntry, HistoryEntry, HistoryFilter, HttpEntry } from './history/index.js';
import { HistoryReader, HistoryWriter } from './history/index.js';
import { loadCollections } from './loader.js';
import {
  CollectionNotFoundError,
  findCollectionItem,
  ItemNotFoundError,
  parseRunArgs,
  RunSyntaxError,
  savedRequestToParsedRequest,
} from './runner.js';
import {
  CollectionWriteError,
  InvalidIdError,
  NoRequestToSaveError,
  parseSaveArgs,
  SaveSyntaxError,
  saveToCollections,
} from './saver.js';

/**
 * Run command handler
 * Executes a saved request from collections
 *
 * Usage: run <collection>/<item>
 */
export const runHandler: CommandHandler = async (args, state) => {
  // Check if workspace is loaded
  if (!state.workspace) {
    consola.warn('No workspace loaded.');
    consola.info('Run from a directory with .unireq/ or use a global workspace.');
    return;
  }

  try {
    // Parse arguments
    const { collectionId, itemId } = parseRunArgs(args);

    // Load collections from workspace
    const config = await loadCollections(state.workspace);

    // Find the item
    const item = findCollectionItem(config, collectionId, itemId);

    // Get base URL and vars from active profile (kubectl model)
    let baseUrl: string | undefined;
    let profileVars: Record<string, string> = {};
    if (state.workspaceConfig?.profiles && state.activeProfile) {
      const profile = state.workspaceConfig.profiles[state.activeProfile];
      if (profile) {
        baseUrl = profile.baseUrl;
        profileVars = profile.vars ?? {};
      }
    }

    // Merge profile vars with extracted vars for interpolation
    // Extracted vars take precedence (allow overwriting profile vars)
    const mergedVars = { ...profileVars, ...state.extractedVars };

    // Transform to ParsedRequest with interpolation
    const request = savedRequestToParsedRequest(item.request, { baseUrl, vars: mergedVars });

    // Log what we're running
    consola.info(`Running: ${item.name || item.id} (${request.method} ${request.url})`);

    // Execute the request (with OpenAPI validation if spec is loaded)
    const result = await executeRequest(request, { spec: state.spec });

    // Store response for extraction (even if extract config not present)
    if (result) {
      state.lastResponseBody = result.body;

      // Auto-extract if item has extract config
      if (item.extract?.vars && Object.keys(item.extract.vars).length > 0) {
        try {
          const extraction = extractVariables(result.body, item.extract);

          // Initialize extractedVars if needed
          if (!state.extractedVars) {
            state.extractedVars = {};
          }

          // Store extracted variables
          for (const [name, value] of Object.entries(extraction.variables)) {
            state.extractedVars[name] = value;
            consola.success(`Extracted: ${name} = "${value.slice(0, 50)}${value.length > 50 ? '...' : ''}"`);
          }

          // Report skipped optional paths
          for (const skipped of extraction.skipped) {
            consola.debug(`Skipped optional: ${skipped.name} (${skipped.reason})`);
          }
        } catch (error) {
          if (error instanceof ExtractionError) {
            consola.warn(`Extraction failed: ${error.message}`);
          } else {
            throw error;
          }
        }
      }

      // Run assertions if item has assert config
      if (item.assert) {
        const assertableResponse: AssertableResponse = {
          status: result.status,
          headers: result.headers,
          body: result.body,
        };

        const assertionResults = assertResponse(item.assert, assertableResponse);

        // Display assertion results
        if (assertionResults.length > 0) {
          consola.info('Assertions:');
          for (const r of assertionResults) {
            if (r.passed) {
              consola.success(`  ${r.message}`);
            } else {
              consola.error(`  ${r.message}`);
            }
          }

          // Summary
          const failures = getFailures(assertionResults);
          if (allPassed(assertionResults)) {
            consola.success(`All ${assertionResults.length} assertions passed`);
          } else {
            consola.error(`${failures.length}/${assertionResults.length} assertions failed`);
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof RunSyntaxError) {
      consola.warn(error.message);
      return;
    }

    if (error instanceof CollectionNotFoundError) {
      consola.error(error.message);
      if (error.availableCollections.length === 0) {
        consola.info('No collections defined. Create a collections.yaml in your .unireq/ directory.');
      }
      return;
    }

    if (error instanceof ItemNotFoundError) {
      consola.error(error.message);
      return;
    }

    // Re-throw unexpected errors
    throw error;
  }
};

/**
 * Create run command
 */
export function createRunCommand(): Command {
  return {
    name: 'run',
    description: 'Execute a saved request from collections',
    handler: runHandler,
  };
}

/**
 * Save command handler
 * Saves the last executed request to a collection
 *
 * Usage: save <collection>/<item> [--name "Display Name"]
 */
export const saveHandler: CommandHandler = async (args, state) => {
  // Check if workspace is loaded
  if (!state.workspace) {
    consola.warn('No workspace loaded.');
    consola.info('Run from a directory with .unireq/ or use a global workspace.');
    return;
  }

  // Check if there's a request to save
  if (!state.lastRequest) {
    consola.warn('No request to save.');
    consola.info('Execute a request first (e.g., get /health).');
    return;
  }

  try {
    // Parse arguments
    const { collectionId, itemId, name } = parseSaveArgs(args);

    // Save to collections
    const result = await saveToCollections(state.workspace, collectionId, itemId, state.lastRequest, name);

    // Show result
    if (result.collectionCreated) {
      consola.info(`Created collection: ${result.collectionId}`);
    }

    if (result.action === 'created') {
      consola.success(`Saved: ${result.collectionId}/${result.itemId}`);
    } else {
      consola.success(`Updated: ${result.collectionId}/${result.itemId}`);
    }
  } catch (error) {
    if (error instanceof SaveSyntaxError) {
      consola.warn(error.message);
      return;
    }

    if (error instanceof InvalidIdError) {
      consola.error(error.message);
      return;
    }

    if (error instanceof NoRequestToSaveError) {
      consola.warn(error.message);
      return;
    }

    if (error instanceof CollectionWriteError) {
      consola.error(error.message);
      return;
    }

    // Re-throw unexpected errors
    throw error;
  }
};

/**
 * Create save command
 */
export function createSaveCommand(): Command {
  return {
    name: 'save',
    description: 'Save last request to a collection',
    handler: saveHandler,
  };
}

/**
 * Extract command handler
 * Manually extract a value from the last response using JSONPath
 *
 * Usage: extract <varName> <jsonPath>
 * Example: extract token $.access_token
 */
export const extractHandler: CommandHandler = async (args, state) => {
  // Check if there's a response to extract from
  if (!state.lastResponseBody) {
    consola.warn('No response to extract from.');
    consola.info('Execute a request first (e.g., get /api/login).');
    return;
  }

  // Parse arguments
  if (args.length < 2) {
    consola.warn('Usage: extract <varName> <jsonPath>');
    consola.info('Example: extract token $.access_token');
    return;
  }

  const varName = args[0];
  const path = args.slice(1).join(' '); // Allow paths with spaces (rare but possible)

  if (!varName) {
    consola.warn('Variable name cannot be empty.');
    return;
  }

  try {
    const value = extractSingleVariable(state.lastResponseBody, path);

    if (value === undefined) {
      consola.info(`Optional path not found: ${path}`);
      return;
    }

    // Initialize extractedVars if needed
    if (!state.extractedVars) {
      state.extractedVars = {};
    }

    // Store the extracted variable
    state.extractedVars[varName] = value;
    consola.success(`Extracted: ${varName} = "${value.slice(0, 50)}${value.length > 50 ? '...' : ''}"`);
  } catch (error) {
    if (error instanceof ExtractionError) {
      consola.error(error.message);
      return;
    }
    throw error;
  }
};

/**
 * Create extract command
 */
export function createExtractCommand(): Command {
  return {
    name: 'extract',
    description: 'Extract value from last response using JSONPath',
    handler: extractHandler,
  };
}

/**
 * Vars command handler
 * Show all extracted variables
 *
 * Usage: vars
 */
export const varsHandler: CommandHandler = async (_args, state) => {
  if (!state.extractedVars || Object.keys(state.extractedVars).length === 0) {
    consola.info('No extracted variables.');
    consola.info('Use "extract <name> <path>" or run requests with extract config.');
    return;
  }

  consola.info('Extracted variables:');
  for (const [name, value] of Object.entries(state.extractedVars)) {
    const displayValue = value.length > 60 ? `${value.slice(0, 60)}...` : value;
    consola.log(`  ${name} = "${displayValue}"`);
  }
};

/**
 * Create vars command
 */
export function createVarsCommand(): Command {
  return {
    name: 'vars',
    description: 'Show all extracted variables',
    handler: varsHandler,
  };
}

/**
 * Format timestamp for display (local time, human-readable)
 */
function formatTimestamp(isoTimestamp: string): string {
  try {
    const date = new Date(isoTimestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoTimestamp;
  }
}

/**
 * Format a history entry for list display
 */
function formatEntryLine(index: number, entry: HistoryEntry): string {
  const timestamp = formatTimestamp(entry.timestamp);

  if (entry.type === 'cmd') {
    const cmd = entry as CmdEntry;
    const status = cmd.success ? 'SUCCESS' : 'FAILED';
    const argsStr = cmd.args.length > 0 ? ` ${cmd.args.join(' ')}` : '';
    return `[${index}] ${timestamp} CMD: ${cmd.command}${argsStr} [${status}]`;
  }

  if (entry.type === 'http') {
    const http = entry as HttpEntry;
    const statusStr = http.status !== null ? String(http.status) : 'ERR';
    const durationStr = http.durationMs !== undefined ? ` (${http.durationMs}ms)` : '';
    return `[${index}] ${timestamp} HTTP: ${http.method} ${http.url} → ${statusStr}${durationStr}`;
  }

  return `[${index}] ${timestamp} UNKNOWN`;
}

/**
 * Format a history entry for detailed display
 */
function formatEntryDetails(entry: HistoryEntry): void {
  const timestamp = formatTimestamp(entry.timestamp);

  if (entry.type === 'cmd') {
    const cmd = entry as CmdEntry;
    consola.info(`Type: Command`);
    consola.info(`Timestamp: ${timestamp}`);
    consola.info(`Command: ${cmd.command}`);
    if (cmd.args.length > 0) {
      consola.info(`Arguments: ${cmd.args.join(' ')}`);
    }
    consola.info(`Status: ${cmd.success ? 'Success' : 'Failed'}`);
    if (cmd.error) {
      consola.error(`Error: ${cmd.error}`);
    }
    return;
  }

  if (entry.type === 'http') {
    const http = entry as HttpEntry;
    consola.info(`Type: HTTP Request`);
    consola.info(`Timestamp: ${timestamp}`);
    consola.info(`Method: ${http.method}`);
    consola.info(`URL: ${http.url}`);

    if (http.requestHeaders && Object.keys(http.requestHeaders).length > 0) {
      consola.info('Request Headers:');
      for (const [key, value] of Object.entries(http.requestHeaders)) {
        consola.log(`  ${key}: ${value}`);
      }
    }

    if (http.requestBody) {
      consola.info(`Request Body: ${http.requestBodyTruncated ? '(truncated)' : ''}`);
      consola.log(`  ${http.requestBody.slice(0, 500)}${http.requestBody.length > 500 ? '...' : ''}`);
    }

    if (http.status !== null) {
      consola.info(`Status: ${http.status}`);
    } else {
      consola.error('Status: Request failed');
    }

    if (http.responseHeaders && Object.keys(http.responseHeaders).length > 0) {
      consola.info('Response Headers:');
      for (const [key, value] of Object.entries(http.responseHeaders)) {
        consola.log(`  ${key}: ${value}`);
      }
    }

    if (http.responseBody) {
      consola.info(`Response Body: ${http.responseBodyTruncated ? '(truncated)' : ''}`);
      consola.log(`  ${http.responseBody.slice(0, 500)}${http.responseBody.length > 500 ? '...' : ''}`);
    }

    if (http.durationMs !== undefined) {
      consola.info(`Duration: ${http.durationMs}ms`);
    }

    if (http.error) {
      consola.error(`Error: ${http.error}`);
    }

    if (http.assertionsPassed !== undefined || http.assertionsFailed !== undefined) {
      consola.info(`Assertions: ${http.assertionsPassed ?? 0} passed, ${http.assertionsFailed ?? 0} failed`);
    }

    if (http.extractedVars && http.extractedVars.length > 0) {
      consola.info(`Extracted Variables: ${http.extractedVars.join(', ')}`);
    }
  }
}

/**
 * History command handler
 * Browse and search command/request history
 *
 * Usage:
 *   history              - Show last 20 entries
 *   history list [N]     - Show last N entries
 *   history http         - Show HTTP entries only
 *   history cmd          - Show command entries only
 *   history show <index> - Show full details of entry
 *   history search <term> - Search by URL, method, or command
 */
export const historyHandler: CommandHandler = async (args, state) => {
  // Get history path
  const historyPath = getHistoryPath(state.workspace);
  if (!historyPath) {
    consola.warn('No history available.');
    consola.info('History requires a workspace or global config directory.');
    return;
  }

  const reader = new HistoryReader(historyPath);

  // Check if history file exists
  if (!(await reader.exists())) {
    consola.info('No history yet.');
    consola.info('Execute some commands and they will appear here.');
    return;
  }

  // Parse subcommand
  const subcommand = args[0]?.toLowerCase();

  // Handle: history show <index>
  if (subcommand === 'show') {
    const indexArg = args[1];
    if (indexArg === undefined) {
      consola.warn('Usage: history show <index>');
      consola.info('Example: history show 0');
      return;
    }

    const index = Number.parseInt(indexArg, 10);
    if (Number.isNaN(index) || index < 0) {
      consola.error('Invalid index. Must be a non-negative integer.');
      return;
    }

    const entry = await reader.show(index);
    if (!entry) {
      consola.error(`Entry not found: index ${index}`);
      return;
    }

    formatEntryDetails(entry);
    return;
  }

  // Handle: history search <term>
  if (subcommand === 'search') {
    const term = args.slice(1).join(' ');
    if (!term) {
      consola.warn('Usage: history search <term>');
      consola.info('Example: history search api.example.com');
      return;
    }

    const result = await reader.search(term);
    if (result.entries.length === 0) {
      consola.info('No matching entries.');
      return;
    }

    consola.info(`Found ${result.total} matching entries:`);
    for (const { index, entry } of result.entries) {
      consola.log(formatEntryLine(index, entry));
    }
    return;
  }

  // Handle: history clear [start] [end]
  if (subcommand === 'clear') {
    const writer = new HistoryWriter({ historyPath });
    const startArg = args[1];
    const endArg = args[2];

    // Parse start and end indices if provided
    let startIndex: number | undefined;
    let endIndex: number | undefined;

    if (startArg !== undefined) {
      startIndex = Number.parseInt(startArg, 10);
      if (Number.isNaN(startIndex) || startIndex < 0) {
        consola.error('Invalid start index. Must be a non-negative integer.');
        return;
      }
    }

    if (endArg !== undefined) {
      endIndex = Number.parseInt(endArg, 10);
      if (Number.isNaN(endIndex) || endIndex < 0) {
        consola.error('Invalid end index. Must be a non-negative integer.');
        return;
      }
    }

    try {
      const clearedCount = await writer.clear(startIndex, endIndex);

      if (clearedCount === 0) {
        consola.info('No entries to clear.');
      } else if (startIndex === undefined) {
        consola.success(`Cleared all ${clearedCount} history entries.`);
      } else {
        consola.success(`Cleared ${clearedCount} history entries.`);
      }
    } catch (error) {
      consola.error(`Failed to clear history: ${(error as Error).message}`);
    }
    return;
  }

  // Handle: history http | history cmd
  let filter: HistoryFilter;
  if (subcommand === 'http') {
    filter = 'http';
  } else if (subcommand === 'cmd') {
    filter = 'cmd';
  }

  // Handle: history list [N] | history [N]
  let count = 20;
  const countArg = filter ? args[1] : subcommand === 'list' ? args[1] : subcommand;

  if (countArg && /^\d+$/.test(countArg)) {
    count = Number.parseInt(countArg, 10);
  }

  // List entries
  const result = await reader.list(count, filter);

  if (result.entries.length === 0) {
    consola.info('History is empty.');
    return;
  }

  const filterLabel = filter ? ` (${filter} only)` : '';
  consola.info(`History${filterLabel}: showing ${result.entries.length} of ${result.total} entries`);

  for (const { index, entry } of result.entries) {
    consola.log(formatEntryLine(index, entry));
  }
};

/**
 * Create history command
 */
export function createHistoryCommand(): Command {
  return {
    name: 'history',
    description: 'Browse command and request history',
    handler: historyHandler,
  };
}
