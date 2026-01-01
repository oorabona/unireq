/**
 * Collection REPL commands
 */

import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import type { Command, CommandHandler } from '../repl/types.js';
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

    // Transform to ParsedRequest
    const request = savedRequestToParsedRequest(item.request, baseUrl);

    // Log what we're running
    consola.info(`Running: ${item.name || item.id} (${request.method} ${request.url})`);

    // Execute the request
    await executeRequest(request);
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
