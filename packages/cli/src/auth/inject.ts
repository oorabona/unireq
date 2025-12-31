/**
 * Credential injection into requests
 *
 * Injects resolved credentials into ParsedRequest based on location
 */

import type { ParsedRequest } from '../types.js';
import type { ResolvedCredential } from './types.js';

/**
 * Inject a resolved credential into a request
 *
 * @param request - The parsed request to inject into
 * @param credential - The resolved credential to inject
 * @returns A new ParsedRequest with the credential injected
 *
 * @example
 * const request = { method: 'GET', url: '/api', headers: [], query: [] };
 * const credential = { location: 'header', name: 'Authorization', value: 'Bearer token' };
 * const injected = injectCredential(request, credential);
 * // injected.headers = ['Authorization:Bearer token']
 */
export function injectCredential(request: ParsedRequest, credential: ResolvedCredential): ParsedRequest {
  switch (credential.location) {
    case 'header':
      return injectHeader(request, credential.name, credential.value);
    case 'query':
      return injectQuery(request, credential.name, credential.value);
    case 'cookie':
      return injectCookie(request, credential.name, credential.value);
    default:
      // Exhaustive check
      throw new Error(`Unknown injection location: ${(credential as ResolvedCredential).location}`);
  }
}

/**
 * Inject multiple credentials into a request
 *
 * @param request - The parsed request to inject into
 * @param credentials - Array of resolved credentials to inject
 * @returns A new ParsedRequest with all credentials injected
 */
export function injectCredentials(request: ParsedRequest, credentials: ResolvedCredential[]): ParsedRequest {
  return credentials.reduce((req, cred) => injectCredential(req, cred), request);
}

/**
 * Inject a header into request
 * Replaces existing header with same name (case-insensitive)
 */
function injectHeader(request: ParsedRequest, name: string, value: string): ParsedRequest {
  const lowerName = name.toLowerCase();

  // Filter out existing header with same name (case-insensitive)
  const filteredHeaders = request.headers.filter((h) => {
    const colonIndex = h.indexOf(':');
    if (colonIndex === -1) return true;
    const headerName = h.slice(0, colonIndex).trim().toLowerCase();
    return headerName !== lowerName;
  });

  return {
    ...request,
    headers: [...filteredHeaders, `${name}:${value}`],
  };
}

/**
 * Inject a query parameter into request
 * Replaces existing param with same name
 */
function injectQuery(request: ParsedRequest, name: string, value: string): ParsedRequest {
  // Filter out existing param with same name
  const filteredQuery = request.query.filter((q) => {
    const equalsIndex = q.indexOf('=');
    if (equalsIndex === -1) return true;
    const paramName = q.slice(0, equalsIndex).trim();
    return paramName !== name;
  });

  return {
    ...request,
    query: [...filteredQuery, `${name}=${value}`],
  };
}

/**
 * Inject a cookie into request
 * Appends to existing Cookie header or creates new one
 */
function injectCookie(request: ParsedRequest, name: string, value: string): ParsedRequest {
  const cookiePair = `${name}=${value}`;

  // Find existing Cookie header (case-insensitive)
  const existingCookieIndex = request.headers.findIndex((h) => {
    const colonIndex = h.indexOf(':');
    if (colonIndex === -1) return false;
    const headerName = h.slice(0, colonIndex).trim().toLowerCase();
    return headerName === 'cookie';
  });

  if (existingCookieIndex === -1) {
    // No existing Cookie header, add new one
    return {
      ...request,
      headers: [...request.headers, `Cookie:${cookiePair}`],
    };
  }

  // Append to existing Cookie header
  const existingCookie = request.headers[existingCookieIndex] as string;
  const colonIndex = existingCookie.indexOf(':');
  const existingValue = existingCookie.slice(colonIndex + 1).trim();
  const newCookieValue = existingValue ? `${existingValue}; ${cookiePair}` : cookiePair;

  const updatedHeaders = [...request.headers];
  updatedHeaders[existingCookieIndex] = `Cookie:${newCookieValue}`;

  return {
    ...request,
    headers: updatedHeaders,
  };
}
