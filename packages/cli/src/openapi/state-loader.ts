/**
 * OpenAPI Spec State Loader
 * Loads OpenAPI specs into REPL state
 * @module openapi/state-loader
 */

import { basename, isAbsolute, join } from 'node:path';
import { consola } from 'consola';
import type { ReplState } from '../repl/state.js';
import { SpecLoadError, SpecNotFoundError, SpecParseError } from './errors.js';
import { loadSpec } from './loader.js';
import { buildNavigationTree } from './navigation/index.js';
import type { LoadedSpec } from './types.js';
import { isUrl } from './utils.js';

/**
 * Options for loading spec into state
 */
export interface LoadSpecOptions {
  /** Workspace path for relative file resolution */
  workspacePath?: string;
  /** Force reload (bypass cache) */
  forceReload?: boolean;
  /** Suppress success message */
  silent?: boolean;
}

/**
 * Result of spec loading
 */
export interface SpecLoadResult {
  /** Whether loading succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Loaded spec if successful */
  spec?: LoadedSpec;
}

/**
 * Resolve source path relative to workspace if needed
 */
function resolveSource(source: string, workspacePath?: string): string {
  // URLs don't need resolution
  if (isUrl(source)) {
    return source;
  }

  // Absolute paths don't need resolution
  if (isAbsolute(source)) {
    return source;
  }

  // Relative paths are resolved against workspace
  if (workspacePath) {
    return join(workspacePath, source);
  }

  // No workspace, use as-is (will resolve against cwd)
  return source;
}

/**
 * Get display name for spec source
 */
function getSourceDisplayName(source: string): string {
  if (isUrl(source)) {
    try {
      const url = new URL(source);
      return `${url.hostname}${url.pathname}`;
    } catch {
      return source;
    }
  }
  return basename(source);
}

/**
 * Load an OpenAPI spec into REPL state
 *
 * @param state - REPL state to update
 * @param source - File path or URL to load
 * @param options - Load options
 * @returns Result indicating success or failure
 */
export async function loadSpecIntoState(
  state: ReplState,
  source: string,
  options?: LoadSpecOptions,
): Promise<SpecLoadResult> {
  const { workspacePath, forceReload = false, silent = false } = options ?? {};

  // Resolve the source path
  const resolvedSource = resolveSource(source, workspacePath);

  try {
    // Load the spec
    const spec = await loadSpec(resolvedSource, {
      noCache: forceReload,
      workspace: workspacePath,
    });

    // Build navigation tree
    const navigationTree = buildNavigationTree(spec);

    // Update state
    state.spec = spec;
    state.navigationTree = navigationTree;

    // Show success message
    if (!silent) {
      const displayName = getSourceDisplayName(source);
      const cacheNote = forceReload ? ' (cache bypassed)' : '';
      consola.success(`Loaded OpenAPI spec: ${displayName} (${spec.versionFull})${cacheNote}`);
    }

    return { success: true, spec };
  } catch (error) {
    // Clear spec from state on error
    state.spec = undefined;
    state.navigationTree = undefined;

    // Format error message
    let errorMessage: string;
    if (error instanceof SpecNotFoundError) {
      errorMessage = `OpenAPI spec not found: ${source}`;
    } else if (error instanceof SpecParseError) {
      errorMessage = `Failed to parse OpenAPI spec: ${error.message}`;
    } else if (error instanceof SpecLoadError) {
      errorMessage = `Failed to load OpenAPI spec: ${error.message}`;
    } else {
      errorMessage = `Failed to load OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (!silent) {
      consola.warn(errorMessage);
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Clear OpenAPI spec from REPL state
 */
export function clearSpecFromState(state: ReplState): void {
  state.spec = undefined;
  state.navigationTree = undefined;
}

/**
 * Get spec info string for display
 */
export function getSpecInfoString(state: ReplState): string | undefined {
  if (!state.spec) {
    return undefined;
  }

  const displayName = getSourceDisplayName(state.spec.source);
  return `${displayName} (${state.spec.versionFull})`;
}
