/**
 * Auth provider type definitions
 */

/**
 * Supported auth provider types (V1)
 */
export type AuthProviderType = 'api_key' | 'bearer' | 'login_jwt' | 'oauth2_client_credentials';

/**
 * Injection location for credentials
 */
export type InjectionLocation = 'header' | 'query' | 'cookie';

/**
 * API key location (header or query parameter)
 */
export type ApiKeyLocation = 'header' | 'query';

/**
 * Configuration for credential injection into requests
 */
export interface InjectionConfig {
  /** Where to inject the credential */
  location: InjectionLocation;
  /** Name of the header/query param/cookie */
  name: string;
  /** Format template with ${token} placeholder */
  format: string;
}

/**
 * API Key provider configuration
 * Injects a static API key into requests
 */
export interface ApiKeyProviderConfig {
  type: 'api_key';
  /** Where to put the API key */
  location: ApiKeyLocation;
  /** Header or query parameter name */
  name: string;
  /** The API key value (usually ${secret:...}) */
  value: string;
}

/**
 * Bearer token provider configuration
 * Injects a static bearer token into Authorization header
 */
export interface BearerProviderConfig {
  type: 'bearer';
  /** The token value (usually ${secret:...}) */
  token: string;
  /** Token prefix (default: "Bearer") */
  prefix?: string;
}

/**
 * Login request configuration for login_jwt provider
 */
export interface LoginRequestConfig {
  /** HTTP method for login request */
  method: string;
  /** Login endpoint URL or path */
  url: string;
  /** Request body (credentials) */
  body: Record<string, unknown>;
  /** Optional headers for login request */
  headers?: Record<string, string>;
}

/**
 * Token extraction configuration
 */
export interface TokenExtractionConfig {
  /** JSONPath expression to extract access token */
  token: string;
  /** JSONPath expression to extract refresh token (optional) */
  refreshToken?: string;
}

/**
 * Login → JWT provider configuration
 * Performs login request, extracts token, injects into subsequent requests
 */
export interface LoginJwtProviderConfig {
  type: 'login_jwt';
  /** Login request configuration */
  login: LoginRequestConfig;
  /** Token extraction from response */
  extract: TokenExtractionConfig;
  /** How to inject the token */
  inject: InjectionConfig;
}

/**
 * OAuth2 Client Credentials provider configuration
 * Implements OAuth2 client_credentials grant type
 */
export interface OAuth2ClientCredentialsConfig {
  type: 'oauth2_client_credentials';
  /** Token endpoint URL */
  tokenUrl: string;
  /** Client ID */
  clientId: string;
  /** Client secret */
  clientSecret: string;
  /** Space-separated scopes (optional) */
  scope?: string;
  /** Audience (optional, for some providers) */
  audience?: string;
  /** How to inject the token */
  inject: InjectionConfig;
}

/**
 * Discriminated union of all provider configurations
 */
export type AuthProviderConfig =
  | ApiKeyProviderConfig
  | BearerProviderConfig
  | LoginJwtProviderConfig
  | OAuth2ClientCredentialsConfig;

/**
 * Auth configuration in workspace
 */
export interface AuthConfig {
  /** Currently active provider name */
  active?: string;
  /** Map of provider name to configuration */
  providers: Record<string, AuthProviderConfig>;
}

/**
 * Resolved credential ready for injection into a request
 * All values are already interpolated (no ${...} placeholders)
 */
export interface ResolvedCredential {
  /** Where to inject */
  location: InjectionLocation;
  /** Header/query/cookie name */
  name: string;
  /** Final value to inject */
  value: string;
}
