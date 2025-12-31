/**
 * REPL session state management
 */

import type { LoadedSpec } from '../openapi/types.js';
import type { NavigationTree } from '../openapi/navigation/types.js';

/**
 * REPL session state
 */
export interface ReplState {
  /** Current API path (default: '/') */
  currentPath: string;
  /** Workspace directory (optional) */
  workspace?: string;
  /** Whether REPL should continue running */
  running: boolean;
  /** Loaded OpenAPI spec (optional) */
  spec?: LoadedSpec;
  /** Navigation tree built from spec (optional) */
  navigationTree?: NavigationTree;
}

/**
 * Create initial REPL state
 */
export function createReplState(options?: { workspace?: string }): ReplState {
  return {
    currentPath: '/',
    workspace: options?.workspace,
    running: true,
  };
}

/**
 * Format the prompt string based on current state
 */
export function formatPrompt(state: ReplState): string {
  return `unireq ${state.currentPath}> `;
}
