/**
 * Collection REPL commands
 */

import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import type { Command, CommandHandler } from '../repl/types.js';
import { type AssertableResponse, allPassed, assertResponse, getFailures } from './asserter.js';
import { ExtractionError, extractSingleVariable, extractVariables } from './extractor.js';
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

    // Get base URL from active profile if available
    let baseUrl: string | undefined;
    if (state.workspaceConfig?.profiles && state.activeProfile) {
      const profile = state.workspaceConfig.profiles[state.activeProfile];
      if (profile && typeof profile === 'object' && 'baseUrl' in profile) {
        baseUrl = profile.baseUrl as string;
      }
    }

    // Merge workspace vars with extracted vars for interpolation
    // Extracted vars take precedence (allow overwriting workspace vars)
    const workspaceVars = state.workspaceConfig?.vars ?? {};
    const mergedVars = { ...workspaceVars, ...state.extractedVars };

    // Transform to ParsedRequest with interpolation
    const request = savedRequestToParsedRequest(item.request, { baseUrl, vars: mergedVars });

    // Log what we're running
    consola.info(`Running: ${item.name || item.id} (${request.method} ${request.url})`);

    // Execute the request
    const result = await executeRequest(request);

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
