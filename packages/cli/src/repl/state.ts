/**
 * REPL session state management
 */

import type { NavigationTree } from '../openapi/navigation/types.js';
import type { LoadedSpec } from '../openapi/types.js';
import type { IVault } from '../secrets/types.js';
import type { ParsedRequest } from '../types.js';
import type { WorkspaceConfig } from '../workspace/config/types.js';

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
  /** Loaded workspace configuration (optional) */
  workspaceConfig?: WorkspaceConfig;
  /** Currently active profile name (runtime, may differ from config) */
  activeProfile?: string;
  /** Secrets vault (optional, created on first use) */
  vault?: IVault;
  /** Last executed HTTP request (for save command) */
  lastRequest?: ParsedRequest;
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
