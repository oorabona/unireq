/**
 * URL Resolution Utility
 *
 * Resolves URLs based on context (baseUrl from profile, currentPath from navigation).
 * Supports implicit, relative, absolute, and explicit URL resolution.
 */

/**
 * Context for URL resolution
 */
export interface UrlResolutionContext {
  /** Base URL from active profile (e.g., "https://api.example.com") */
  baseUrl?: string;
  /** Current navigation path from cd/pwd (e.g., "/users/123") */
  currentPath: string;
}

/**
 * Result of URL resolution
 */
export interface ResolvedUrl {
  /** Final absolute URL ready for HTTP request */
  url: string;
  /** True if user provided explicit full URL (http:// or https://) */
  isExplicit: boolean;
}

/**
 * Error thrown when URL cannot be resolved due to missing baseUrl
 */
export class UrlResolutionError extends Error {
  constructor(
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = 'UrlResolutionError';
  }
}

/**
 * Normalize a URL by removing double slashes (except in protocol)
 * and ensuring consistent format
 */
export function normalizeUrl(url: string): string {
  // Split protocol from rest
  const protocolMatch = url.match(/^(https?:\/\/)/);
  if (!protocolMatch?.[1]) {
    // No protocol, just normalize slashes
    return url.replace(/\/+/g, '/');
  }

  const protocol = protocolMatch[1];
  const rest = url.slice(protocol.length);

  // Normalize slashes in the rest (collapse multiple slashes to one)
  const normalized = rest.replace(/\/+/g, '/');

  return protocol + normalized;
}

/**
 * Remove trailing slash from a string
 */
function removeTrailingSlash(str: string): string {
  return str.endsWith('/') ? str.slice(0, -1) : str;
}

/**
 * Ensure path starts with a slash
 */
function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Check if a string is an explicit URL (starts with http:// or https://)
 */
export function isExplicitUrl(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://');
}

/**
 * Resolve a URL based on input and context
 *
 * Resolution rules:
 * 1. Explicit URL (http:// or https://) → use as-is
 * 2. No input → baseUrl + currentPath (implicit)
 * 3. Starts with "/" → baseUrl + input (absolute from base)
 * 4. Otherwise → baseUrl + currentPath + "/" + input (relative)
 *
 * @param input - User input (URL, path, segment, or undefined)
 * @param context - Resolution context with baseUrl and currentPath
 * @returns Resolved URL with explicit flag
 * @throws UrlResolutionError if baseUrl required but not available
 */
export function resolveUrl(input: string | undefined, context: UrlResolutionContext): ResolvedUrl {
  // Case 1: Explicit URL - return as-is
  if (input && isExplicitUrl(input)) {
    return {
      url: normalizeUrl(input),
      isExplicit: true,
    };
  }

  // All other cases require baseUrl
  if (!context.baseUrl) {
    if (!input) {
      throw new UrlResolutionError(
        'No base URL configured. Provide an explicit URL or activate a workspace profile.',
        'Use "workspace use <name>" and "profile use <name>" to set a base URL.',
      );
    }
    if (input.startsWith('/')) {
      throw new UrlResolutionError(
        `Cannot resolve path '${input}' - no base URL configured.`,
        `Use an explicit URL like "https://api.example.com${input}" or activate a profile.`,
      );
    }
    throw new UrlResolutionError(
      `Cannot resolve relative segment '${input}' - no base URL configured.`,
      'Use an explicit URL or activate a workspace profile with a base URL.',
    );
  }

  const baseUrl = removeTrailingSlash(context.baseUrl);
  const currentPath = ensureLeadingSlash(context.currentPath);

  // Case 2: No input - use baseUrl + currentPath (implicit)
  if (!input || input.trim() === '') {
    const url = normalizeUrl(`${baseUrl}${currentPath}`);
    return { url, isExplicit: false };
  }

  // Case 3: Absolute path (starts with /) - baseUrl + input
  if (input.startsWith('/')) {
    const url = normalizeUrl(`${baseUrl}${input}`);
    return { url, isExplicit: false };
  }

  // Case 4: Relative segment - baseUrl + currentPath + "/" + input
  const pathWithSlash = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
  const url = normalizeUrl(`${baseUrl}${pathWithSlash}${input}`);
  return { url, isExplicit: false };
}

/**
 * Build the full display URL for StatusLine
 * Returns undefined if no baseUrl is available
 */
export function buildDisplayUrl(context: UrlResolutionContext): string | undefined {
  if (!context.baseUrl) {
    return undefined;
  }

  const baseUrl = removeTrailingSlash(context.baseUrl);
  const currentPath = ensureLeadingSlash(context.currentPath);

  return normalizeUrl(`${baseUrl}${currentPath}`);
}
