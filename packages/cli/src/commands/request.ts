/**
 * Request command - executes HTTP request
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import { type ExportFormat, exportRequest } from '../output/index.js';
import type { OutputMode } from '../output/types.js';
import { resolveHttpDefaults } from '../shared/http-options.js';
import type { HttpMethod, ParsedRequest } from '../types.js';
import { loadWorkspaceConfig } from '../workspace/config/loader.js';
import type { HttpMethodName } from '../workspace/config/types.js';
import { findWorkspace } from '../workspace/detection.js';
import { getActiveProfile } from '../workspace/global-config.js';

/**
 * Valid output modes
 */
const VALID_OUTPUT_MODES = new Set(['pretty', 'json', 'raw']);

/**
 * Valid export formats
 */
const VALID_EXPORT_FORMATS = new Set(['curl', 'httpie']);

/**
 * Parse and validate export format
 * @returns ExportFormat or undefined
 */
export function parseExportFormat(format: string | undefined): ExportFormat | undefined {
  if (!format) return undefined;
  const lower = format.toLowerCase();
  if (!VALID_EXPORT_FORMATS.has(lower)) {
    throw new Error(`Invalid export format: ${format}. Valid formats: ${[...VALID_EXPORT_FORMATS].join(', ')}`);
  }
  return lower as ExportFormat;
}

/**
 * Parse and validate output mode
 * @returns OutputMode (defaults to 'pretty')
 */
export function parseOutputMode(mode: string | undefined): OutputMode {
  if (!mode) return 'pretty';
  const lower = mode.toLowerCase();
  if (!VALID_OUTPUT_MODES.has(lower)) {
    throw new Error(`Invalid output mode: ${mode}. Valid modes: ${[...VALID_OUTPUT_MODES].join(', ')}`);
  }
  return lower as OutputMode;
}

/**
 * Valid HTTP methods (uppercase)
 */
const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Parse and validate HTTP method
 */
function parseMethod(method: string): HttpMethod {
  const upper = method.toUpperCase();
  if (!VALID_METHODS.has(upper)) {
    throw new Error(`Invalid HTTP method: ${method}. Valid methods: ${[...VALID_METHODS].join(', ')}`);
  }
  return upper as HttpMethod;
}

/**
 * Collect array option (handles string or string[])
 */
function collectArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Request subcommand - executes HTTP request with method and URL
 */
export const requestCommand = defineCommand({
  meta: {
    name: 'request',
    description: 'Execute HTTP request',
  },
  args: {
    method: {
      type: 'positional',
      description: 'HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)',
      required: true,
    },
    url: {
      type: 'positional',
      description: 'Target URL (absolute or relative)',
      required: true,
    },
    header: {
      type: 'string',
      description: 'Add header (key:value), repeatable',
      alias: 'H',
    },
    query: {
      type: 'string',
      description: 'Add query param (key=value), repeatable',
      alias: 'q',
    },
    body: {
      type: 'string',
      description: 'Request body (JSON string or @filepath)',
      alias: 'b',
    },
    timeout: {
      type: 'string',
      description: 'Request timeout in milliseconds',
      alias: 't',
    },
    output: {
      type: 'string',
      description: 'Output mode: pretty (default), json, raw',
      alias: 'o',
    },
    include: {
      type: 'boolean',
      description: 'Include response headers in output',
      alias: 'i',
      default: false,
    },
    'no-redact': {
      type: 'boolean',
      description: 'Disable secret redaction (show Authorization, tokens, etc.)',
      default: false,
    },
    summary: {
      type: 'boolean',
      description: 'Show summary footer with status and size',
      alias: 'S',
      default: false,
    },
    trace: {
      type: 'boolean',
      description: 'Show timing information',
      default: false,
    },
    export: {
      type: 'string',
      description: 'Export request as command: curl, httpie',
      alias: 'e',
    },
    'no-body': {
      type: 'boolean',
      description: 'Suppress response body output',
      alias: 'B',
      default: false,
    },
  },
  async run({ args }) {
    // Parse and validate method
    const method = parseMethod(args.method as string);
    const url = args.url as string;
    const outputMode = parseOutputMode(args.output as string | undefined);
    const exportFormat = parseExportFormat(args.export as string | undefined);

    // Collect headers and query params (may be single string or array)
    const headers = collectArray(args.header as string | string[] | undefined);
    const query = collectArray(args.query as string | string[] | undefined);

    // Build parsed request
    const request: ParsedRequest = {
      method,
      url,
      headers,
      query,
      body: args.body as string | undefined,
      timeout: args.timeout ? Number.parseInt(args.timeout as string, 10) : undefined,
      outputMode,
      trace: args.trace as boolean,
      includeHeaders: args.include as boolean,
      showSecrets: args['no-redact'] as boolean,
      showSummary: args.summary as boolean,
      hideBody: args['no-body'] as boolean,
    };

    // Export mode: display command instead of executing
    if (exportFormat) {
      const exported = exportRequest(request, exportFormat);
      consola.log(exported);
      return;
    }

    // Execute the request - exit with code 1 on error
    const result = await executeRequest(request);
    if (result === undefined) {
      process.exitCode = 1;
    }
  },
});

/**
 * Execute request handler (shared between request and shortcuts)
 * Returns parsed request for testing
 *
 * @param defaults - Pre-resolved defaults from workspace/profile config
 */
export function handleRequest(
  method: HttpMethod,
  url: string,
  options: {
    header?: string | string[];
    query?: string | string[];
    body?: string;
    timeout?: string;
    output?: OutputMode;
    trace?: boolean;
    includeHeaders?: boolean;
    showSecrets?: boolean;
    showSummary?: boolean;
    hideBody?: boolean;
  },
  defaults?: {
    outputMode?: OutputMode;
    trace?: boolean;
    includeHeaders?: boolean;
    showSecrets?: boolean;
    showSummary?: boolean;
    hideBody?: boolean;
  },
): ParsedRequest {
  const headers = collectArray(options.header);
  const query = collectArray(options.query);

  // Apply defaults first, then CLI options override
  return {
    method,
    url,
    headers,
    query,
    body: options.body,
    timeout: options.timeout ? Number.parseInt(options.timeout, 10) : undefined,
    // CLI args override defaults (undefined CLI arg = use default)
    outputMode: options.output ?? defaults?.outputMode,
    trace: options.trace ?? defaults?.trace,
    includeHeaders: options.includeHeaders ?? defaults?.includeHeaders,
    showSecrets: options.showSecrets ?? defaults?.showSecrets,
    showSummary: options.showSummary ?? defaults?.showSummary,
    hideBody: options.hideBody ?? defaults?.hideBody,
  };
}

/**
 * Load workspace config and resolve defaults for a method
 * @returns Resolved defaults or undefined if no workspace
 * @deprecated Use loadDefaultsWithContext for kubectl-like context resolution
 */
export function loadDefaultsForMethod(method: HttpMethod): ReturnType<typeof resolveHttpDefaults> | undefined {
  try {
    const workspace = findWorkspace();
    if (!workspace) return undefined;

    const config = loadWorkspaceConfig(workspace.path);
    if (!config) return undefined;

    // Get active profile from global config
    const activeProfileName = getActiveProfile();
    const profileDefaults = activeProfileName ? config.profiles?.[activeProfileName]?.defaults : undefined;

    const methodName = method.toLowerCase() as HttpMethodName;
    return resolveHttpDefaults(methodName, config.defaults, profileDefaults);
  } catch {
    // Silently ignore errors - no defaults
    return undefined;
  }
}

import { type ResolveContextOptions, resolveContext } from '../workspace/context-resolver.js';
import { ensureWorkspaceExists } from '../workspace/global-workspace.js';
import { getWorkspace } from '../workspace/registry/loader.js';

/**
 * Context-aware options for loading defaults
 */
export interface LoadDefaultsOptions {
  /** HTTP method */
  method: HttpMethod;
  /** Context resolution options (flags, etc.) */
  context?: ResolveContextOptions;
  /** Whether to auto-create global workspace if needed */
  autoCreate?: boolean;
}

/**
 * Load workspace config and resolve defaults with kubectl-like context resolution
 *
 * Priority order:
 * 1. --workspace flag → look up in registry
 * 2. UNIREQ_WORKSPACE env var → look up in registry
 * 3. activeWorkspace in global config → look up in registry
 * 4. Local .unireq/ directory (findWorkspace)
 * 5. Auto-created global workspace (if autoCreate=true)
 *
 * @param options - Load options including method and context
 * @returns Resolved defaults or undefined if no workspace
 */
export function loadDefaultsWithContext(
  options: LoadDefaultsOptions,
): ReturnType<typeof resolveHttpDefaults> | undefined {
  const { method, context, autoCreate = true } = options;

  try {
    // Auto-create global workspace if needed
    if (autoCreate) {
      ensureWorkspaceExists();
    }

    // Resolve workspace and profile context
    const resolved = resolveContext(context);

    // Determine workspace path
    let workspacePath: string | undefined;

    if (resolved.workspace) {
      // Look up workspace in registry
      const entry = getWorkspace(resolved.workspace);
      if (entry) {
        workspacePath = entry.path;
      } else {
        // Workspace name provided but not found in registry
        consola.error(`workspace '${resolved.workspace}' not found`);
        process.exitCode = 1;
        return undefined;
      }
    } else {
      // Fall back to local workspace detection
      const local = findWorkspace();
      if (local) {
        workspacePath = local.path;
      }
    }

    if (!workspacePath) {
      return undefined;
    }

    // Load workspace config
    const config = loadWorkspaceConfig(workspacePath);
    if (!config) {
      return undefined;
    }

    // Determine profile name from context (already resolved from global config)
    const profileName = resolved.profile;

    // Validate profile exists
    if (profileName && config.profiles && !(profileName in config.profiles)) {
      consola.error(`profile '${profileName}' not found in workspace`);
      process.exitCode = 1;
      return undefined;
    }

    const profileDefaults = profileName ? config.profiles?.[profileName]?.defaults : undefined;
    const methodName = method.toLowerCase() as HttpMethodName;

    return resolveHttpDefaults(methodName, config.defaults, profileDefaults);
  } catch {
    // Silently ignore errors - no defaults
    return undefined;
  }
}
