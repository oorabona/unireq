/**
 * Login → JWT provider resolver
 *
 * Performs login request, extracts JWT token, returns credential for injection
 */

import type { Response } from '@unireq/core';
import { client } from '@unireq/core';
import { body, headers as headersPolicy, http } from '@unireq/http';
import { interpolate } from '../../workspace/variables/resolver.js';
import type { InterpolationContext } from '../../workspace/variables/types.js';
import type { LoginJwtProviderConfig, ResolvedCredential } from '../types.js';

/**
 * Error thrown when token extraction fails
 */
export class TokenExtractionError extends Error {
  constructor(
    public readonly path: string,
    public readonly response: unknown,
  ) {
    super(`Failed to extract token at path '${path}'`);
    this.name = 'TokenExtractionError';
  }
}

/**
 * Error thrown when login request fails
 */
export class LoginRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly response?: unknown,
  ) {
    super(`Login request failed: ${status} ${statusText}`);
    this.name = 'LoginRequestError';
  }
}

/**
 * Recursively interpolate all string values in an object
 *
 * @param obj - The object to interpolate
 * @param context - Interpolation context
 * @returns New object with interpolated values
 */
function interpolateObject(obj: unknown, context: InterpolationContext): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return interpolate(obj, context);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, context));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, context);
    }
    return result;
  }

  // primitives (number, boolean) pass through unchanged
  return obj;
}

/**
 * Extract a value from an object using a simple JSONPath expression
 *
 * Supports patterns like:
 * - $.token
 * - $.data.access_token
 * - $.response.auth.jwt
 *
 * @param obj - The object to extract from
 * @param path - JSONPath expression (must start with $.)
 * @returns The extracted value or undefined if not found
 */
export function extractJsonPath(obj: unknown, path: string): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  // Validate path format
  if (!path.startsWith('$.')) {
    throw new Error(`Invalid JSONPath: must start with '$.' but got '${path}'`);
  }

  // Remove $. prefix and split into parts
  const parts = path.slice(2).split('.');

  // Navigate through the object
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Format the token value using the inject format template
 *
 * @param token - The extracted token value
 * @param format - Format template with ${token} placeholder
 * @returns Formatted value
 */
export function formatTokenValue(token: string, format: string): string {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: This is the expected format pattern
  return format.replace('${token}', token);
}

/**
 * Execute login request and return the response
 */
async function executeLoginRequest(
  url: string,
  method: string,
  requestBody: Record<string, unknown>,
  requestHeaders?: Record<string, string>,
): Promise<Response> {
  // Create HTTP client with headers if provided
  const httpTransport = http();
  const policies = [];

  if (requestHeaders && Object.keys(requestHeaders).length > 0) {
    policies.push(headersPolicy(requestHeaders));
  }

  const httpClient = client(httpTransport, ...policies);

  // Prepare JSON body
  const jsonBody = body.json(requestBody);

  // Execute request based on method
  const normalizedMethod = method.toUpperCase();

  switch (normalizedMethod) {
    case 'POST':
      return httpClient.post(url, jsonBody);
    case 'PUT':
      return httpClient.put(url, jsonBody);
    case 'PATCH':
      return httpClient.patch(url, jsonBody);
    default:
      throw new Error(`Unsupported login method: ${method}. Use POST, PUT, or PATCH.`);
  }
}

/**
 * Resolve a Login → JWT provider configuration to a credential
 *
 * This function:
 * 1. Interpolates variables in the login configuration
 * 2. Executes the login HTTP request
 * 3. Extracts the token from the JSON response
 * 4. Returns a credential formatted for injection
 *
 * @param config - The login_jwt provider configuration
 * @param context - Interpolation context for variable resolution
 * @returns Promise of resolved credential ready for request injection
 * @throws LoginRequestError if login request fails
 * @throws TokenExtractionError if token cannot be extracted
 * @throws VariableNotFoundError if a required variable is not defined
 *
 * @example
 * const config = {
 *   type: 'login_jwt',
 *   login: {
 *     method: 'POST',
 *     url: 'https://api.example.com/auth/login',
 *     body: {
 *       username: '${var:username}',
 *       password: '${secret:password}'
 *     }
 *   },
 *   extract: {
 *     token: '$.access_token'
 *   },
 *   inject: {
 *     location: 'header',
 *     name: 'Authorization',
 *     format: 'Bearer ${token}'
 *   }
 * };
 * const credential = await resolveLoginJwtProvider(config, context);
 */
export async function resolveLoginJwtProvider(
  config: LoginJwtProviderConfig,
  context: InterpolationContext = { vars: {} },
): Promise<ResolvedCredential> {
  // Interpolate login URL
  const loginUrl = interpolate(config.login.url, context);

  // Interpolate request body (deep interpolation)
  const loginBody = interpolateObject(config.login.body, context) as Record<string, unknown>;

  // Interpolate headers if present
  let loginHeaders: Record<string, string> | undefined;
  if (config.login.headers) {
    loginHeaders = {};
    for (const [key, value] of Object.entries(config.login.headers)) {
      loginHeaders[key] = interpolate(value, context);
    }
  }

  // Execute login request
  const response = await executeLoginRequest(loginUrl, config.login.method, loginBody, loginHeaders);

  // Check for successful response
  if (response.status < 200 || response.status >= 300) {
    throw new LoginRequestError(response.status, response.statusText, response.data);
  }

  // Extract token from response
  const tokenValue = extractJsonPath(response.data, config.extract.token);

  if (tokenValue === undefined || tokenValue === null) {
    throw new TokenExtractionError(config.extract.token, response.data);
  }

  if (typeof tokenValue !== 'string') {
    throw new TokenExtractionError(config.extract.token, `Expected string but got ${typeof tokenValue}`);
  }

  // Format the token value
  const formattedValue = formatTokenValue(tokenValue, config.inject.format);

  return {
    location: config.inject.location,
    name: config.inject.name,
    value: formattedValue,
  };
}
