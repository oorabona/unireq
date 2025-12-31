/**
 * Auth provider Valibot schemas
 */

import * as v from 'valibot';

/**
 * Valid auth provider types
 */
export const AUTH_PROVIDER_TYPES = ['api_key', 'bearer', 'login_jwt', 'oauth2_client_credentials'] as const;

/**
 * Injection location schema
 */
const injectionLocationSchema = v.picklist(['header', 'query', 'cookie']);

/**
 * API key location schema
 */
const apiKeyLocationSchema = v.picklist(['header', 'query']);

/**
 * URL validation schema
 */
const urlSchema = v.pipe(
  v.string(),
  v.check((val) => {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, 'Must be a valid URL'),
);

/**
 * Injection configuration schema
 */
export const injectionConfigSchema = v.object({
  location: v.optional(injectionLocationSchema, 'header'),
  name: v.optional(v.string(), 'Authorization'),
  // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a template format for token injection, not a JS template literal
  format: v.optional(v.string(), 'Bearer ${token}'),
});

/**
 * API Key provider schema
 */
export const apiKeyProviderSchema = v.object({
  type: v.literal('api_key'),
  location: apiKeyLocationSchema,
  name: v.pipe(v.string(), v.minLength(1)),
  value: v.string(),
});

/**
 * Bearer token provider schema
 */
export const bearerProviderSchema = v.object({
  type: v.literal('bearer'),
  token: v.string(),
  prefix: v.optional(v.string(), 'Bearer'),
});

/**
 * Login request configuration schema
 */
const loginRequestSchema = v.object({
  method: v.pipe(v.string(), v.minLength(1)),
  url: v.pipe(v.string(), v.minLength(1)),
  body: v.record(v.string(), v.unknown()),
  headers: v.optional(v.record(v.string(), v.string())),
});

/**
 * Token extraction configuration schema
 */
const tokenExtractionSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  refreshToken: v.optional(v.string()),
});

/**
 * Login → JWT provider schema
 */
export const loginJwtProviderSchema = v.object({
  type: v.literal('login_jwt'),
  login: loginRequestSchema,
  extract: tokenExtractionSchema,
  inject: injectionConfigSchema,
});

/**
 * OAuth2 Client Credentials provider schema
 */
export const oauth2ClientCredentialsSchema = v.object({
  type: v.literal('oauth2_client_credentials'),
  tokenUrl: urlSchema,
  clientId: v.string(),
  clientSecret: v.string(),
  scope: v.optional(v.string()),
  audience: v.optional(v.string()),
  inject: injectionConfigSchema,
});

/**
 * Discriminated union of all provider schemas
 * Uses 'type' field as discriminator
 */
export const authProviderConfigSchema = v.variant('type', [
  apiKeyProviderSchema,
  bearerProviderSchema,
  loginJwtProviderSchema,
  oauth2ClientCredentialsSchema,
]);

/**
 * Auth configuration schema for workspace
 */
export const authConfigSchema = v.object({
  active: v.optional(v.string()),
  providers: v.optional(v.record(v.string(), authProviderConfigSchema), {}),
});

/**
 * Inferred types from schemas
 */
export type ApiKeyProviderFromSchema = v.InferOutput<typeof apiKeyProviderSchema>;
export type BearerProviderFromSchema = v.InferOutput<typeof bearerProviderSchema>;
export type LoginJwtProviderFromSchema = v.InferOutput<typeof loginJwtProviderSchema>;
export type OAuth2ClientCredentialsFromSchema = v.InferOutput<typeof oauth2ClientCredentialsSchema>;
export type AuthProviderConfigFromSchema = v.InferOutput<typeof authProviderConfigSchema>;
export type AuthConfigFromSchema = v.InferOutput<typeof authConfigSchema>;
