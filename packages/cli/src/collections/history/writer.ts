/**
 * History writer for NDJSON logging
 */

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { consola } from 'consola';
import { redactBody, redactHeaders, truncateBody } from './redactor.js';
import { rotateIfNeeded } from './rotation.js';
import type { CmdEntry, HistoryEntry, HistoryWriterConfig, HttpEntry } from './types.js';
import { HISTORY_DEFAULTS } from './types.js';

/**
 * Error thrown when history write fails
 */
export class HistoryWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoryWriteError';
    Object.setPrototypeOf(this, HistoryWriteError.prototype);
  }
}

/**
 * History writer class for logging commands and HTTP requests
 */
export class HistoryWriter {
  private readonly historyPath: string;
  private readonly maxEntries: number;
  private readonly rotationKeepRatio: number;
  private readonly maxBodySize: number;
  private initialized = false;

  constructor(config: HistoryWriterConfig) {
    this.historyPath = config.historyPath;
    this.maxEntries = config.maxEntries ?? HISTORY_DEFAULTS.maxEntries;
    this.rotationKeepRatio = config.rotationKeepRatio ?? HISTORY_DEFAULTS.rotationKeepRatio;
    this.maxBodySize = config.maxBodySize ?? HISTORY_DEFAULTS.maxBodySize;
  }

  /**
   * Get the history file path
   */
  getPath(): string {
    return this.historyPath;
  }

  /**
   * Initialize history file (create directory and file if needed)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const dir = dirname(this.historyPath);
      await mkdir(dir, { recursive: true, mode: 0o700 });
      this.initialized = true;
    } catch (error) {
      // Directory might already exist, that's fine
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') {
        throw new HistoryWriteError(`Failed to create history directory: ${err.message}`);
      }
      this.initialized = true;
    }
  }

  /**
   * Append an entry to the history file
   */
  private async appendEntry(entry: HistoryEntry): Promise<void> {
    await this.ensureInitialized();

    const line = `${JSON.stringify(entry)}\n`;

    try {
      await appendFile(this.historyPath, line, { mode: 0o600 });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      // If file doesn't exist, create it
      if (err.code === 'ENOENT') {
        await writeFile(this.historyPath, line, { mode: 0o600 });
        return;
      }
      throw new HistoryWriteError(`Failed to write history: ${err.message}`);
    }

    // Check if rotation is needed (async, don't block)
    this.triggerRotationCheck();
  }

  /**
   * Trigger rotation check in background
   */
  private triggerRotationCheck(): void {
    rotateIfNeeded(this.historyPath, this.maxEntries, this.rotationKeepRatio).catch((error) => {
      consola.warn(`History rotation failed: ${(error as Error).message}`);
    });
  }

  /**
   * Log a REPL command
   */
  async logCmd(command: string, args: string[], success: boolean, error?: string): Promise<void> {
    const entry: CmdEntry = {
      type: 'cmd',
      timestamp: new Date().toISOString(),
      command,
      args,
      success,
    };

    if (error) {
      entry.error = error;
    }

    try {
      await this.appendEntry(entry);
    } catch (err) {
      // Log warning but don't block command execution
      consola.warn(`Failed to log command to history: ${(err as Error).message}`);
    }
  }

  /**
   * Log an HTTP request/response
   */
  async logHttp(options: {
    method: string;
    url: string;
    rawCommand?: string;
    requestHeaders?: Record<string, string>;
    requestBody?: string;
    status: number | null;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    durationMs?: number;
    error?: string;
    assertionsPassed?: number;
    assertionsFailed?: number;
    extractedVars?: string[];
  }): Promise<void> {
    // Redact sensitive data
    const redactedRequestHeaders = options.requestHeaders ? redactHeaders(options.requestHeaders) : undefined;

    // Redact and truncate request body
    let requestBody = options.requestBody;
    let requestBodyTruncated = false;
    if (requestBody) {
      requestBody = redactBody(requestBody);
      const truncated = truncateBody(requestBody, this.maxBodySize);
      requestBody = truncated.body;
      requestBodyTruncated = truncated.truncated;
    }

    // Truncate response body (no redaction needed for responses)
    let responseBody = options.responseBody;
    let responseBodyTruncated = false;
    if (responseBody) {
      const truncated = truncateBody(responseBody, this.maxBodySize);
      responseBody = truncated.body;
      responseBodyTruncated = truncated.truncated;
    }

    const entry: HttpEntry = {
      type: 'http',
      timestamp: new Date().toISOString(),
      method: options.method,
      url: options.url,
      status: options.status,
    };

    // Add optional fields only if present
    if (options.rawCommand) {
      entry.rawCommand = options.rawCommand;
    }
    if (redactedRequestHeaders && Object.keys(redactedRequestHeaders).length > 0) {
      entry.requestHeaders = redactedRequestHeaders;
    }
    if (requestBody) {
      entry.requestBody = requestBody;
      if (requestBodyTruncated) {
        entry.requestBodyTruncated = true;
      }
    }
    if (options.responseHeaders && Object.keys(options.responseHeaders).length > 0) {
      entry.responseHeaders = options.responseHeaders;
    }
    if (responseBody) {
      entry.responseBody = responseBody;
      if (responseBodyTruncated) {
        entry.responseBodyTruncated = true;
      }
    }
    if (options.durationMs !== undefined) {
      entry.durationMs = options.durationMs;
    }
    if (options.error) {
      entry.error = options.error;
    }
    if (options.assertionsPassed !== undefined) {
      entry.assertionsPassed = options.assertionsPassed;
    }
    if (options.assertionsFailed !== undefined) {
      entry.assertionsFailed = options.assertionsFailed;
    }
    if (options.extractedVars && options.extractedVars.length > 0) {
      entry.extractedVars = options.extractedVars;
    }

    try {
      await this.appendEntry(entry);
    } catch (err) {
      // Log warning but don't block request execution
      consola.warn(`Failed to log HTTP request to history: ${(err as Error).message}`);
    }
  }

  /**
   * Clear history entries
   * @param startIndex - Optional start index (0 = most recent). If not provided, clears all.
   * @param endIndex - Optional end index (inclusive). If not provided, clears from start to end.
   * @returns Number of entries cleared
   */
  async clear(startIndex?: number, endIndex?: number): Promise<number> {
    try {
      // Read all entries
      const content = await readFile(this.historyPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      if (lines.length === 0) {
        return 0;
      }

      // If no range specified, clear all
      if (startIndex === undefined) {
        await writeFile(this.historyPath, '');
        return lines.length;
      }

      // Entries are in chronological order (oldest first), but user specifies in reverse (0 = most recent)
      // So we need to convert indices
      const totalEntries = lines.length;

      // Validate indices
      const start = Math.max(0, startIndex);
      const end = endIndex !== undefined ? Math.min(endIndex, totalEntries - 1) : totalEntries - 1;

      if (start > end || start >= totalEntries) {
        return 0;
      }

      // Convert from "most recent first" to "file order" (oldest first)
      // User's index 0 = file's last line (totalEntries - 1)
      const fileStartIndex = totalEntries - 1 - end; // Inclusive start in file order
      const fileEndIndex = totalEntries - 1 - start; // Inclusive end in file order

      // Keep entries outside the range
      const remainingLines = lines.filter((_, i) => i < fileStartIndex || i > fileEndIndex);
      const clearedCount = lines.length - remainingLines.length;

      // Write back remaining entries
      await writeFile(this.historyPath, remainingLines.length > 0 ? `${remainingLines.join('\n')}\n` : '');

      return clearedCount;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return 0; // File doesn't exist, nothing to clear
      }
      throw err;
    }
  }
}
