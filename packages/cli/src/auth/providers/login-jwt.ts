/**
 * Login → JWT provider resolver
 *
 * Performs login request, extracts JWT token, returns credential for injection
 *
 * Features:
 * - Token caching with TTL (uses expires_in from response)
 * - Automatic token refresh when expired (if refresh config provided)
 */

import type { Response, Result } from '@unireq/core';
import { body } from '@unireq/http';
import { httpClient } from '@unireq/presets';
import { interpolate } from '../../workspace/variables/resolver.js';
import type { InterpolationContext } from '../../workspace/variables/types.js';
import { calculateExpiresAt } from '../cache/token-cache.js';
import type { LoginJwtProviderConfig, ResolvedCredential } from '../types.js';

/**
 * Extended cache entry for login_jwt that includes refresh token
 */
interface LoginJwtCacheEntry {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

/**
 * Separate cache for login_jwt tokens (includes refresh token)
 */
const loginJwtCache = new Map<string, LoginJwtCacheEntry>();

/**
 * Generate cache key for login_jwt provider
 *
 * @param loginUrl - Login endpoint URL
 * @param bodyHash - Hash of the request body (to differentiate credentials)
 */
export function generateLoginJwtCacheKey(loginUrl: string, bodyHash: string): string {
  return `login_jwt::${loginUrl}::${bodyHash}`;
}

/**
 * Simple hash function for cache key generation
 * Not cryptographic, just for cache key uniqueness
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Options for login_jwt token resolution
 */
export interface ResolveLoginJwtOptions {
  /** Skip cache lookup and force a fresh login request */
  skipCache?: boolean;
}

/**
 * Error thrown when refresh token request fails
 */
export class RefreshTokenError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly response?: unknown,
  ) {
    super(`Refresh token request failed: ${status} ${statusText}`);
    this.name = 'RefreshTokenError';
  }
}

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
 * Execute login request and return the response as Result
 */
async function executeLoginRequest(
  url: string,
  method: string,
  requestBody: Record<string, unknown>,
  requestHeaders?: Record<string, string>,
): Promise<Result<Response, Error>> {
  // Create HTTP client with headers if provided
  const api = httpClient(undefined, {
    headers: requestHeaders,
  });

  // Prepare JSON body
  const jsonBody = body.json(requestBody);

  // Execute request based on method
  const normalizedMethod = method.toUpperCase();

  switch (normalizedMethod) {
    case 'POST':
      return api.safe.post(url, jsonBody);
    case 'PUT':
      return api.safe.put(url, jsonBody);
    case 'PATCH':
      return api.safe.patch(url, jsonBody);
    default:
      throw new Error(`Unsupported login method: ${method}. Use POST, PUT, or PATCH.`);
  }
}

/**
 * Execute a refresh token request
 *
 * @param config - The login_jwt provider configuration (must have refresh config)
 * @param refreshToken - The refresh token to use
 * @param context - Interpolation context
 * @returns Promise of Result<Response, Error>
 */
async function executeRefreshRequest(
  config: LoginJwtProviderConfig,
  refreshToken: string,
  context: InterpolationContext,
): Promise<Result<Response, Error>> {
  if (!config.refresh) {
    throw new Error('Refresh configuration is not defined');
  }

  // Interpolate refresh URL
  const refreshUrl = interpolate(config.refresh.url, context);

  // Interpolate request body, replacing ${refreshToken} placeholder
  const bodyWithToken = JSON.parse(
    // biome-ignore lint/suspicious/noTemplateCurlyInString: This is the expected refresh token placeholder
    JSON.stringify(config.refresh.body).replace(/\$\{refreshToken\}/g, refreshToken),
  );
  const refreshBody = interpolateObject(bodyWithToken, context) as Record<string, unknown>;

  // Interpolate headers if present
  let refreshHeaders: Record<string, string> | undefined;
  if (config.refresh.headers) {
    refreshHeaders = {};
    for (const [key, value] of Object.entries(config.refresh.headers)) {
      refreshHeaders[key] = interpolate(value, context);
    }
  }

  return executeLoginRequest(refreshUrl, config.refresh.method, refreshBody, refreshHeaders);
}

/**
 * Resolve a Login → JWT provider configuration to a credential
 *
 * This function:
 * 1. Checks the token cache for a valid (non-expired) token
 * 2. If expired but refresh token available, attempts token refresh
 * 3. Otherwise, executes fresh login request
 * 4. Extracts the token from the JSON response
 * 5. Caches the token with TTL (if expires_in is extracted)
 * 6. Returns a credential formatted for injection
 *
 * @param config - The login_jwt provider configuration
 * @param context - Interpolation context for variable resolution
 * @param options - Resolution options (skipCache, etc.)
 * @returns Promise of resolved credential ready for request injection
 * @throws LoginRequestError if login request fails
 * @throws RefreshTokenError if refresh request fails
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
 *     token: '$.access_token',
 *     refreshToken: '$.refresh_token',
 *     expiresIn: '$.expires_in'
 *   },
 *   inject: {
 *     location: 'header',
 *     name: 'Authorization',
 *     format: 'Bearer ${token}'
 *   },
 *   refresh: {
 *     method: 'POST',
 *     url: 'https://api.example.com/auth/refresh',
 *     body: {
 *       refresh_token: '${refreshToken}'
 *     }
 *   }
 * };
 * const credential = await resolveLoginJwtProvider(config, context);
 */
export async function resolveLoginJwtProvider(
  config: LoginJwtProviderConfig,
  context: InterpolationContext = { vars: {} },
  options: ResolveLoginJwtOptions = {},
): Promise<ResolvedCredential> {
  // Interpolate login URL and body for cache key generation
  const loginUrl = interpolate(config.login.url, context);
  const loginBody = interpolateObject(config.login.body, context) as Record<string, unknown>;
  const bodyHash = simpleHash(JSON.stringify(loginBody));
  const cacheKey = generateLoginJwtCacheKey(loginUrl, bodyHash);

  // Check cache first (unless skipCache is set)
  if (!options.skipCache) {
    const cached = loginJwtCache.get(cacheKey);
    if (cached) {
      const now = Date.now();

      // Token still valid
      if (cached.expiresAt > now) {
        const formattedValue = formatTokenValue(cached.accessToken, config.inject.format);
        return {
          location: config.inject.location,
          name: config.inject.name,
          value: formattedValue,
        };
      }

      // Token expired but we have refresh token and refresh config
      if (cached.refreshToken && config.refresh) {
        const refreshResult = await executeRefreshRequest(config, cached.refreshToken, context);

        // Network error or HTTP error - clear cache and fall through to full login
        if (refreshResult.isErr() || !refreshResult.value.ok) {
          loginJwtCache.delete(cacheKey);
        } else {
          const refreshResponse = refreshResult.value;

          // Extract new token from refresh response
          const newTokenValue = extractJsonPath(refreshResponse.data, config.extract.token);

          if (newTokenValue && typeof newTokenValue === 'string') {
            // Extract new refresh token (may or may not be returned)
            let newRefreshToken = cached.refreshToken; // Keep old refresh token by default
            if (config.extract.refreshToken) {
              const extractedRefresh = extractJsonPath(refreshResponse.data, config.extract.refreshToken);
              if (extractedRefresh && typeof extractedRefresh === 'string') {
                newRefreshToken = extractedRefresh;
              }
            }

            // Extract expires_in if configured
            let expiresIn: number | undefined;
            if (config.extract.expiresIn) {
              const extractedExpires = extractJsonPath(refreshResponse.data, config.extract.expiresIn);
              if (typeof extractedExpires === 'number') {
                expiresIn = extractedExpires;
              }
            }

            // Update cache with new tokens
            loginJwtCache.set(cacheKey, {
              accessToken: newTokenValue,
              refreshToken: newRefreshToken,
              expiresAt: calculateExpiresAt(expiresIn),
            });

            const formattedValue = formatTokenValue(newTokenValue, config.inject.format);
            return {
              location: config.inject.location,
              name: config.inject.name,
              value: formattedValue,
            };
          }
        }
      } else {
        // Token expired and no refresh available, clear cache
        loginJwtCache.delete(cacheKey);
      }
    }
  }

  // Interpolate headers if present
  let loginHeaders: Record<string, string> | undefined;
  if (config.login.headers) {
    loginHeaders = {};
    for (const [key, value] of Object.entries(config.login.headers)) {
      loginHeaders[key] = interpolate(value, context);
    }
  }

  // Execute login request
  const result = await executeLoginRequest(loginUrl, config.login.method, loginBody, loginHeaders);

  // Handle network/transport errors
  if (result.isErr()) {
    throw new LoginRequestError(0, 'Network error', result.error.message);
  }

  const response = result.value;

  // Check for successful response
  if (!response.ok) {
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

  // Extract refresh token if configured
  let refreshToken: string | undefined;
  if (config.extract.refreshToken) {
    const extractedRefresh = extractJsonPath(response.data, config.extract.refreshToken);
    if (extractedRefresh && typeof extractedRefresh === 'string') {
      refreshToken = extractedRefresh;
    }
  }

  // Extract expires_in if configured
  let expiresIn: number | undefined;
  if (config.extract.expiresIn) {
    const extractedExpires = extractJsonPath(response.data, config.extract.expiresIn);
    if (typeof extractedExpires === 'number') {
      expiresIn = extractedExpires;
    }
  }

  // Store in cache
  loginJwtCache.set(cacheKey, {
    accessToken: tokenValue,
    refreshToken,
    expiresAt: calculateExpiresAt(expiresIn),
  });

  // Format the token value
  const formattedValue = formatTokenValue(tokenValue, config.inject.format);

  return {
    location: config.inject.location,
    name: config.inject.name,
    value: formattedValue,
  };
}

/**
 * Clear cached token for a specific login_jwt configuration
 *
 * @param loginUrl - Login endpoint URL
 * @param bodyHash - Hash of the request body
 */
export function clearLoginJwtTokenCache(loginUrl: string, bodyHash: string): void {
  const cacheKey = generateLoginJwtCacheKey(loginUrl, bodyHash);
  loginJwtCache.delete(cacheKey);
}

/**
 * Clear all cached login_jwt tokens
 */
export function clearAllLoginJwtTokenCache(): void {
  loginJwtCache.clear();
}

/**
 * Get the login_jwt cache for testing purposes
 */
export function getLoginJwtCache(): Map<string, LoginJwtCacheEntry> {
  return loginJwtCache;
}
