/**
 * Describe command for REPL
 * Shows detailed operation information at current path
 */

import { consola } from 'consola';
import { getMethods, pathExists } from '../openapi/navigation/queries.js';
import type { HttpMethod } from '../openapi/navigation/types.js';
import type {
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPIRequestBody,
  OpenAPIResponse,
  OpenAPISchema,
} from '../openapi/types.js';
import type { Command, CommandHandler } from './types.js';

/**
 * Format a schema for display (max 2 levels deep)
 */
function formatSchema(schema: OpenAPISchema | undefined, indent = 0): string[] {
  if (!schema) return ['(no schema)'];

  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  // Handle type
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;

  if (type === 'object' && schema.properties) {
    lines.push(`${prefix}object {`);
    const required = schema.required ?? [];
    for (const [name, prop] of Object.entries(schema.properties)) {
      const propType = Array.isArray(prop.type) ? prop.type.join(' | ') : (prop.type ?? 'any');
      const reqMarker = required.includes(name) ? '*' : '';
      const format = prop.format ? ` (${prop.format})` : '';
      lines.push(`${prefix}  ${name}${reqMarker}: ${propType}${format}`);
    }
    lines.push(`${prefix}}`);
  } else if (type === 'array' && schema.items) {
    const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    const itemType = itemSchema?.type ?? 'any';
    lines.push(`${prefix}array of ${itemType}`);
  } else if (type) {
    const format = schema.format ? ` (${schema.format})` : '';
    lines.push(`${prefix}${type}${format}`);
  } else if (schema.$ref) {
    lines.push(`${prefix}$ref: ${schema.$ref}`);
  } else {
    lines.push(`${prefix}any`);
  }

  return lines;
}

/**
 * Format parameters grouped by location
 */
function formatParameters(parameters: OpenAPIParameter[] | undefined): void {
  if (!parameters || parameters.length === 0) return;

  const grouped: Record<string, OpenAPIParameter[]> = {
    path: [],
    query: [],
    header: [],
    cookie: [],
  };

  for (const param of parameters) {
    const location = param.in;
    if (grouped[location]) {
      grouped[location].push(param);
    }
  }

  const locationLabels: Record<string, string> = {
    path: 'Path Parameters',
    query: 'Query Parameters',
    header: 'Header Parameters',
    cookie: 'Cookie Parameters',
  };

  for (const [location, params] of Object.entries(grouped)) {
    if (params.length === 0) continue;

    consola.info(`\n${locationLabels[location]}:`);
    for (const param of params) {
      const required = param.required ? '*' : '';
      const deprecated = param.deprecated ? ' [deprecated]' : '';
      const type = param.schema?.type ?? 'string';
      const desc = param.description ? ` - ${param.description}` : '';
      consola.info(`  ${param.name}${required}: ${type}${deprecated}${desc}`);
    }
  }
}

/**
 * Format request body
 */
function formatRequestBody(requestBody: OpenAPIRequestBody | undefined): void {
  if (!requestBody) return;

  consola.info('\nRequest Body:');
  if (requestBody.required) {
    consola.info('  (required)');
  }
  if (requestBody.description) {
    consola.info(`  ${requestBody.description}`);
  }

  if (requestBody.content) {
    for (const [contentType, mediaType] of Object.entries(requestBody.content)) {
      consola.info(`\n  Content-Type: ${contentType}`);
      const schemaLines = formatSchema(mediaType.schema, 2);
      for (const line of schemaLines) {
        consola.info(line);
      }
    }
  }
}

/**
 * Format responses
 */
function formatResponses(responses: Record<string, OpenAPIResponse> | undefined): void {
  if (!responses || Object.keys(responses).length === 0) return;

  consola.info('\nResponses:');
  for (const [status, response] of Object.entries(responses)) {
    consola.info(`  ${status}: ${response.description}`);
    if (response.content) {
      for (const [contentType, mediaType] of Object.entries(response.content)) {
        consola.info(`    Content-Type: ${contentType}`);
        if (mediaType.schema) {
          const schemaLines = formatSchema(mediaType.schema, 3);
          for (const line of schemaLines) {
            consola.info(line);
          }
        }
      }
    }
  }
}

/**
 * Display detailed operation info
 */
function displayOperation(method: HttpMethod, operation: OpenAPIOperation, path: string): void {
  // Header
  consola.info(`\n${method} ${path}`);
  consola.info('─'.repeat(40));

  // Deprecated warning
  if (operation.deprecated) {
    consola.warn('⚠️  DEPRECATED');
  }

  // Summary and description
  if (operation.summary) {
    consola.info(operation.summary);
  }
  if (operation.description) {
    consola.info(`\n${operation.description}`);
  }

  // Operation ID
  if (operation.operationId) {
    consola.info(`\nOperation ID: ${operation.operationId}`);
  }

  // Tags
  if (operation.tags && operation.tags.length > 0) {
    consola.info(`Tags: ${operation.tags.join(', ')}`);
  }

  // Parameters
  formatParameters(operation.parameters);

  // Request body
  formatRequestBody(operation.requestBody);

  // Responses
  formatResponses(operation.responses);

  // Security
  if (operation.security && operation.security.length > 0) {
    consola.info('\nSecurity:');
    for (const requirement of operation.security) {
      for (const [scheme, scopes] of Object.entries(requirement)) {
        const scopeInfo = scopes.length > 0 ? ` (${scopes.join(', ')})` : '';
        consola.info(`  ${scheme}${scopeInfo}`);
      }
    }
  }

  consola.info('');
}

/**
 * Display overview of all methods at path
 */
function displayOverview(
  methods: HttpMethod[],
  path: string,
  spec: { document: { paths?: Record<string, unknown> } },
): void {
  consola.info(`\nOperations at ${path}:`);
  consola.info('─'.repeat(40));

  const pathItem = spec.document.paths?.[path] as Record<string, OpenAPIOperation> | undefined;

  for (const method of methods) {
    const operation = pathItem?.[method.toLowerCase()];
    const summary = operation?.summary ?? '(no summary)';
    const deprecated = operation?.deprecated ? ' [deprecated]' : '';
    consola.info(`  ${method.padEnd(7)} ${summary}${deprecated}`);
  }

  consola.info('\nUse "describe <METHOD>" for details');
  consola.info('');
}

/**
 * Describe command handler
 */
export const describeHandler: CommandHandler = async (args, state) => {
  // Check if spec is loaded
  if (!state.spec || !state.navigationTree) {
    consola.info(`Current path: ${state.currentPath}`);
    consola.info('');
    consola.warn('No OpenAPI spec loaded.');
    consola.info('Load a spec with: import <url-or-file>');
    return;
  }

  const tree = state.navigationTree;
  const currentPath = state.currentPath;

  // Check if path exists in spec
  if (!pathExists(tree, currentPath)) {
    consola.warn(`Path not found in spec: ${currentPath}`);
    return;
  }

  // Get methods at current path
  const methods = getMethods(tree, currentPath);
  if (methods.length === 0) {
    consola.info(`No operations at ${currentPath}`);
    consola.info('Navigate to an endpoint with operations');
    return;
  }

  // If no method specified, show overview
  if (args.length === 0) {
    displayOverview(methods, currentPath, state.spec);
    return;
  }

  // Parse method argument - args[0] is guaranteed to exist after length check above
  const methodArg = args[0]!.toUpperCase() as HttpMethod;
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];

  if (!validMethods.includes(methodArg)) {
    consola.warn(`Invalid HTTP method: ${args[0]}`);
    consola.info(`Valid methods: ${validMethods.join(', ')}`);
    return;
  }

  // Check if method is available at path
  if (!methods.includes(methodArg)) {
    consola.warn(`${methodArg} not available at ${currentPath}`);
    consola.info(`Available methods: ${methods.join(', ')}`);
    return;
  }

  // Get operation from spec
  const pathItem = state.spec.document.paths?.[currentPath];
  if (!pathItem) {
    consola.warn(`Path not found in spec: ${currentPath}`);
    return;
  }

  const operation = pathItem[methodArg.toLowerCase() as keyof typeof pathItem] as OpenAPIOperation | undefined;
  if (!operation) {
    consola.warn(`Operation not found for ${methodArg} ${currentPath}`);
    return;
  }

  // Display detailed operation info
  displayOperation(methodArg, operation, currentPath);
};

/**
 * Create describe command
 */
export function createDescribeCommand(): Command {
  return {
    name: 'describe',
    description: 'Show operation details at current path',
    handler: describeHandler,
  };
}
