/**
 * HTTP command handlers for REPL
 * Creates command handlers for get, post, put, patch, delete, head, options
 */

import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import { exportRequest } from '../output/index.js';
import { generateHttpOptionsHelp, resolveHttpDefaults } from '../shared/http-options.js';
import type { HttpMethod, ParsedRequest } from '../types.js';
import type { HttpMethodName } from '../workspace/config/types.js';
import { parseHttpCommand } from './http-parser.js';
import type { Command, CommandHandler } from './types.js';
import { resolveUrl, UrlResolutionError } from './url-resolver.js';

/**
 * Get base URL from active profile in workspace config
 */
function getBaseUrl(state: {
  workspaceConfig?: { profiles?: Record<string, { baseUrl: string }> };
  activeProfile?: string;
}): string | undefined {
  if (!state.activeProfile || !state.workspaceConfig?.profiles) {
    return undefined;
  }
  return state.workspaceConfig.profiles[state.activeProfile]?.baseUrl;
}

/**
 * Create an HTTP command handler for a specific method
 */
export function createHttpHandler(method: HttpMethod): CommandHandler {
  return async (args, state) => {
    const startTime = Date.now();
    let request: ParsedRequest | undefined;

    try {
      // Resolve HTTP defaults from workspace and active profile
      const methodName = method.toLowerCase() as HttpMethodName;
      const workspaceDefaults = state.workspaceConfig?.defaults;
      const activeProfileName = state.activeProfile;
      const profileDefaults = activeProfileName
        ? state.workspaceConfig?.profiles?.[activeProfileName]?.defaults
        : undefined;

      const defaults = resolveHttpDefaults(methodName, workspaceDefaults, profileDefaults, state.sessionDefaults);

      // Resolve URL using workspace context
      const baseUrl = getBaseUrl(state);
      const urlInput = args.length > 0 && !args[0]?.startsWith('-') ? args[0] : undefined;

      const resolved = resolveUrl(urlInput, {
        baseUrl,
        currentPath: state.currentPath,
      });

      // Build args with resolved URL
      const resolvedArgs = [resolved.url, ...args.slice(urlInput ? 1 : 0)];

      request = parseHttpCommand(method, resolvedArgs, defaults);
      // Store the request for save command
      state.lastRequest = request;

      // Export mode: display command instead of executing
      if (request.trace === undefined && (args.includes('-e') || args.includes('--export'))) {
        // Parse export format from request (already parsed in parseHttpCommand)
        const exportIdx = args.indexOf('-e') !== -1 ? args.indexOf('-e') : args.indexOf('--export');
        const exportFormat = args[exportIdx + 1];
        if (exportFormat === 'curl' || exportFormat === 'httpie') {
          const exported = exportRequest(request, exportFormat);
          consola.log(exported);
          return;
        }
      }

      const result = await executeRequest(request, { spec: state.spec });

      // Log successful HTTP request to history
      if (state.historyWriter && request) {
        const durationMs = Date.now() - startTime;
        state.historyWriter.logHttp({
          method: request.method,
          url: request.url,
          requestHeaders: request.headers.length > 0 ? parseHeadersToRecord(request.headers) : undefined,
          requestBody: request.body,
          status: result?.status ?? null,
          responseHeaders: result?.headers,
          responseBody: result?.body,
          durationMs,
        });
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Log failed HTTP request to history
      if (state.historyWriter && request) {
        state.historyWriter.logHttp({
          method: request.method,
          url: request.url,
          requestHeaders: request.headers.length > 0 ? parseHeadersToRecord(request.headers) : undefined,
          requestBody: request.body,
          status: null,
          error: errorMsg,
          durationMs,
        });
      }

      // Provide user-friendly error messages
      if (error instanceof UrlResolutionError) {
        consola.error(error.message);
        if (error.hint) {
          consola.info(error.hint);
        }
      } else if (error instanceof Error) {
        consola.error(error.message);
      } else {
        consola.error(`Error: ${errorMsg}`);
      }
    }
  };
}

/**
 * Parse header strings to record for history logging
 */
function parseHeadersToRecord(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of headers) {
    const colonIndex = header.indexOf(':');
    if (colonIndex !== -1) {
      const key = header.slice(0, colonIndex).trim();
      const value = header.slice(colonIndex + 1).trim();
      if (key) {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Create all HTTP method commands
 */
export function createHttpCommands(): Command[] {
  const methods: Array<{ method: HttpMethod; description: string }> = [
    { method: 'GET', description: 'Execute HTTP GET request' },
    { method: 'POST', description: 'Execute HTTP POST request' },
    { method: 'PUT', description: 'Execute HTTP PUT request' },
    { method: 'PATCH', description: 'Execute HTTP PATCH request' },
    { method: 'DELETE', description: 'Execute HTTP DELETE request' },
    { method: 'HEAD', description: 'Execute HTTP HEAD request' },
    { method: 'OPTIONS', description: 'Execute HTTP OPTIONS request' },
  ];

  return methods.map(({ method, description }) => ({
    name: method.toLowerCase(),
    description,
    handler: createHttpHandler(method),
    helpText: generateHttpOptionsHelp(method.toLowerCase()),
  }));
}
