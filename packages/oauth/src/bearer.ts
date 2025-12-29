/**
 * OAuth 2.0 Bearer token authentication (RFC 6750)
 * @see https://datatracker.ietf.org/doc/html/rfc6750
 */

import { OAUTH_CONFIG } from '@unireq/config';
import type { Policy } from '@unireq/core';
import { getHeader, policy } from '@unireq/core';
import { createRemoteJWKSet, importSPKI, jwtVerify } from 'jose';

/** Token supplier function (lazy evaluation) */
export type TokenSupplier = () => string | Promise<string>;

/** JWT payload structure (minimal) */
interface JWTPayload {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * JWKS (JSON Web Key Set) for JWT verification
 * Can be a URL to fetch JWKS or a static key
 */
export type JWKSSource = { type: 'url'; url: string } | { type: 'key'; key: string };

/**
 * Decodes JWT payload without verification (INSECURE - for exp check only)
 * @param token - JWT token
 * @returns Decoded payload
 * @deprecated Use verifyJWT with JWKS for secure verification
 */
function decodeJWTUnsafe(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    if (!payload) return null;

    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Verifies JWT with jose library (SECURE)
 * @param token - JWT token
 * @param jwks - JWKS source for verification
 * @returns Decoded and verified payload
 * @throws Error if jose library is not installed
 */
async function verifyJWT(token: string, jwks: JWKSSource): Promise<JWTPayload | null> {
  if (jwks.type === 'url') {
    // JWKS URL - jose will fetch and cache
    const getKey = createRemoteJWKSet(new URL(jwks.url));
    const { payload } = await jwtVerify(token, getKey);
    return payload as JWTPayload;
  }

  // Static PEM key (RS256)
  const key = await importSPKI(jwks.key, 'RS256');
  const { payload } = await jwtVerify(token, key);
  return payload as JWTPayload;
}

/**
 * Checks if JWT is expired with clock skew tolerance
 * @param token - JWT token
 * @param skewSeconds - Clock skew tolerance in seconds
 * @param jwks - Optional JWKS for secure verification
 * @returns True if token is expired or about to expire
 */
async function isJWTExpired(token: string, skewSeconds: number, jwks?: JWKSSource): Promise<boolean> {
  let payload: JWTPayload | null;

  if (jwks) {
    // Secure verification with jose
    payload = await verifyJWT(token, jwks);
  } else {
    // Fallback: unsafe decode (no signature verification)
    console.warn('[SECURITY WARNING] JWT signature not verified. Provide JWKS for secure verification.');
    payload = decodeJWTUnsafe(token);
  }

  if (!payload?.exp) return false;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + skewSeconds;
}

/**
 * OAuth Bearer options
 */
export interface OAuthBearerOptions {
  /** Token supplier function (lazy evaluation) */
  readonly tokenSupplier: TokenSupplier;
  /** JWKS source for secure JWT verification (highly recommended for production) */
  readonly jwks?: JWKSSource;
  /** Clock skew tolerance in seconds (default: 60) */
  readonly skew?: number;
  /** Auto-refresh on 401 (default: true) */
  readonly autoRefresh?: boolean;
  /** Callback before token refresh */
  readonly onRefresh?: () => void | Promise<void>;
  /**
   * Allow unsafe mode without JWKS verification (NOT RECOMMENDED FOR PRODUCTION)
   * When false (default), throws error if jwks is not provided
   * When true, only logs warning and checks expiration without signature verification
   * @security OWASP A02:2021 - Enabling this bypasses cryptographic verification
   * @default false
   */
  readonly allowUnsafeMode?: boolean;
}

// Single-flight refresh lock with timeout cleanup
const refreshLocks = new Map<TokenSupplier, Promise<string>>();
const refreshTimeouts = new Map<TokenSupplier, ReturnType<typeof setTimeout>>();

// Lock timeout duration (30 seconds - if refresh takes longer, something is wrong)
const REFRESH_LOCK_TIMEOUT = 30000;

/**
 * Gets token with single-flight refresh guarantee
 * Ensures only one refresh happens at a time per supplier
 * Includes timeout cleanup to prevent memory leaks
 */
async function getTokenWithRefresh(supplier: TokenSupplier): Promise<string> {
  // Check if refresh is already in progress
  const existingRefresh = refreshLocks.get(supplier);
  if (existingRefresh) {
    return existingRefresh;
  }

  // Set timeout to cleanup lock in case of long-running or crashed refresh
  /* v8 ignore start - timeout cleanup path, difficult to test reliably */
  const timeoutId = setTimeout(() => {
    refreshLocks.delete(supplier);
    refreshTimeouts.delete(supplier);
  }, REFRESH_LOCK_TIMEOUT);
  /* v8 ignore stop */

  refreshTimeouts.set(supplier, timeoutId);

  // Start new refresh
  const refreshPromise = Promise.resolve(supplier()).finally(() => {
    // Clean up lock and timeout on success or failure
    // .finally() runs for both resolved and rejected promises
    refreshLocks.delete(supplier);
    const timeout = refreshTimeouts.get(supplier);
    if (timeout) {
      clearTimeout(timeout);
      refreshTimeouts.delete(supplier);
    }
  });

  refreshLocks.set(supplier, refreshPromise);
  return refreshPromise;
}

/**
 * Creates an OAuth 2.0 Bearer token authentication policy
 * - Lazy token evaluation via supplier
 * - JWT exp + skew validation
 * - Optional secure JWT verification with jose (RECOMMENDED)
 * - Single-flight refresh on 401
 * - Single replay after refresh
 *
 * @param options - OAuth Bearer options
 * @returns Policy that handles Bearer authentication
 *
 * @example
 * ```ts
 * // Secure verification with JWKS URL
 * const authPolicy = oauthBearer({
 *   tokenSupplier: async () => 'eyJhbGci...',
 *   jwks: { type: 'url', url: 'https://example.com/.well-known/jwks.json' },
 *   skew: 60,
 *   onRefresh: () => console.log('Refreshing token...')
 * });
 *
 * // Secure verification with static public key
 * const authPolicy = oauthBearer({
 *   tokenSupplier: async () => 'eyJhbGci...',
 *   jwks: { type: 'key', key: publicKeyPEM },
 *   skew: 60
 * });
 * ```
 *
 * @security IMPORTANT: Provide `jwks` option for secure JWT signature verification.
 * Without it, only expiration is checked (no signature validation).
 */
export function oauthBearer(options: OAuthBearerOptions): Policy {
  const {
    tokenSupplier,
    jwks,
    skew = OAUTH_CONFIG.JWT_CLOCK_SKEW,
    autoRefresh = OAUTH_CONFIG.AUTO_REFRESH,
    onRefresh,
    allowUnsafeMode = false,
  } = options;

  // Security validation: Require JWKS or explicit unsafe mode acknowledgment
  if (!jwks && !allowUnsafeMode) {
    throw new Error(
      '[SECURITY ERROR] JWT signature verification disabled without explicit acknowledgment. ' +
        'Either provide "jwks" option for secure verification OR set "allowUnsafeMode: true" ' +
        '(NOT RECOMMENDED FOR PRODUCTION). ' +
        'See OWASP A02:2021 - Cryptographic Failures: https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
    );
  }

  // Log security warning if unsafe mode is explicitly enabled
  if (!jwks && allowUnsafeMode) {
    console.error(
      '[SECURITY WARNING] Running in UNSAFE MODE. JWT signatures NOT verified. ' +
        'Tokens can be forged by attackers. DO NOT use in production! ' +
        'Provide "jwks" option for secure JWT verification.',
    );
  }

  // Cache token in closure to avoid re-fetching on every request
  let cachedToken: string | null = null;

  return policy(
    async (ctx, next) => {
      // Get initial token (use cached if available)
      let token = cachedToken;
      if (!token) {
        // Use single-flight mechanism for initial fetch to handle concurrent requests
        token = await getTokenWithRefresh(tokenSupplier);
        cachedToken = token;
      }

      // Check if token is expired
      if (await isJWTExpired(token, skew, jwks)) {
        if (onRefresh) {
          await Promise.resolve(onRefresh());
        }
        token = await getTokenWithRefresh(tokenSupplier);
        cachedToken = token;
      }

      // Add Authorization header
      const response = await next({
        ...ctx,
        headers: {
          ...ctx.headers,
          authorization: `Bearer ${token}`,
        },
      });

      // Handle 401 Unauthorized - single refresh and replay
      if (response.status === 401 && autoRefresh) {
        // Check WWW-Authenticate header for Bearer realm
        const wwwAuth = getHeader(response.headers, 'www-authenticate');

        if (wwwAuth?.toLowerCase().includes('bearer')) {
          if (onRefresh) {
            await Promise.resolve(onRefresh());
          }

          // Refresh token (single-flight)
          const newToken = await getTokenWithRefresh(tokenSupplier);
          cachedToken = newToken;

          // Single replay
          return next({
            ...ctx,
            headers: {
              ...ctx.headers,
              authorization: `Bearer ${newToken}`,
            },
          });
        }
      }

      return response;
    },
    {
      name: 'oauthBearer',
      kind: 'auth',
      options: {
        jwks: jwks ? `[${jwks.type}]` : undefined,
        skew,
        autoRefresh,
        allowUnsafeMode,
      },
    },
  );
}
