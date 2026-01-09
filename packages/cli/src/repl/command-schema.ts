/**
 * Command Schema Definitions for Extended Autocomplete
 *
 * Structured metadata for subcommands, flags, and flag values.
 * Used by useAutocomplete hook to provide context-aware suggestions.
 */

/**
 * Flag schema for autocomplete
 */
export interface FlagSchema {
  /** Short flag (e.g., "-H") */
  short?: string;
  /** Long flag (e.g., "--header") */
  long: string;
  /** Description for autocomplete */
  description?: string;
  /** Whether flag can be repeated (e.g., -H can be used multiple times) */
  repeatable?: boolean;
  /** Flag expects a value after it */
  takesValue?: boolean;
  /** Enum values for completion (if takesValue is true) */
  values?: string[];
}

/**
 * Subcommand schema for autocomplete
 */
export interface SubcommandSchema {
  /** Subcommand name */
  name: string;
  /** Description for autocomplete */
  description?: string;
  /** Subcommand-specific flags (in addition to parent flags) */
  flags?: FlagSchema[];
}

/**
 * Command schema for autocomplete
 */
export interface CommandSchema {
  /** Command name */
  name: string;
  /** Available subcommands (optional) */
  subcommands?: SubcommandSchema[];
  /** Available flags (optional) */
  flags?: FlagSchema[];
}

/**
 * Common HTTP request flags shared by GET, POST, PUT, PATCH, DELETE
 */
const HTTP_COMMON_FLAGS: FlagSchema[] = [
  { short: '-H', long: '--header', description: 'Add request header', repeatable: true, takesValue: true },
  { short: '-q', long: '--query', description: 'Add query parameter', repeatable: true, takesValue: true },
  { short: '-t', long: '--timeout', description: 'Request timeout in ms', takesValue: true },
  { short: '-o', long: '--output', description: 'Output mode', takesValue: true, values: ['pretty', 'json', 'raw'] },
  { short: '-i', long: '--include', description: 'Include response headers' },
  { short: '-S', long: '--summary', description: 'Show summary footer' },
  { short: '-B', long: '--no-body', description: 'Suppress response body' },
  { long: '--trace', description: 'Show timing information' },
  { long: '--no-redact', description: 'Disable secret redaction' },
  { long: '--isolate', description: 'Ignore workspace settings' },
  { short: '-e', long: '--export', description: 'Export as command', takesValue: true, values: ['curl', 'httpie'] },
];

/**
 * Flags for HTTP methods that support request body (POST, PUT, PATCH)
 */
const HTTP_BODY_FLAGS: FlagSchema[] = [
  ...HTTP_COMMON_FLAGS,
  { short: '-b', long: '--body', description: 'Request body (JSON)', takesValue: true },
];

/**
 * All command schemas for REPL commands
 */
export const COMMAND_SCHEMAS: CommandSchema[] = [
  // Navigation
  { name: 'cd', flags: [] },
  { name: 'ls', flags: [] },
  { name: 'pwd', flags: [] },

  // HTTP Methods
  { name: 'get', flags: HTTP_COMMON_FLAGS },
  { name: 'post', flags: HTTP_BODY_FLAGS },
  { name: 'put', flags: HTTP_BODY_FLAGS },
  { name: 'patch', flags: HTTP_BODY_FLAGS },
  { name: 'delete', flags: HTTP_COMMON_FLAGS },
  {
    name: 'head',
    flags: [
      { short: '-H', long: '--header', description: 'Add request header', repeatable: true, takesValue: true },
      { short: '-q', long: '--query', description: 'Add query parameter', repeatable: true, takesValue: true },
      { short: '-t', long: '--timeout', description: 'Request timeout in ms', takesValue: true },
      { short: '-i', long: '--include', description: 'Include response headers' },
      { short: '-B', long: '--no-body', description: 'Suppress response body' },
      { long: '--trace', description: 'Show timing information' },
      { long: '--no-redact', description: 'Disable secret redaction' },
      { long: '--isolate', description: 'Ignore workspace settings' },
      { short: '-e', long: '--export', description: 'Export as command', takesValue: true, values: ['curl', 'httpie'] },
    ],
  },
  {
    name: 'options',
    flags: [
      { short: '-H', long: '--header', description: 'Add request header', repeatable: true, takesValue: true },
      { short: '-t', long: '--timeout', description: 'Request timeout in ms', takesValue: true },
      { short: '-i', long: '--include', description: 'Include response headers' },
      { short: '-B', long: '--no-body', description: 'Suppress response body' },
      { long: '--trace', description: 'Show timing information' },
      { long: '--isolate', description: 'Ignore workspace settings' },
      { short: '-e', long: '--export', description: 'Export as command', takesValue: true, values: ['curl', 'httpie'] },
    ],
  },

  // Workspace
  {
    name: 'workspace',
    subcommands: [
      { name: 'list', description: 'List all workspaces' },
      { name: 'init', description: 'Create workspace in directory' },
      { name: 'register', description: 'Register existing workspace' },
      { name: 'unregister', description: 'Remove workspace from registry' },
      { name: 'use', description: 'Switch active workspace' },
      { name: 'current', description: 'Show active workspace and profile' },
      { name: 'doctor', description: 'Validate workspace configuration' },
    ],
  },
  {
    name: 'profile',
    subcommands: [
      { name: 'list', description: 'List available profiles' },
      {
        name: 'create',
        description: 'Create new profile',
        flags: [
          { long: '--from', description: 'Clone from existing profile', takesValue: true },
          { long: '--copy-vars', description: 'Copy vars from source' },
          { long: '--copy-secrets', description: 'Copy secrets from source' },
          { long: '--copy-all', description: 'Copy both vars and secrets' },
        ],
      },
      { name: 'rename', description: 'Rename a profile' },
      { name: 'delete', description: 'Delete a profile' },
      { name: 'use', description: 'Switch to profile' },
      { name: 'show', description: 'Show profile details' },
      { name: 'edit', description: 'Open workspace.yaml in editor' },
      { name: 'set', description: 'Set profile parameter' },
      { name: 'unset', description: 'Remove profile parameter' },
      { name: 'configure', description: 'Open interactive config modal' },
    ],
  },
  { name: 'describe', flags: [] },
  {
    name: 'import',
    flags: [
      { short: '-r', long: '--reload', description: 'Force reload (bypass cache)' },
      { short: '-a', long: '--auth', description: 'Use auth from active provider' },
      { short: '-H', long: '--header', description: 'Add custom header', repeatable: true, takesValue: true },
    ],
  },
  {
    name: 'defaults',
    subcommands: [
      { name: 'get', description: 'Show single default with source' },
      { name: 'set', description: 'Set session override' },
      { name: 'reset', description: 'Clear session override(s)' },
    ],
  },
  {
    name: 'settings',
    subcommands: [
      { name: 'get', description: 'Show single setting' },
      { name: 'set', description: 'Set setting (saved to config)' },
      { name: 'reset', description: 'Reset to default' },
    ],
  },

  // Collections
  { name: 'run', flags: [] },
  {
    name: 'save',
    flags: [{ long: '--name', description: 'Display name for saved request', takesValue: true }],
  },
  { name: 'extract', flags: [] },
  { name: 'vars', flags: [] },
  {
    name: 'history',
    subcommands: [
      { name: 'list', description: 'Show last N entries' },
      { name: 'http', description: 'Show HTTP requests only' },
      { name: 'cmd', description: 'Show commands only' },
      { name: 'show', description: 'Show full details' },
      { name: 'search', description: 'Search history' },
      { name: 'clear', description: 'Clear history (all or range)' },
    ],
  },

  // Security
  {
    name: 'secret',
    subcommands: [
      { name: 'status', description: 'Show backend and secrets status' },
      { name: 'init', description: 'Initialize a new vault' },
      { name: 'unlock', description: 'Unlock the vault' },
      { name: 'lock', description: 'Lock the vault' },
      { name: 'set', description: 'Set a secret' },
      { name: 'get', description: 'Get a secret value' },
      { name: 'list', description: 'List all secret names' },
      { name: 'delete', description: 'Delete a secret' },
      { name: 'backend', description: 'Show or configure secrets backend' },
    ],
  },
  {
    name: 'auth',
    subcommands: [
      { name: 'status', description: 'Show current auth status' },
      { name: 'list', description: 'List all configured providers' },
      { name: 'ls', description: 'List all configured providers (alias)' },
      { name: 'use', description: 'Set active auth provider' },
      { name: 'login', description: 'Resolve and display credentials' },
      { name: 'logout', description: 'Clear active authentication' },
      { name: 'show', description: 'Show provider config' },
    ],
  },

  // Utility
  { name: 'help', flags: [] },
  { name: 'version', flags: [] },
  { name: 'exit', flags: [] },
  { name: 'quit', flags: [] },
  { name: 'clear', flags: [] },
];

/**
 * Get command schema by name
 *
 * @param name - Command name (case-insensitive)
 * @returns CommandSchema or undefined if not found
 */
export function getCommandSchema(name: string): CommandSchema | undefined {
  return COMMAND_SCHEMAS.find((schema) => schema.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get subcommand schema from a command
 *
 * @param commandName - Parent command name
 * @param subcommandName - Subcommand name
 * @returns SubcommandSchema or undefined if not found
 */
export function getSubcommandSchema(commandName: string, subcommandName: string): SubcommandSchema | undefined {
  const command = getCommandSchema(commandName);
  if (!command?.subcommands) {
    return undefined;
  }
  return command.subcommands.find((sub) => sub.name.toLowerCase() === subcommandName.toLowerCase());
}

/**
 * Get all flag names for a command (short and long)
 *
 * @param schema - Command schema
 * @returns Array of flag strings (e.g., ["-H", "--header", "-q", "--query"])
 */
export function getAllFlagNames(schema: CommandSchema | SubcommandSchema): string[] {
  const flags = schema.flags ?? [];
  const result: string[] = [];

  for (const flag of flags) {
    if (flag.short) {
      result.push(flag.short);
    }
    result.push(flag.long);
  }

  return result;
}

/**
 * Find flag schema by short or long name
 *
 * @param schema - Command or subcommand schema
 * @param flagName - Flag name (e.g., "-H" or "--header")
 * @returns FlagSchema or undefined if not found
 */
export function findFlagSchema(schema: CommandSchema | SubcommandSchema, flagName: string): FlagSchema | undefined {
  const flags = schema.flags ?? [];
  return flags.find((flag) => flag.short === flagName || flag.long === flagName);
}

/**
 * Check if a command has subcommands
 *
 * @param commandName - Command name
 * @returns true if command has subcommands
 */
export function hasSubcommands(commandName: string): boolean {
  const schema = getCommandSchema(commandName);
  return schema?.subcommands !== undefined && schema.subcommands.length > 0;
}

/**
 * Get all subcommand names for a command
 *
 * @param commandName - Command name
 * @returns Array of subcommand names or empty array
 */
export function getSubcommandNames(commandName: string): string[] {
  const schema = getCommandSchema(commandName);
  if (!schema?.subcommands) {
    return [];
  }
  return schema.subcommands.map((sub) => sub.name);
}
