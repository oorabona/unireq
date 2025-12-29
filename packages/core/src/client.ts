/**
 * Client factory and request execution
 */

import { compose } from './compose.js';
import { UnireqError } from './errors.js';
import { serializationPolicy } from './serialization.js';
import { validatePolicyChain } from './slots.js';
import type { Client, Policy, RequestContext, Response, Transport, TransportWithCapabilities } from './types.js';
import { normalizeURL } from './url.js';

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

  // Base request executor with per-request policies
  const executeRequest = async <T = unknown>(
    url: string,
    method: string,
    body: unknown | undefined,
    perRequestPolicies: ReadonlyArray<Policy>,
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

  // Return client interface with variadic policies
  return {
    request: <T = unknown>(url: string, ...perRequestPolicies: ReadonlyArray<Policy>) =>
      executeRequest<T>(url, 'GET', undefined, perRequestPolicies),

    get: <T = unknown>(url: string, ...perRequestPolicies: ReadonlyArray<Policy>) =>
      executeRequest<T>(url, 'GET', undefined, perRequestPolicies),

    head: <T = unknown>(url: string, ...perRequestPolicies: ReadonlyArray<Policy>) =>
      executeRequest<T>(url, 'HEAD', undefined, perRequestPolicies),

    post: <T = unknown>(url: string, body?: unknown, ...perRequestPolicies: ReadonlyArray<Policy>) =>
      executeRequest<T>(url, 'POST', body, perRequestPolicies),

    put: <T = unknown>(url: string, body?: unknown, ...perRequestPolicies: ReadonlyArray<Policy>) =>
      executeRequest<T>(url, 'PUT', body, perRequestPolicies),

    delete: <T = unknown>(url: string, ...perRequestPolicies: ReadonlyArray<Policy>) =>
      executeRequest<T>(url, 'DELETE', undefined, perRequestPolicies),

    patch: <T = unknown>(url: string, body?: unknown, ...perRequestPolicies: ReadonlyArray<Policy>) =>
      executeRequest<T>(url, 'PATCH', body, perRequestPolicies),

    options: <T = unknown>(url: string, ...perRequestPolicies: ReadonlyArray<Policy>) =>
      executeRequest<T>(url, 'OPTIONS', undefined, perRequestPolicies),
  };
}
