/**
 * @unireq/oauth - OAuth 2.0 Bearer authentication with JWT validation and auto-refresh
 * @see https://datatracker.ietf.org/doc/html/rfc6750
 */

export type { JWKSSource, OAuthBearerOptions, TokenSupplier } from './bearer.js';
export { oauthBearer } from './bearer.js';

// DX Helpers - transparent utility functions (not abstractions)
export type { ClientCredentialsOptions, RefreshTokenOptions } from './helpers.js';
export {
  jwksFromIssuer,
  jwksFromKey,
  jwksFromUrl,
  tokenFromClientCredentials,
  tokenFromEnv,
  tokenFromRefresh,
  tokenFromStatic,
  tokenWithCache,
} from './helpers.js';
