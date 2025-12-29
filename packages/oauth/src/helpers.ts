/**
 * OAuth 2.0 DX helpers - transparent utility functions
 * These helpers make common OAuth configurations easier without hiding complexity.
 * You can always use the raw oauthBearer() options directly for full control.
 */

import type { JWKSSource, TokenSupplier } from './bearer.js';

/**
 * Creates a JWKS source from a URL
 * This is the most common approach for production - fetch keys from identity provider
 *
 * @example
 * ```ts
 * const auth = oauthBearer({
 *   tokenSupplier: myTokenSupplier,
 *   jwks: jwksFromUrl('https://login.example.com/.well-known/jwks.json'),
 * });
 * ```
 */
export function jwksFromUrl(url: string): JWKSSource {
  return { type: 'url', url };
}

/**
 * Creates a JWKS source from a static PEM public key
 * Use this when you have the signing key directly (e.g., from config/secrets)
 *
 * @example
 * ```ts
 * const publicKeyPEM = `-----BEGIN PUBLIC KEY-----
 * MIIBIjANBgkqh...
 * -----END PUBLIC KEY-----`;
 *
 * const auth = oauthBearer({
 *   tokenSupplier: myTokenSupplier,
 *   jwks: jwksFromKey(publicKeyPEM),
 * });
 * ```
 */
export function jwksFromKey(pemKey: string): JWKSSource {
  return { type: 'key', key: pemKey };
}

/**
 * Derives JWKS URL from OpenID Connect issuer
 * Follows the standard .well-known/openid-configuration path
 *
 * @example
 * ```ts
 * // For Auth0: https://your-tenant.auth0.com/.well-known/jwks.json
 * // For Okta: https://your-domain.okta.com/oauth2/default/v1/keys
 * const auth = oauthBearer({
 *   tokenSupplier: myTokenSupplier,
 *   jwks: jwksFromIssuer('https://your-tenant.auth0.com/'),
 * });
 * ```
 */
export function jwksFromIssuer(issuerUrl: string): JWKSSource {
  // Normalize issuer URL (remove trailing slash)
  const baseUrl = issuerUrl.replace(/\/$/, '');
  return { type: 'url', url: `${baseUrl}/.well-known/jwks.json` };
}

/**
 * Creates a token supplier from an environment variable
 * Useful for static tokens (API keys) or tokens set at process startup
 *
 * @example
 * ```ts
 * // Reads process.env.MY_API_TOKEN on each request
 * const auth = oauthBearer({
 *   tokenSupplier: tokenFromEnv('MY_API_TOKEN'),
 *   allowUnsafeMode: true, // Static tokens often don't have JWKS
 * });
 * ```
 */
export function tokenFromEnv(varName: string): TokenSupplier {
  return () => {
    const token = process.env[varName];
    if (!token) {
      throw new Error(`Environment variable ${varName} is not set`);
    }
    return token;
  };
}

/**
 * Token refresh endpoint response (standard OAuth2)
 */
interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
}

/**
 * Options for creating a refresh-based token supplier
 */
export interface RefreshTokenOptions {
  /** Token endpoint URL (e.g., https://auth.example.com/oauth/token) */
  readonly tokenEndpoint: string;
  /** OAuth client ID */
  readonly clientId: string;
  /** OAuth client secret (optional for public clients) */
  readonly clientSecret?: string;
  /** Refresh token - can be a string or a function that returns one */
  readonly refreshToken: string | (() => string | Promise<string>);
  /** Additional parameters to send (e.g., scope, audience) */
  readonly additionalParams?: Record<string, string>;
  /** Callback when new tokens are received (for storing refresh token) */
  readonly onTokens?: (tokens: TokenResponse) => void | Promise<void>;
}

/**
 * Creates a token supplier that fetches tokens using a refresh token
 * Handles the OAuth2 refresh_token grant type automatically
 *
 * This is NOT a black box - you control:
 * - The token endpoint URL
 * - Credentials (client ID/secret)
 * - How refresh tokens are obtained and stored
 * - Additional parameters (scope, audience)
 *
 * @example
 * ```ts
 * // Basic refresh token flow
 * const auth = oauthBearer({
 *   tokenSupplier: tokenFromRefresh({
 *     tokenEndpoint: 'https://auth.example.com/oauth/token',
 *     clientId: 'my-app',
 *     clientSecret: process.env.CLIENT_SECRET,
 *     refreshToken: () => getStoredRefreshToken(),
 *     onTokens: async (tokens) => {
 *       // Store the new refresh token if rotated
 *       if (tokens.refresh_token) {
 *         await storeRefreshToken(tokens.refresh_token);
 *       }
 *     },
 *   }),
 *   jwks: jwksFromIssuer('https://auth.example.com/'),
 * });
 * ```
 */
export function tokenFromRefresh(options: RefreshTokenOptions): TokenSupplier {
  const { tokenEndpoint, clientId, clientSecret, refreshToken, additionalParams = {}, onTokens } = options;

  return async (): Promise<string> => {
    // Get refresh token (can be dynamic)
    const currentRefreshToken = typeof refreshToken === 'function' ? await refreshToken() : refreshToken;

    // Build form body
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: currentRefreshToken,
      ...additionalParams,
    });

    if (clientSecret) {
      body.append('client_secret', clientSecret);
    }

    // Make token request
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    const tokens = (await response.json()) as TokenResponse;

    // Notify caller of new tokens (for refresh token rotation)
    if (onTokens) {
      await onTokens(tokens);
    }

    return tokens.access_token;
  };
}

/**
 * Options for client credentials grant
 */
export interface ClientCredentialsOptions {
  /** Token endpoint URL */
  readonly tokenEndpoint: string;
  /** OAuth client ID */
  readonly clientId: string;
  /** OAuth client secret */
  readonly clientSecret: string;
  /** Requested scopes (optional) */
  readonly scope?: string;
  /** Additional parameters */
  readonly additionalParams?: Record<string, string>;
}

/**
 * Creates a token supplier using client credentials grant
 * Ideal for server-to-server authentication (machine-to-machine)
 *
 * @example
 * ```ts
 * const auth = oauthBearer({
 *   tokenSupplier: tokenFromClientCredentials({
 *     tokenEndpoint: 'https://auth.example.com/oauth/token',
 *     clientId: process.env.CLIENT_ID,
 *     clientSecret: process.env.CLIENT_SECRET,
 *     scope: 'read:api write:api',
 *   }),
 *   jwks: jwksFromIssuer('https://auth.example.com/'),
 * });
 * ```
 */
export function tokenFromClientCredentials(options: ClientCredentialsOptions): TokenSupplier {
  const { tokenEndpoint, clientId, clientSecret, scope, additionalParams = {} } = options;

  return async (): Promise<string> => {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      ...additionalParams,
    });

    if (scope) {
      body.append('scope', scope);
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Client credentials grant failed: ${response.status} - ${errorText}`);
    }

    const tokens = (await response.json()) as TokenResponse;
    return tokens.access_token;
  };
}

/**
 * Creates a simple token supplier from a static string
 * Useful for testing or when token is known at startup
 *
 * @example
 * ```ts
 * // For testing
 * const auth = oauthBearer({
 *   tokenSupplier: tokenFromStatic('test-token'),
 *   allowUnsafeMode: true,
 * });
 * ```
 */
export function tokenFromStatic(token: string): TokenSupplier {
  return () => token;
}

/**
 * Creates a token supplier that caches the result of another supplier
 * Reduces calls to expensive token operations
 *
 * @param supplier - The underlying token supplier
 * @param ttlMs - Cache TTL in milliseconds (default: 5 minutes)
 *
 * @example
 * ```ts
 * const auth = oauthBearer({
 *   // Cache client credentials token for 5 minutes
 *   tokenSupplier: tokenWithCache(
 *     tokenFromClientCredentials({ ... }),
 *     5 * 60 * 1000
 *   ),
 *   jwks: jwksFromIssuer('https://auth.example.com/'),
 * });
 * ```
 */
export function tokenWithCache(supplier: TokenSupplier, ttlMs = 5 * 60 * 1000): TokenSupplier {
  let cachedToken: string | null = null;
  let expiresAt = 0;

  return async (): Promise<string> => {
    if (cachedToken && Date.now() < expiresAt) {
      return cachedToken;
    }

    const token = await supplier();
    cachedToken = token;
    expiresAt = Date.now() + ttlMs;
    return token;
  };
}
