/**
 * Shared help metadata for REPL commands
 * Used by both shell CLI (repl --help) and REPL internal help
 */

/**
 * Command metadata for help display
 */
export interface CommandMeta {
  /** Command name */
  name: string;
  /** Short description for list view */
  description: string;
  /** Category for grouping in help */
  category: CommandCategory;
  /** Detailed help text (optional) */
  helpText?: string;
}

/**
 * Command categories for organized help display
 */
export type CommandCategory = 'navigation' | 'http' | 'workspace' | 'collections' | 'security' | 'utility';

/**
 * Category display names and order
 */
export const CATEGORY_INFO: Record<CommandCategory, { label: string; order: number }> = {
  navigation: { label: 'Navigation', order: 1 },
  http: { label: 'HTTP Requests', order: 2 },
  workspace: { label: 'Workspace & Profiles', order: 3 },
  collections: { label: 'Collections & History', order: 4 },
  security: { label: 'Security & Auth', order: 5 },
  utility: { label: 'Utility', order: 6 },
};

/**
 * All REPL command metadata
 * Source of truth for command descriptions
 */
export const REPL_COMMANDS: CommandMeta[] = [
  // Navigation
  {
    name: 'cd',
    description: 'Change current API path',
    category: 'navigation',
    helpText: `Usage: cd <path>

Navigate to a different API path. Supports relative and absolute paths.

Examples:
  cd /users          Navigate to /users
  cd {id}            Navigate to child path with parameter
  cd ..              Navigate up one level
  cd /               Navigate to root`,
  },
  {
    name: 'ls',
    description: 'List available paths and operations',
    category: 'navigation',
    helpText: `Usage: ls [path]

List child paths and available HTTP methods at current or specified path.

Examples:
  ls                 List current path contents
  ls /users          List contents of /users`,
  },
  {
    name: 'pwd',
    description: 'Print current API path',
    category: 'navigation',
  },

  // HTTP Methods
  {
    name: 'get',
    description: 'Execute GET request',
    category: 'http',
    helpText: `Usage: get <url> [options]

Execute a GET request to the specified URL.

Options:
  -H, --header <k:v>   Add request header (repeatable)
  -q, --query <k=v>    Add query parameter (repeatable)
  -t, --timeout <ms>   Request timeout in milliseconds
  -o, --output <mode>  Output mode: pretty, json, raw
  -i, --include        Include response headers in output
  -S, --summary        Show summary footer with status and size
  -B, --no-body        Suppress response body output
      --trace          Show timing information
      --no-redact      Disable secret redaction
  -e, --export <fmt>   Export as command: curl, httpie

Examples:
  get /users              GET current base + /users
  get /users/{id}         GET with path parameter
  get /search -q q=test   GET with query parameter
  get /users -i -S        GET with headers and summary
  get /users -i -B        GET headers only (no body)`,
  },
  {
    name: 'post',
    description: 'Execute POST request',
    category: 'http',
    helpText: `Usage: post <url> [options]

Execute a POST request with optional JSON body.

Options:
  -H, --header <k:v>   Add request header (repeatable)
  -q, --query <k=v>    Add query parameter (repeatable)
  -b, --body <json>    Request body (JSON string or @filepath)
  -t, --timeout <ms>   Request timeout in milliseconds
  -o, --output <mode>  Output mode: pretty, json, raw
  -i, --include        Include response headers in output
  -S, --summary        Show summary footer with status and size
  -B, --no-body        Suppress response body output
      --trace          Show timing information
      --no-redact      Disable secret redaction
  -e, --export <fmt>   Export as command: curl, httpie

Examples:
  post /users -b '{"name": "Alice"}'   POST with inline JSON
  post /users                          POST with multiline JSON input`,
  },
  {
    name: 'put',
    description: 'Execute PUT request',
    category: 'http',
    helpText: `Usage: put <url> [options]

Execute a PUT request with optional JSON body.

Options:
  -H, --header <k:v>   Add request header (repeatable)
  -q, --query <k=v>    Add query parameter (repeatable)
  -b, --body <json>    Request body (JSON string or @filepath)
  -t, --timeout <ms>   Request timeout in milliseconds
  -o, --output <mode>  Output mode: pretty, json, raw
  -i, --include        Include response headers in output
  -S, --summary        Show summary footer
  -B, --no-body        Suppress response body output
      --trace          Show timing information
      --no-redact      Disable secret redaction
  -e, --export <fmt>   Export as command: curl, httpie

Examples:
  put /users/123 -b '{"name": "Bob"}'   PUT with inline JSON`,
  },
  {
    name: 'patch',
    description: 'Execute PATCH request',
    category: 'http',
    helpText: `Usage: patch <url> [options]

Execute a PATCH request with optional JSON body.

Options:
  -H, --header <k:v>   Add request header (repeatable)
  -q, --query <k=v>    Add query parameter (repeatable)
  -b, --body <json>    Request body (JSON string or @filepath)
  -t, --timeout <ms>   Request timeout in milliseconds
  -o, --output <mode>  Output mode: pretty, json, raw
  -i, --include        Include response headers in output
  -S, --summary        Show summary footer
  -B, --no-body        Suppress response body output
      --trace          Show timing information
      --no-redact      Disable secret redaction
  -e, --export <fmt>   Export as command: curl, httpie

Examples:
  patch /users/123 -b '{"status": "active"}'`,
  },
  {
    name: 'delete',
    description: 'Execute DELETE request',
    category: 'http',
    helpText: `Usage: delete <url> [options]

Execute a DELETE request.

Options:
  -H, --header <k:v>   Add request header (repeatable)
  -q, --query <k=v>    Add query parameter (repeatable)
  -t, --timeout <ms>   Request timeout in milliseconds
  -o, --output <mode>  Output mode: pretty, json, raw
  -i, --include        Include response headers in output
  -S, --summary        Show summary footer
  -B, --no-body        Suppress response body output
      --trace          Show timing information
      --no-redact      Disable secret redaction
  -e, --export <fmt>   Export as command: curl, httpie

Examples:
  delete /users/123`,
  },
  {
    name: 'head',
    description: 'Execute HEAD request',
    category: 'http',
    helpText: `Usage: head <url> [options]

Execute a HEAD request (returns headers only, no body).

Options:
  -H, --header <k:v>   Add request header (repeatable)
  -q, --query <k=v>    Add query parameter (repeatable)
  -t, --timeout <ms>   Request timeout in milliseconds
  -i, --include        Include response headers in output
  -B, --no-body        Suppress response body output
      --trace          Show timing information
      --no-redact      Disable secret redaction
  -e, --export <fmt>   Export as command: curl, httpie

Examples:
  head /users          Check if resource exists
  head /files/doc.pdf  Get content-length without downloading`,
  },
  {
    name: 'options',
    description: 'Execute OPTIONS request',
    category: 'http',
    helpText: `Usage: options <url> [options]

Execute an OPTIONS request (returns allowed methods).

Options:
  -H, --header <k:v>   Add request header (repeatable)
  -t, --timeout <ms>   Request timeout in milliseconds
  -i, --include        Include response headers in output
  -B, --no-body        Suppress response body output
      --trace          Show timing information
  -e, --export <fmt>   Export as command: curl, httpie

Examples:
  options /users       Check allowed methods on /users
  options /api         CORS preflight check`,
  },

  // Workspace
  {
    name: 'workspace',
    description: 'Manage workspaces',
    category: 'workspace',
    helpText: `Usage: workspace [subcommand]

Manage workspaces (kubectl-inspired model):
  - Workspace = 1 API (like kubectl cluster)
  - Profile = 1 environment within that API (like kubectl context)

Location types:
  - LOCAL: Created in current directory (.unireq/), auto-detected
  - GLOBAL: Named workspaces stored in ~/.config/unireq/

Subcommands:
  workspace list              List all workspaces (local + global)
  workspace init [dir]        Create workspace in directory
  workspace register <name> <path>  Register existing workspace
  workspace unregister <name> Remove workspace from registry
  workspace use <name>        Switch active workspace
  workspace current           Show active workspace and profile
  workspace doctor [path]     Validate workspace configuration

Examples:
  workspace init              Create .unireq/ in current directory
  workspace register prod-api /path/to/.unireq
                              Register "prod-api" as named workspace
  workspace use prod-api      Switch to "prod-api"
  workspace current           Show active workspace and profile`,
  },
  {
    name: 'profile',
    description: 'Manage environment profiles',
    category: 'workspace',
    helpText: `Usage: profile [subcommand]

Manage profiles for different environments within a workspace.
Profiles contain baseUrl, vars, and secrets for each environment.

Subcommands:
  profile list                   List available profiles
  profile create <name> [opts]   Create new profile
  profile rename <old> <new>     Rename a profile
  profile delete <name>          Delete a profile
  profile use <name>             Switch to profile
  profile show [name]            Show profile details
  profile edit                   Open workspace.yaml in editor

Create Options:
  --from <profile>      Clone from existing profile
  --copy-vars           Copy vars from source (with --from)
  --copy-secrets        Copy secrets from source (with --from)
  --copy-all            Copy both vars and secrets

Examples:
  profile list                       Show all profiles
  profile create staging             Create empty staging profile
  profile create prod --from dev     Clone dev to prod
  profile use production             Switch to production
  profile edit                       Edit workspace.yaml`,
  },
  {
    name: 'describe',
    description: 'Describe OpenAPI operation',
    category: 'workspace',
    helpText: `Usage: describe [path] [method]

Show OpenAPI spec details for an operation.

Examples:
  describe                  Describe current path
  describe /users GET       Describe specific operation`,
  },
  {
    name: 'import',
    description: 'Load OpenAPI spec from file or URL',
    category: 'workspace',
    helpText: `Usage: import <path-or-url> [options]

Load an OpenAPI spec to enable navigation and validation.

Options:
  --reload, -r    Force reload (bypass cache)

Examples:
  import ./openapi.yaml          Load from relative path
  import /path/to/spec.json      Load from absolute path
  import https://api.example.com/openapi.json  Load from URL

The loaded spec enables:
  - ls/cd navigation through API paths
  - describe command for endpoint documentation`,
  },
  {
    name: 'defaults',
    description: 'View and manage HTTP output defaults',
    category: 'workspace',
    helpText: `Usage: defaults [get|set|reset] [<key>] [<value>]

View and manage HTTP output defaults with source tracking.

Subcommands:
  defaults              Show all defaults with sources
  defaults get <key>    Show single default with source
  defaults set <key> <value>  Set session override
  defaults reset [<key>]      Clear session override(s)

Valid keys:
  includeHeaders   Include response headers (-i)
  outputMode       Output mode: pretty, json, raw (-o)
  showSummary      Show summary footer (-S)
  trace            Show timing information (--trace)
  showSecrets      Disable secret redaction (--no-redact)
  hideBody         Hide response body (-B)

Priority order (highest to lowest):
  1. CLI flags
  2. Session overrides (set via this command)
  3. Profile method-specific
  4. Profile general
  5. Workspace method-specific
  6. Workspace general
  7. Built-in defaults

Examples:
  defaults                    Show all current defaults
  defaults get includeHeaders Get specific value and source
  defaults set trace true     Enable trace for this session
  defaults reset trace        Clear trace override
  defaults reset              Clear all session overrides`,
  },

  // Collections
  {
    name: 'run',
    description: 'Execute saved request from collections',
    category: 'collections',
    helpText: `Usage: run <collection>/<item>

Execute a saved request from your collections.

Examples:
  run api/get-users         Run 'get-users' from 'api' collection`,
  },
  {
    name: 'save',
    description: 'Save last request to a collection',
    category: 'collections',
    helpText: `Usage: save <collection>/<item> [--name "Display Name"]

Save the last executed request to a collection.

Examples:
  save api/login --name "Login request"`,
  },
  {
    name: 'extract',
    description: 'Extract value from last response',
    category: 'collections',
    helpText: `Usage: extract <varName> <jsonPath>

Extract a value from the last response using JSONPath.

Examples:
  extract token $.access_token
  extract userId $.data.id`,
  },
  {
    name: 'vars',
    description: 'Show extracted variables',
    category: 'collections',
  },
  {
    name: 'history',
    description: 'Browse command and request history',
    category: 'collections',
    helpText: `Usage: history [subcommand]

Browse and search command/request history.

Subcommands:
  history                   Show last 20 entries
  history list [N]          Show last N entries
  history http              Show HTTP requests only
  history cmd               Show commands only
  history show <index>      Show full details
  history search <term>     Search history`,
  },

  // Security
  {
    name: 'secret',
    description: 'Manage secrets vault',
    category: 'security',
    helpText: `Usage: secret <subcommand>

Manage encrypted secrets in the vault.

Subcommands:
  secret set <name>         Set a secret (prompts for value)
  secret get <name>         Get a secret value
  secret list               List all secrets
  secret delete <name>      Delete a secret`,
  },
  {
    name: 'auth',
    description: 'Manage authentication',
    category: 'security',
    helpText: `Usage: auth <subcommand>

Manage authentication for requests.

Subcommands:
  auth login                Authenticate with configured provider
  auth status               Show current auth status
  auth logout               Clear authentication`,
  },

  // Utility
  {
    name: 'help',
    description: 'Show available commands or detailed help',
    category: 'utility',
    helpText: `Usage: help [command]

Show list of available commands, or detailed help for a specific command.

Examples:
  help              Show all commands
  help get          Show detailed help for GET command`,
  },
  {
    name: 'version',
    description: 'Show CLI version',
    category: 'utility',
  },
  {
    name: 'exit',
    description: 'Exit the REPL',
    category: 'utility',
  },
];

/**
 * Get commands grouped by category
 */
export function getCommandsByCategory(): Map<CommandCategory, CommandMeta[]> {
  const grouped = new Map<CommandCategory, CommandMeta[]>();

  for (const cmd of REPL_COMMANDS) {
    const existing = grouped.get(cmd.category) ?? [];
    existing.push(cmd);
    grouped.set(cmd.category, existing);
  }

  return grouped;
}

/**
 * Get command metadata by name
 */
export function getCommandMeta(name: string): CommandMeta | undefined {
  return REPL_COMMANDS.find((cmd) => cmd.name === name);
}

/**
 * Format help text for shell display (repl --help)
 */
export function formatShellHelp(): string {
  const lines: string[] = [];
  const grouped = getCommandsByCategory();

  // Sort categories by order
  const sortedCategories = [...grouped.entries()].sort(([a], [b]) => CATEGORY_INFO[a].order - CATEGORY_INFO[b].order);

  for (const [category, commands] of sortedCategories) {
    lines.push('');
    lines.push(`${CATEGORY_INFO[category].label}:`);

    for (const cmd of commands) {
      lines.push(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format keyboard shortcuts help
 */
export function formatKeyboardHelp(): string {
  return `
Keyboard Shortcuts:
  Tab           Auto-complete commands and paths
  Up/Down       Navigate command history
  Ctrl+R        Reverse search history
  Ctrl+C        Cancel current input
  Ctrl+D        Exit REPL

Multiline Input:
  JSON bodies can span multiple lines. The REPL detects
  incomplete JSON (unclosed braces/brackets) and waits
  for more input.`;
}
