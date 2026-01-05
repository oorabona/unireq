/**
 * Command Execution Hook
 *
 * Handles command execution and integrates with transcript state.
 * Captures console output and updates app state.
 */

import { useCallback, useState } from 'react';
import type { TranscriptEvent } from '../state/types.js';
import { captureOutput } from '../utils/capture.js';

/**
 * Command execution result
 */
export interface CommandResult {
  /** Whether command executed successfully */
  success: boolean;
  /** Output lines from command */
  output: string[];
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  timing: number;
}

/**
 * Command executor function type
 */
export type CommandExecutor = (command: string, args: string[]) => Promise<void>;

/**
 * useCommand hook configuration
 */
export interface UseCommandConfig {
  /** Command executor function */
  executor?: CommandExecutor;
  /** Callback when command completes */
  onResult?: (result: CommandResult) => void;
  /** Callback to add event to transcript */
  onTranscriptEvent?: (event: Omit<TranscriptEvent, 'id' | 'timestamp'>) => void;
}

/**
 * useCommand hook state
 */
export interface UseCommandState {
  /** Whether a command is currently executing */
  isExecuting: boolean;
  /** Last execution result */
  lastResult?: CommandResult;
  /** Execute a command string */
  execute: (input: string) => Promise<CommandResult>;
  /** Parse command string into command and args */
  parseCommand: (input: string) => { command: string; args: string[] };
}

/**
 * Parse command string into command and arguments
 */
export function parseCommand(input: string): { command: string; args: string[] } {
  const trimmed = input.trim();

  if (!trimmed) {
    return { command: '', args: [] };
  }

  // Simple parsing - split on whitespace, respecting quotes
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuote) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return {
    command: parts[0] || '',
    args: parts.slice(1),
  };
}

/**
 * Default executor that just logs the command
 */
const defaultExecutor: CommandExecutor = async (command, args) => {
  console.log(`Executing: ${command} ${args.join(' ')}`);
};

/**
 * Hook for command execution
 *
 * @example
 * ```tsx
 * function CommandLine() {
 *   const { execute, isExecuting } = useCommand({
 *     executor: registry.execute.bind(registry),
 *     onTranscriptEvent: (event) => dispatch({ type: 'ADD_TRANSCRIPT', event }),
 *   });
 *
 *   const handleSubmit = async (input: string) => {
 *     const result = await execute(input);
 *     if (!result.success) {
 *       console.error(result.error);
 *     }
 *   };
 * }
 * ```
 */
export function useCommand(config: UseCommandConfig = {}): UseCommandState {
  const { executor = defaultExecutor, onResult, onTranscriptEvent } = config;

  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | undefined>();

  const execute = useCallback(
    async (input: string): Promise<CommandResult> => {
      const { command, args } = parseCommand(input);

      if (!command) {
        return { success: true, output: [], timing: 0 };
      }

      setIsExecuting(true);
      const startTime = Date.now();

      // Add command to transcript
      onTranscriptEvent?.({
        type: 'command',
        content: input,
      });

      try {
        // Capture output during execution
        const captured = await captureOutput(async () => {
          await executor(command, args);
        });

        const timing = Date.now() - startTime;
        const output = captured.lines.map((l) => l.text);

        // Check if captureOutput caught an error (it catches but doesn't re-throw)
        if (captured.error) {
          const errorMessage = captured.error.message;

          const result: CommandResult = {
            success: false,
            output,
            error: errorMessage,
            timing,
          };

          // Add any output that was captured before the error
          if (output.length > 0) {
            onTranscriptEvent?.({
              type: 'meta',
              content: output.join('\n'),
            });
          }

          // Add error to transcript
          onTranscriptEvent?.({
            type: 'error',
            content: errorMessage,
          });

          setLastResult(result);
          onResult?.(result);

          return result;
        }

        const result: CommandResult = {
          success: !captured.lines.some((l) => l.level === 'error'),
          output,
          timing,
        };

        // Add output to transcript
        // Note: 'result' type is reserved for HTTP responses with ResultContent object
        // For command text output, use 'meta' (success) or 'error' (failure)
        if (output.length > 0) {
          onTranscriptEvent?.({
            type: result.success ? 'meta' : 'error',
            content: output.join('\n'),
          });
        }

        setLastResult(result);
        onResult?.(result);

        return result;
      } catch (err) {
        const timing = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        const result: CommandResult = {
          success: false,
          output: [],
          error: errorMessage,
          timing,
        };

        // Add error to transcript
        onTranscriptEvent?.({
          type: 'error',
          content: errorMessage,
        });

        setLastResult(result);
        onResult?.(result);

        return result;
      } finally {
        setIsExecuting(false);
      }
    },
    [executor, onResult, onTranscriptEvent],
  );

  return {
    isExecuting,
    lastResult,
    execute,
    parseCommand,
  };
}
