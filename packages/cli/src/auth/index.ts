/**
 * Auth provider module
 */

// Commands
export { authHandler, createAuthCommand } from './commands.js';

// Credential injection
export { injectCredential, injectCredentials } from './inject.js';

// Provider resolvers
export { resolveApiKeyProvider, resolveBearerProvider } from './providers/index.js';

// Registry functions
export {
  getActiveProvider,
  getActiveProviderName,
  getProvider,
  listProviders,
  providerExists,
} from './registry.js';

// Schemas
export {
  AUTH_PROVIDER_TYPES,
  apiKeyProviderSchema,
  authConfigSchema,
  authProviderConfigSchema,
  bearerProviderSchema,
  injectionConfigSchema,
  loginJwtProviderSchema,
  oauth2ClientCredentialsSchema,
} from './schema.js';

// Types
export type {
  ApiKeyProviderConfig,
  AuthConfig,
  AuthProviderConfig,
  AuthProviderType,
  BearerProviderConfig,
  InjectionConfig,
  InjectionLocation,
  LoginJwtProviderConfig,
  LoginRequestConfig,
  OAuth2ClientCredentialsConfig,
  ResolvedCredential,
  TokenExtractionConfig,
} from './types.js';
