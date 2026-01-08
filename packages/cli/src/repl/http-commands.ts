/**
 * HTTP command handlers for REPL
 * Creates command handlers for get, post, put, patch, delete, head, options
 */

import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import { exportRequest } from '../output/index.js';
import { extractUrlFromArgs, generateHttpOptionsHelp, resolveHttpDefaults } from '../shared/http-options.js';
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
      // Check if --isolate flag is present (ignore workspace settings)
      const isIsolated = args.includes('--isolate');

      // Resolve HTTP defaults from workspace and active profile (unless isolated)
      let defaults: ReturnType<typeof resolveHttpDefaults> | undefined;
      if (!isIsolated) {
        const methodName = method.toLowerCase() as HttpMethodName;
        const workspaceDefaults = state.workspaceConfig?.defaults;
        const activeProfileName = state.activeProfile;
        const profileDefaults = activeProfileName
          ? state.workspaceConfig?.profiles?.[activeProfileName]?.defaults
          : undefined;

        defaults = resolveHttpDefaults(methodName, workspaceDefaults, profileDefaults, state.sessionDefaults);
      }

      // Extract URL from args (can be anywhere, not just first position)
      // Skip baseUrl when isolated - require full URL
      const baseUrl = isIsolated ? undefined : getBaseUrl(state);
      const { url: urlInput, urlIndex } = extractUrlFromArgs(args);

      const resolved = resolveUrl(urlInput, {
        baseUrl,
        currentPath: isIsolated ? '/' : state.currentPath,
      });

      // Build args: replace URL at original position with resolved URL, or prepend if no URL in args
      let resolvedArgs: string[];
      if (urlIndex >= 0) {
        // Replace URL at its original position
        resolvedArgs = [...args.slice(0, urlIndex), resolved.url, ...args.slice(urlIndex + 1)];
      } else {
        // No URL in args - prepend resolved URL
        resolvedArgs = [resolved.url, ...args];
      }

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

      // Store response for inspector (Ctrl+O)
      if (result) {
        state.lastResponseBody = result.body;
        state.lastResponseStatus = result.status;
        state.lastResponseStatusText = result.statusText;
        state.lastResponseHeaders = result.headers;
        state.lastResponseTiming = result.timing;
        state.lastRequestMethod = request.method;
        state.lastRequestUrl = request.url;
        state.lastRequestHeaders = result.requestHeaders;
        state.lastRequestBody = result.requestBody;
      }

      // Log successful HTTP request to history
      if (state.historyWriter && request) {
        const durationMs = Date.now() - startTime;
        // Build raw command string for history recall (includes all flags)
        const rawCommand = args.length > 0 ? `${method.toLowerCase()} ${args.join(' ')}` : method.toLowerCase();
        state.historyWriter.logHttp({
          method: request.method,
          url: request.url,
          rawCommand,
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
        // Build raw command string for history recall (includes all flags)
        const rawCommand = args.length > 0 ? `${method.toLowerCase()} ${args.join(' ')}` : method.toLowerCase();
        state.historyWriter.logHttp({
          method: request.method,
          url: request.url,
          rawCommand,
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
