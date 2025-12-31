/**
 * REPL session state management
 */

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
