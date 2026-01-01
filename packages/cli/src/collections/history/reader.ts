/**
 * History reader for browsing NDJSON history files
 */

import { createReadStream } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { HistoryEntry } from './types.js';

/**
 * Error thrown when history file cannot be read
 */
export class HistoryReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoryReadError';
    Object.setPrototypeOf(this, HistoryReadError.prototype);
  }
}

/**
 * Filter type for history entries
 */
export type HistoryFilter = 'http' | 'cmd' | undefined;

/**
 * Result of listing history entries
 */
export interface HistoryListResult {
  entries: Array<{ index: number; entry: HistoryEntry }>;
  total: number;
}

/**
 * History reader class for browsing and searching history
 */
export class HistoryReader {
  private readonly historyPath: string;

  constructor(historyPath: string) {
    this.historyPath = historyPath;
  }

  /**
   * Check if history file exists
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.historyPath, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read all valid entries from history file
   * Entries are returned in reverse order (most recent first)
   */
  private async readEntries(): Promise<HistoryEntry[]> {
    const entries: HistoryEntry[] = [];

    const fileStream = createReadStream(this.historyPath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const entry = JSON.parse(trimmed) as HistoryEntry;
        // Validate it has required fields
        if (entry.type && entry.timestamp) {
          entries.push(entry);
        }
      } catch {
        // Skip malformed lines silently
      }
    }

    // Reverse to get most recent first
    return entries.reverse();
  }

  /**
   * List recent history entries
   * @param count Number of entries to return (default: 20, max: 1000)
   * @param filter Filter by entry type
   */
  async list(count = 20, filter?: HistoryFilter): Promise<HistoryListResult> {
    if (!(await this.exists())) {
      return { entries: [], total: 0 };
    }

    // Clamp count to reasonable limits
    const limitedCount = Math.min(Math.max(1, count), 1000);

    const allEntries = await this.readEntries();

    // Apply filter
    const filtered = filter ? allEntries.filter((e) => e.type === filter) : allEntries;

    // Take requested count
    const selected = filtered.slice(0, limitedCount);

    return {
      entries: selected.map((entry, index) => ({ index, entry })),
      total: filtered.length,
    };
  }

  /**
   * Get a specific entry by index
   * Index 0 is the most recent entry
   */
  async show(index: number): Promise<HistoryEntry | null> {
    if (!(await this.exists())) {
      return null;
    }

    if (index < 0) {
      return null;
    }

    const allEntries = await this.readEntries();

    if (index >= allEntries.length) {
      return null;
    }

    return allEntries[index] ?? null;
  }

  /**
   * Search history entries by term
   * Searches in: URL (http), command name (cmd), method (http)
   * @param term Search term (case-insensitive substring match)
   * @param count Maximum results to return (default: 20)
   */
  async search(term: string, count = 20): Promise<HistoryListResult> {
    if (!(await this.exists())) {
      return { entries: [], total: 0 };
    }

    if (!term.trim()) {
      return { entries: [], total: 0 };
    }

    const searchLower = term.toLowerCase();
    const allEntries = await this.readEntries();

    const matching = allEntries.filter((entry) => {
      if (entry.type === 'http') {
        // Search in URL and method
        const urlMatch = entry.url.toLowerCase().includes(searchLower);
        const methodMatch = entry.method.toLowerCase().includes(searchLower);
        return urlMatch || methodMatch;
      }
      if (entry.type === 'cmd') {
        // Search in command name and args
        const cmdMatch = entry.command.toLowerCase().includes(searchLower);
        const argsMatch = entry.args.some((arg) => arg.toLowerCase().includes(searchLower));
        return cmdMatch || argsMatch;
      }
      return false;
    });

    // Limit results
    const limited = matching.slice(0, Math.min(count, 1000));

    return {
      entries: limited.map((entry, index) => ({ index, entry })),
      total: matching.length,
    };
  }
}
