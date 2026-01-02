/**
 * Shared HTTP options definition and parser
 * Used by both CLI external commands and REPL
 */

import type { ArgsDef } from 'citty';
import type { OutputMode } from '../output/types.js';
import type { HttpMethod, ParsedRequest } from '../types.js';

/**
 * Option definition for a single flag
 */
export interface OptionDefinition {
  /** Short flag (single char, e.g., 'H' for -H) */
  short?: string;
  /** Long flag (e.g., 'header' for --header) */
  long: string;
  /** Value type */
  type: 'string' | 'boolean' | 'number';
  /** Whether multiple values are allowed */
  multiple?: boolean;
  /** Default value */
  default?: unknown;
  /** Description for help text */
  description: string;
  /** Example usage */
  example?: string;
}

/**
 * Parsed HTTP options from command arguments
 */
export interface ParsedHttpOptions {
  /** Headers as key:value pairs */
  headers: string[];
  /** Query parameters as key=value pairs */
  query: string[];
  /** Request body (JSON string or @filepath) */
  body?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Output mode (pretty, json, raw) */
  outputMode?: OutputMode;
  /** Include response headers in output */
  includeHeaders?: boolean;
  /** Show secrets (disable redaction) */
  showSecrets?: boolean;
  /** Show summary footer with status and size */
  showSummary?: boolean;
  /** Enable trace mode with timing information */
  trace?: boolean;
  /** Export format (curl, httpie) */
  exportFormat?: string;
  /** Hide response body in output */
  hideBody?: boolean;
}

/**
 * HTTP options definitions - single source of truth
 */
export const HTTP_OPTIONS: OptionDefinition[] = [
  {
    short: 'H',
    long: 'header',
    type: 'string',
    multiple: true,
    description: 'Add header (key:value), repeatable',
    example: '-H "Authorization:Bearer token"',
  },
  {
    short: 'q',
    long: 'query',
    type: 'string',
    multiple: true,
    description: 'Add query param (key=value), repeatable',
    example: '-q "page=1"',
  },
  {
    short: 'b',
    long: 'body',
    type: 'string',
    description: 'Request body (JSON string or @filepath)',
    example: '-b \'{"name":"Alice"}\'',
  },
  {
    short: 't',
    long: 'timeout',
    type: 'number',
    description: 'Request timeout in milliseconds',
    example: '-t 5000',
  },
  {
    short: 'o',
    long: 'output',
    type: 'string',
    default: 'pretty',
    description: 'Output mode: pretty, json, raw',
    example: '-o json',
  },
  {
    short: 'i',
    long: 'include',
    type: 'boolean',
    default: false,
    description: 'Include response headers in output',
    example: '-i',
  },
  {
    long: 'no-redact',
    type: 'boolean',
    default: false,
    description: 'Disable secret redaction (show Authorization, tokens, etc.)',
    example: '--no-redact',
  },
  {
    short: 'S',
    long: 'summary',
    type: 'boolean',
    default: false,
    description: 'Show summary footer with status and size',
    example: '-S',
  },
  {
    long: 'trace',
    type: 'boolean',
    default: false,
    description: 'Show timing information',
    example: '--trace',
  },
  {
    short: 'e',
    long: 'export',
    type: 'string',
    description: 'Export request as command: curl, httpie',
    example: '-e curl',
  },
  {
    short: 'B',
    long: 'no-body',
    type: 'boolean',
    default: false,
    description: 'Suppress response body output (show headers/status only)',
    example: '-B',
  },
];

/**
 * Parse command arguments into HTTP options
 * @param args - Command arguments (after URL)
 * @returns Parsed options
 * @throws Error if unknown flag or invalid value
 */
export function parseHttpOptions(args: string[]): ParsedHttpOptions {
  const options: ParsedHttpOptions = {
    headers: [],
    query: [],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === undefined) break;

    // Not a flag - could be body (JSON) or error
    if (!arg.startsWith('-')) {
      // Inline JSON body detection
      if (arg.startsWith('{') || arg.startsWith('[')) {
        if (options.body !== undefined) {
          throw new Error('Multiple body arguments provided');
        }
        // Validate JSON syntax
        try {
          JSON.parse(arg);
        } catch {
          throw new Error(`Invalid JSON body: ${arg}`);
        }
        options.body = arg;
        i++;
        continue;
      }
      throw new Error(`Unexpected argument: ${arg}`);
    }

    // Parse flag
    const isShort = !arg.startsWith('--');
    const flagName = isShort ? arg.slice(1) : arg.slice(2);

    // Find matching option
    const optDef = HTTP_OPTIONS.find((opt) => (isShort ? opt.short === flagName : opt.long === flagName));

    if (!optDef) {
      throw new Error(`Unknown flag: ${arg}. Type 'help <command>' for available options.`);
    }

    // Boolean flags don't consume next arg
    if (optDef.type === 'boolean') {
      setOption(options, optDef.long, true);
      i++;
      continue;
    }

    // Get value for non-boolean flags
    i++;
    const value = args[i];
    if (value === undefined || value.startsWith('-')) {
      throw new Error(`Missing value for ${arg}`);
    }

    // Validate and set value
    if (optDef.type === 'number') {
      const numValue = Number(value);
      if (Number.isNaN(numValue)) {
        throw new Error(`Invalid number for ${arg}: ${value}`);
      }
      setOption(options, optDef.long, numValue);
    } else if (optDef.multiple) {
      // Validate format for headers and query
      if (optDef.long === 'header' && !value.includes(':')) {
        throw new Error(`Invalid header format: expected 'key:value', got '${value}'`);
      }
      if (optDef.long === 'query' && !value.includes('=')) {
        throw new Error(`Invalid query format: expected 'key=value', got '${value}'`);
      }
      appendOption(options, optDef.long, value);
    } else {
      setOption(options, optDef.long, value);
    }

    i++;
  }

  return options;
}

/**
 * Set a single option value
 */
function setOption(options: ParsedHttpOptions, name: string, value: unknown): void {
  switch (name) {
    case 'body':
      options.body = value as string;
      break;
    case 'timeout':
      options.timeout = value as number;
      break;
    case 'output':
      options.outputMode = value as OutputMode;
      break;
    case 'include':
      options.includeHeaders = value as boolean;
      break;
    case 'no-redact':
      options.showSecrets = value as boolean;
      break;
    case 'summary':
      options.showSummary = value as boolean;
      break;
    case 'trace':
      options.trace = value as boolean;
      break;
    case 'export':
      options.exportFormat = value as string;
      break;
    case 'no-body':
      options.hideBody = value as boolean;
      break;
  }
}

/**
 * Append to a multi-value option
 */
function appendOption(options: ParsedHttpOptions, name: string, value: string): void {
  switch (name) {
    case 'header':
      options.headers.push(value);
      break;
    case 'query':
      options.query.push(value);
      break;
  }
}

/**
 * Parse URL and options from REPL command arguments
 * @param method - HTTP method (any case, will be uppercased)
 * @param args - Command arguments (URL + flags)
 * @returns ParsedRequest ready for execution
 * @throws Error if URL missing or invalid options
 */
export function parseHttpCommand(method: string, args: string[]): ParsedRequest {
  if (args.length === 0) {
    throw new Error('URL is required');
  }

  // First non-flag argument is the URL
  const url = args[0];
  if (!url || url.startsWith('-')) {
    throw new Error('URL is required');
  }

  // Parse remaining arguments as options
  const remainingArgs = args.slice(1);
  const options = parseHttpOptions(remainingArgs);

  return {
    method: method.toUpperCase() as HttpMethod,
    url,
    headers: options.headers,
    query: options.query,
    body: options.body,
    timeout: options.timeout,
    outputMode: options.outputMode,
    includeHeaders: options.includeHeaders,
    showSecrets: options.showSecrets,
    showSummary: options.showSummary,
    trace: options.trace,
    hideBody: options.hideBody,
  };
}

/**
 * Generate help text for HTTP command options
 * @param commandName - Command name for the header
 * @returns Formatted help text
 */
export function generateHttpOptionsHelp(commandName: string): string {
  const lines: string[] = [];

  lines.push(`Usage: ${commandName} <url> [options]`);
  lines.push('');
  lines.push('Options:');

  for (const opt of HTTP_OPTIONS) {
    const flags: string[] = [];
    if (opt.short) {
      flags.push(`-${opt.short}`);
    }
    flags.push(`--${opt.long}`);

    const flagStr = flags.join(', ');
    const typeStr = opt.type === 'boolean' ? '' : ` <${opt.type}>`;
    const defaultStr = opt.default !== undefined ? ` (default: ${opt.default})` : '';

    lines.push(`  ${(flagStr + typeStr).padEnd(24)} ${opt.description}${defaultStr}`);
  }

  lines.push('');
  lines.push('Examples:');
  lines.push(`  ${commandName} /users`);
  lines.push(`  ${commandName} /users -H "Authorization:Bearer token"`);
  lines.push(`  ${commandName} /users -q "page=1" -q "limit=10"`);
  lines.push(`  ${commandName} /users -i -S`);

  return lines.join('\n');
}

/**
 * List of HTTP methods (lowercase for REPL commands)
 */
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

/**
 * Check if a string is a valid HTTP method
 */
export function isHttpMethod(str: string): boolean {
  return HTTP_METHODS.includes(str.toLowerCase() as (typeof HTTP_METHODS)[number]);
}

/**
 * Generate citty-compatible args object from HTTP_OPTIONS
 * Used by shell commands to share the same option definitions as REPL
 * Iterates over HTTP_OPTIONS to maintain DRY principle
 */
export function generateCittyArgs(): ArgsDef {
  const args: ArgsDef = {
    url: {
      type: 'positional',
      description: 'Target URL (absolute or relative)',
      required: true,
    },
  };

  for (const opt of HTTP_OPTIONS) {
    // citty uses 'string' for numbers (parsed later)
    const cittyType = opt.type === 'number' ? 'string' : opt.type;

    if (cittyType === 'boolean') {
      args[opt.long] = {
        type: 'boolean',
        description: opt.description,
        ...(opt.short && { alias: opt.short }),
        ...(opt.default !== undefined && { default: opt.default as boolean }),
      };
    } else {
      args[opt.long] = {
        type: 'string',
        description: opt.description,
        ...(opt.short && { alias: opt.short }),
        ...(opt.default !== undefined && { default: opt.default as string }),
      };
    }
  }

  return args;
}
