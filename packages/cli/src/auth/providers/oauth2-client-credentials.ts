/**
 * OAuth2 Client Credentials provider resolver
 *
 * Implements RFC 6749 OAuth2 client_credentials grant type
 * https://datatracker.ietf.org/doc/html/rfc6749#section-4.4
 */

import { client } from '@unireq/core';
import { body, headers as headersPolicy, http } from '@unireq/http';
import { interpolate } from '../../workspace/variables/resolver.js';
import type { InterpolationContext } from '../../workspace/variables/types.js';
import type { OAuth2ClientCredentialsConfig, ResolvedCredential } from '../types.js';

/**
 * Error thrown when OAuth2 token request fails
 */
export class OAuth2TokenError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly error?: string,
    public readonly errorDescription?: string,
  ) {
    const message = errorDescription
      ? `OAuth2 token request failed: ${error} - ${errorDescription}`
      : `OAuth2 token request failed: ${status} ${statusText}`;
    super(message);
    this.name = 'OAuth2TokenError';
  }
}

/**
 * Standard OAuth2 token response
 * https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
 */
interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

/**
 * OAuth2 error response
 * https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
 */
interface OAuth2ErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * Format the token value using the inject format template
 *
 * @param token - The access token value
 * @param format - Format template with ${token} placeholder
 * @returns Formatted value
 */
function formatTokenValue(token: string, format: string): string {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: This is the expected format pattern
  return format.replace('${token}', token);
}

/**
 * Build the token request body for client_credentials grant
 */
function buildTokenRequestBody(
  clientId: string,
  clientSecret: string,
  scope?: string,
  audience?: string,
): Record<string, string> {
  const params: Record<string, string> = {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  };

  if (scope) {
    params['scope'] = scope;
  }

  if (audience) {
    params['audience'] = audience;
  }

  return params;
}

/**
 * Resolve an OAuth2 Client Credentials provider configuration to a credential
 *
 * This function:
 * 1. Interpolates variables in the configuration
 * 2. Sends token request to the OAuth2 token endpoint
 * 3. Extracts the access token from the response
 * 4. Returns a credential formatted for injection
 *
 * @param config - The oauth2_client_credentials provider configuration
 * @param context - Interpolation context for variable resolution
 * @returns Promise of resolved credential ready for request injection
 * @throws OAuth2TokenError if token request fails
 * @throws VariableNotFoundError if a required variable is not defined
 *
 * @example
 * const config = {
 *   type: 'oauth2_client_credentials',
 *   tokenUrl: 'https://auth.example.com/oauth/token',
 *   clientId: '${var:client_id}',
 *   clientSecret: '${secret:client_secret}',
 *   scope: 'read write',
 *   inject: {
 *     location: 'header',
 *     name: 'Authorization',
 *     format: 'Bearer ${token}'
 *   }
 * };
 * const credential = await resolveOAuth2ClientCredentialsProvider(config, context);
 */
export async function resolveOAuth2ClientCredentialsProvider(
  config: OAuth2ClientCredentialsConfig,
  context: InterpolationContext = { vars: {} },
): Promise<ResolvedCredential> {
  // Interpolate configuration values
  const tokenUrl = interpolate(config.tokenUrl, context);
  const clientId = interpolate(config.clientId, context);
  const clientSecret = interpolate(config.clientSecret, context);
  const scope = config.scope ? interpolate(config.scope, context) : undefined;
  const audience = config.audience ? interpolate(config.audience, context) : undefined;

  // Build token request body
  const requestBody = buildTokenRequestBody(clientId, clientSecret, scope, audience);

  // Create HTTP client with proper content type
  const httpTransport = http();
  const httpClient = client(
    httpTransport,
    headersPolicy({
      Accept: 'application/json',
    }),
  );

  // Execute token request with form-encoded body
  const formBody = body.form(requestBody);
  const response = await httpClient.post(tokenUrl, formBody);

  // Handle error responses
  if (response.status < 200 || response.status >= 300) {
    const errorData = response.data as OAuth2ErrorResponse | undefined;
    throw new OAuth2TokenError(response.status, response.statusText, errorData?.error, errorData?.error_description);
  }

  // Extract access token from response
  const tokenData = response.data as OAuth2TokenResponse;

  if (!tokenData.access_token) {
    throw new OAuth2TokenError(
      response.status,
      response.statusText,
      'invalid_response',
      'Response did not contain access_token',
    );
  }

  // Format the token value
  const formattedValue = formatTokenValue(tokenData.access_token, config.inject.format);

  return {
    location: config.inject.location,
    name: config.inject.name,
    value: formattedValue,
  };
}
