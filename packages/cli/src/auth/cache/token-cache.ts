/**
 * OAuth2 Token Cache
 *
 * In-memory cache for OAuth2 access tokens with TTL support.
 * Reduces unnecessary token endpoint requests.
 */

/**
 * Cached token entry
 */
export interface CachedToken {
  /** The access token value */
  accessToken: string;
  /** Token type (e.g., "Bearer") */
  tokenType: string;
  /** Absolute expiration timestamp (ms since epoch) */
  expiresAt: number;
  /** Optional scope that was granted */
  scope?: string;
}

/**
 * Safety buffer in seconds to subtract from expires_in
 * to avoid using tokens that are about to expire
 */
const DEFAULT_SAFETY_BUFFER_SECONDS = 30;

/**
 * Default TTL in seconds if expires_in is not provided
 * (1 hour is common default for OAuth2)
 */
const DEFAULT_TTL_SECONDS = 3600;

/**
 * Generate cache key from OAuth2 config
 *
 * @param tokenUrl - Token endpoint URL
 * @param clientId - Client ID
 * @param scope - Optional scope (different scopes = different tokens)
 * @returns Cache key string
 */
export function generateCacheKey(tokenUrl: string, clientId: string, scope?: string): string {
  const parts = [tokenUrl, clientId];
  if (scope) {
    parts.push(scope);
  }
  return parts.join('::');
}

/**
 * Calculate expiration timestamp
 *
 * @param expiresIn - Token lifetime in seconds (from OAuth2 response)
 * @param safetyBuffer - Seconds to subtract for safety margin
 * @returns Expiration timestamp in milliseconds
 */
export function calculateExpiresAt(expiresIn?: number, safetyBuffer = DEFAULT_SAFETY_BUFFER_SECONDS): number {
  const ttl = expiresIn ?? DEFAULT_TTL_SECONDS;
  const effectiveTtl = Math.max(0, ttl - safetyBuffer);
  return Date.now() + effectiveTtl * 1000;
}

/**
 * In-memory token cache
 *
 * Thread-safe for single-threaded Node.js, uses Map for storage.
 */
class TokenCache {
  private cache = new Map<string, CachedToken>();

  /**
   * Get a cached token if it exists and is not expired
   *
   * @param key - Cache key (from generateCacheKey)
   * @returns Cached token or undefined if not found/expired
   */
  get(key: string): CachedToken | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry;
  }

  /**
   * Store a token in the cache
   *
   * @param key - Cache key (from generateCacheKey)
   * @param accessToken - The access token value
   * @param tokenType - Token type (e.g., "Bearer")
   * @param expiresIn - Token lifetime in seconds
   * @param scope - Optional granted scope
   */
  set(key: string, accessToken: string, tokenType: string, expiresIn?: number, scope?: string): void {
    const entry: CachedToken = {
      accessToken,
      tokenType,
      expiresAt: calculateExpiresAt(expiresIn),
      scope,
    };

    this.cache.set(key, entry);
  }

  /**
   * Remove a specific entry from the cache
   *
   * @param key - Cache key to remove
   * @returns true if entry was removed, false if not found
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached tokens
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached entries (for debugging/testing)
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

/**
 * Singleton token cache instance
 */
export const tokenCache = new TokenCache();

/**
 * Export TokenCache class for testing
 */
export { TokenCache };
