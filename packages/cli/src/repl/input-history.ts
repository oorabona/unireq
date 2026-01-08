/**
 * Input history management for REPL
 * Handles readline-compatible command history with persistence
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getGlobalWorkspacePath } from '../workspace/paths.js';

/** Default history file name */
const HISTORY_FILE = 'repl_history';

/** Default maximum history entries */
const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Configuration for InputHistory
 */
export interface InputHistoryConfig {
  /** Maximum number of entries to keep */
  maxEntries?: number;
  /** Workspace directory (uses workspace-specific history if provided) */
  workspace?: string;
  /** Direct history file path (overrides workspace-based path) */
  historyPath?: string;
}

/**
 * Input history manager for REPL
 * Provides persistence and retrieval of command history
 */
export class InputHistory {
  private readonly entries: string[] = [];
  private readonly maxEntries: number;
  private readonly historyPath: string | null;

  constructor(config: InputHistoryConfig = {}) {
    this.maxEntries = config.maxEntries ?? DEFAULT_MAX_ENTRIES;
    // Use direct historyPath if provided, otherwise derive from workspace
    this.historyPath = config.historyPath ?? getHistoryFilePath(config.workspace);

    // Load existing history if available
    if (this.historyPath) {
      this.load();
    }
  }

  /**
   * Add a command to history
   * Skips empty commands and duplicates of the last entry
   */
  add(command: string): void {
    const trimmed = command.trim();

    // Skip empty commands
    if (!trimmed) {
      return;
    }

    // Skip duplicate of last entry
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === trimmed) {
      return;
    }

    this.entries.push(trimmed);

    // Enforce max entries limit
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /**
   * Get all history entries (oldest first)
   */
  getAll(): string[] {
    return [...this.entries];
  }

  /**
   * Get entry at index (0 = oldest, length-1 = newest)
   */
  get(index: number): string | undefined {
    return this.entries[index];
  }

  /**
   * Get the number of entries
   */
  get length(): number {
    return this.entries.length;
  }

  /**
   * Clear all history entries
   */
  clear(): void {
    this.entries.length = 0;
  }

  /**
   * Get the history file path
   */
  getPath(): string | null {
    return this.historyPath;
  }

  /**
   * Save history to file
   */
  save(): void {
    if (!this.historyPath) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = dirname(this.historyPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write history as newline-separated entries
      writeFileSync(this.historyPath, `${this.entries.join('\n')}\n`, 'utf8');
    } catch {
      // Silently fail on write errors (don't crash REPL)
    }
  }

  /**
   * Load history from file
   */
  load(): void {
    if (!this.historyPath || !existsSync(this.historyPath)) {
      return;
    }

    try {
      const content = readFileSync(this.historyPath, 'utf8');
      const lines = content.split('\n').filter((line) => line.trim());

      // Clear existing and load from file
      this.entries.length = 0;

      // Only load up to maxEntries (take the most recent)
      const start = Math.max(0, lines.length - this.maxEntries);
      for (let i = start; i < lines.length; i++) {
        const line = lines[i];
        if (line) {
          this.entries.push(line);
        }
      }
    } catch {
      // Silently fail on read errors (start with empty history)
    }
  }
}

/**
 * Get the history file path based on workspace or global config
 *
 * @param workspace - The workspace path (already the .unireq directory, not project root)
 */
export function getHistoryFilePath(workspace?: string): string | null {
  if (workspace) {
    // Use workspace-specific history
    // Note: workspace is already the .unireq directory path, don't add .unireq again
    return join(workspace, HISTORY_FILE);
  }

  // Use global workspace path
  const globalPath = getGlobalWorkspacePath();
  if (!globalPath) {
    return null;
  }

  return join(globalPath, HISTORY_FILE);
}
