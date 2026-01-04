/**
 * Output Capture Utility
 *
 * Bridges existing consola-based output to Ink transcript events.
 * Allows capturing command output and converting to structured events.
 */

import { consola } from 'consola';

/**
 * Log level types
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

/**
 * A single captured log line
 */
export interface CapturedLine {
  level: LogLevel;
  text: string;
  timestamp: Date;
}

/**
 * Result of capturing output from a function execution
 */
export interface CapturedOutput {
  /** Captured log lines */
  lines: CapturedLine[];
  /** Whether the function threw an error */
  error?: Error;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Map consola log types to our log levels
 */
function mapLogType(type: string): LogLevel {
  switch (type) {
    case 'error':
    case 'fatal':
      return 'error';
    case 'warn':
      return 'warn';
    case 'success':
    case 'ready':
    case 'start':
      return 'success';
    case 'debug':
    case 'trace':
    case 'verbose':
      return 'debug';
    default:
      return 'info';
  }
}

/**
 * Capture all consola output during function execution
 *
 * Temporarily replaces consola reporters to intercept all log calls,
 * then restores original reporters after execution.
 *
 * @param fn - Async function to execute while capturing output
 * @returns Captured output including lines, any error, and duration
 *
 * @example
 * ```ts
 * const output = await captureOutput(async () => {
 *   consola.info('Starting request...');
 *   await executeRequest();
 *   consola.success('Done!');
 * });
 * // output.lines contains all logged messages
 * ```
 */
export async function captureOutput(fn: () => Promise<void>): Promise<CapturedOutput> {
  const lines: CapturedLine[] = [];
  const startTime = Date.now();

  // Save original settings
  const originalReporters = consola.options.reporters;
  const originalLevel = consola.level;

  // Set level to capture all logs (5 = verbose, captures everything)
  consola.level = 5;

  // Replace with capturing reporter
  consola.options.reporters = [
    {
      log: (logObj) => {
        const text = logObj.args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');

        lines.push({
          level: mapLogType(logObj.type),
          text,
          timestamp: new Date(),
        });
      },
    },
  ];

  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
  } finally {
    // Restore original settings
    consola.options.reporters = originalReporters;
    consola.level = originalLevel;
  }

  return {
    lines,
    error,
    duration: Date.now() - startTime,
  };
}

/**
 * Convert captured output to a single string for display
 *
 * @param output - Captured output from captureOutput()
 * @returns Formatted string with all output
 */
export function formatCapturedOutput(output: CapturedOutput): string {
  return output.lines.map((line) => line.text).join('\n');
}

/**
 * Check if captured output contains errors
 *
 * @param output - Captured output to check
 * @returns true if any error-level logs or thrown error
 */
export function hasErrors(output: CapturedOutput): boolean {
  if (output.error) return true;
  return output.lines.some((line) => line.level === 'error');
}

/**
 * Check if captured output contains warnings
 *
 * @param output - Captured output to check
 * @returns true if any warn-level logs
 */
export function hasWarnings(output: CapturedOutput): boolean {
  return output.lines.some((line) => line.level === 'warn');
}
