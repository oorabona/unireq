/**
 * Client factory and request execution
 */

import { compose } from './compose.js';
import { UnireqError } from './errors.js';
import { fromPromise } from './result.js';
import { serializationPolicy } from './serialization.js';
import { validatePolicyChain } from './slots.js';
import type {
  Client,
  Policy,
  RequestContext,
  RequestOptions,
  Response,
  SafeClient,
  Transport,
  TransportWithCapabilities,
} from './types.js';
import { normalizeURL } from './url.js';

/**
 * Type guard to check if a value is a RequestOptions object
 * RequestOptions has specific keys: body, policies, signal
 * We detect it by checking for these keys AND ensuring it's a plain object
 *
 * Detection rules:
 * - Must be a non-null object (not array, not function)
 * - If empty object {}, it's treated as RequestOptions (no body, no policies, no signal)
 * - If non-empty, all keys must be valid RequestOptions keys
 */
function isRequestOptions(value: unknown): value is RequestOptions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  // Functions are not RequestOptions (policies are functions)
  if (typeof value === 'function') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const validKeys = new Set(['body', 'policies', 'signal']);

  // Empty object {} is valid RequestOptions (means no body, no policies, no signal)
  if (keys.length === 0) {
    return true;
  }

  // Non-empty: must have at least one valid key AND all keys must be valid
  const hasValidKey = keys.some((k) => validKeys.has(k));
  const allKeysValid = keys.every((k) => validKeys.has(k));
  return hasValidKey && allKeysValid;
}

/**
 * Creates a client with the given transport and policies
 * @param transport - The transport function or transport with capabilities
 * @param policies - Variadic list of policies to apply
 * @returns A configured client instance
 */
export function client(transport: Transport | TransportWithCapabilities, ...policies: ReadonlyArray<Policy>): Client {
  // Extract transport and capabilities
  const actualTransport = typeof transport === 'function' ? transport : transport.transport;
  const capabilities = typeof transport === 'function' ? undefined : transport.capabilities;

  // Validate policy chain
  validatePolicyChain(policies, capabilities);

  // Compose all policies with serialization middleware first
  const composedPolicy = compose(serializationPolicy(), ...policies);

  // Base request executor with per-request policies and optional signal
  const executeRequest = async <T = unknown>(
    url: string,
    method: string,
    body: unknown | undefined,
    perRequestPolicies: ReadonlyArray<Policy>,
    signal?: AbortSignal,
  ): Promise<Response<T>> => {
    // Validate URL input
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      throw new UnireqError('URL must be a non-empty string', 'INVALID_URL');
    }

    // Pass URL as-is to transport - let transport handle URI resolution
    // Only normalize absolute URLs to ensure consistent format
    const normalizedURL = url.includes('://') ? normalizeURL(url, {}) : url;

    const ctx: RequestContext = {
      url: normalizedURL,
      method,
      headers: {},
      body,
      signal,
    };

    // Compose global policies with per-request policies
    if (perRequestPolicies.length > 0) {
      const perRequestPolicy = compose(...perRequestPolicies);
      const combinedPolicy = compose(composedPolicy, perRequestPolicy);
      return combinedPolicy(ctx, actualTransport) as Promise<Response<T>>;
    }

    // Execute through global policy chain only
    return composedPolicy(ctx, actualTransport) as Promise<Response<T>>;
  };

  // Helper for methods without body (GET, HEAD, DELETE, OPTIONS)
  const createMethodWithoutBody =
    (method: string) =>
    <T = unknown>(url: string, ...args: Array<Policy | RequestOptions>): Promise<Response<T>> => {
      // Check if first arg is RequestOptions
      const firstArg = args[0];
      if (firstArg !== undefined && isRequestOptions(firstArg)) {
        const opts = firstArg;
        return executeRequest<T>(url, method, opts.body, opts.policies || [], opts.signal);
      }
      // Otherwise treat as variadic policies
      return executeRequest<T>(url, method, undefined, args as ReadonlyArray<Policy>);
    };

  // Helper for methods with body (POST, PUT, PATCH)
  const createMethodWithBody =
    (method: string) =>
    <T = unknown>(url: string, bodyOrOptions?: unknown, ...restPolicies: ReadonlyArray<Policy>): Promise<Response<T>> => {
      // Check if second arg is RequestOptions
      if (bodyOrOptions !== undefined && isRequestOptions(bodyOrOptions)) {
        const opts = bodyOrOptions;
        return executeRequest<T>(url, method, opts.body, opts.policies || [], opts.signal);
      }
      // Otherwise treat as body + variadic policies
      return executeRequest<T>(url, method, bodyOrOptions, restPolicies);
    };

  // Create safe method wrappers that return Result instead of throwing
  const createSafeMethodWithoutBody =
    (method: string) =>
    <T = unknown>(url: string, ...args: Array<Policy | RequestOptions>) =>
      fromPromise<Response<T>, Error>(createMethodWithoutBody(method)<T>(url, ...args));

  const createSafeMethodWithBody =
    (method: string) =>
    <T = unknown>(url: string, bodyOrOptions?: unknown, ...policies: ReadonlyArray<Policy>) =>
      fromPromise<Response<T>, Error>(createMethodWithBody(method)<T>(url, bodyOrOptions, ...policies));

  // Build safe client namespace
  const safe: SafeClient = {
    request: createSafeMethodWithoutBody('GET'),
    get: createSafeMethodWithoutBody('GET'),
    head: createSafeMethodWithoutBody('HEAD'),
    post: createSafeMethodWithBody('POST'),
    put: createSafeMethodWithBody('PUT'),
    delete: createSafeMethodWithoutBody('DELETE'),
    patch: createSafeMethodWithBody('PATCH'),
    options: createSafeMethodWithoutBody('OPTIONS'),
  };

  // Return client interface supporting both APIs
  return {
    request: createMethodWithoutBody('GET'),
    get: createMethodWithoutBody('GET'),
    head: createMethodWithoutBody('HEAD'),
    post: createMethodWithBody('POST'),
    put: createMethodWithBody('PUT'),
    delete: createMethodWithoutBody('DELETE'),
    patch: createMethodWithBody('PATCH'),
    options: createMethodWithoutBody('OPTIONS'),
    safe,
  };
}
