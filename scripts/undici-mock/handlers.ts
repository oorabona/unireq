/**
 * Undici MockAgent handlers for integration tests
 * Equivalent to MSW handlers but using undici's MockAgent
 * @see https://undici.nodejs.org/docs/docs/api/MockAgent
 */

import type { MockPool } from 'undici';
import {
  createMultipartSuccessResponse,
  createOAuthErrorResponse,
  createOAuthSuccessResponse,
  createRetryErrorResponse,
  createRetrySuccessResponse,
  extractMultipartData,
  MOCK_ENDPOINTS,
  OAUTH_HEADERS,
  PATHS,
  parseJWT,
  RESPONSE_MESSAGES,
  RETRY_CONFIG,
} from '../shared-mocks.js';
import { getMockPool } from './setup.js';

/**
 * Base URL for mock API (origin only, no path)
 */
export const MOCK_API_BASE = MOCK_ENDPOINTS.TEST;
const MOCK_ORIGIN = new URL(MOCK_API_BASE).origin;

/**
 * Retry counter for flaky endpoint simulation
 */
let retryAttempts = 0;

/**
 * Reset retry counter (call in beforeEach)
 */
export function resetRetryCounter(): void {
  retryAttempts = 0;
}

/**
 * Setup OAuth handlers on the mock pool
 */
export function setupOAuthHandlers(pool: MockPool): void {
  // GET /protected - requires Bearer token
  pool
    .intercept({
      path: PATHS.PROTECTED,
      method: 'GET',
    })
    .reply(({ headers }) => {
      const auth = headers?.authorization as string | undefined;

      if (!auth?.startsWith('Bearer ')) {
        return {
          statusCode: 401,
          data: JSON.stringify(createOAuthErrorResponse(RESPONSE_MESSAGES.UNAUTHORIZED)),
          headers: {
            'content-type': 'application/json',
            ...OAUTH_HEADERS.UNAUTHORIZED,
          },
        };
      }

      const token = auth.substring(7);
      const { valid, payload, error } = parseJWT(token);

      if (!valid || !payload) {
        const wwwAuth =
          error === RESPONSE_MESSAGES.TOKEN_EXPIRED
            ? OAUTH_HEADERS.INVALID_TOKEN
            : OAUTH_HEADERS.UNAUTHORIZED;

        return {
          statusCode: 401,
          data: JSON.stringify(createOAuthErrorResponse(error || RESPONSE_MESSAGES.INVALID_TOKEN)),
          headers: {
            'content-type': 'application/json',
            ...wwwAuth,
          },
        };
      }

      return {
        statusCode: 200,
        data: JSON.stringify(createOAuthSuccessResponse(payload)),
        headers: { 'content-type': 'application/json' },
      };
    })
    .persist();
}

/**
 * Setup multipart handlers on the mock pool
 */
export function setupMultipartHandlers(pool: MockPool): void {
  // POST /upload - multipart/form-data handler
  pool
    .intercept({
      path: PATHS.UPLOAD,
      method: 'POST',
    })
    .reply(async ({ body }) => {
      try {
        // Parse multipart body - this is simplified
        // In real tests, we'd need proper multipart parsing
        // For now, return a generic success
        const files: Record<string, { filename: string; size: number; type: string }> = {};
        const fields: Record<string, string> = {};

        // Try to parse as FormData if possible
        if (body) {
          // Body might be a stream or buffer, handle accordingly
          // This is a simplified handler for testing
        }

        return {
          statusCode: 200,
          data: JSON.stringify(createMultipartSuccessResponse(files, fields, true)),
          headers: { 'content-type': 'application/json' },
        };
      } catch (error) {
        return {
          statusCode: 400,
          data: JSON.stringify(createOAuthErrorResponse(RESPONSE_MESSAGES.MULTIPART_PARSE_FAILED)),
          headers: { 'content-type': 'application/json' },
        };
      }
    })
    .persist();
}

/**
 * Setup retry handlers on the mock pool
 */
export function setupRetryHandlers(pool: MockPool): void {
  // GET /flaky - returns 500 for first 2 attempts, then 200
  pool
    .intercept({
      path: PATHS.FLAKY,
      method: 'GET',
    })
    .reply(() => {
      retryAttempts++;

      if (retryAttempts < RETRY_CONFIG.FLAKY_SUCCESS_AFTER) {
        return {
          statusCode: 500,
          data: JSON.stringify(createRetryErrorResponse(retryAttempts)),
          headers: { 'content-type': 'application/json' },
        };
      }

      // Reset for next test
      const attempt = retryAttempts;
      retryAttempts = 0;

      return {
        statusCode: 200,
        data: JSON.stringify(createRetrySuccessResponse(attempt)),
        headers: { 'content-type': 'application/json' },
      };
    })
    .persist();

  // GET /always-fails - always returns 500
  pool
    .intercept({
      path: PATHS.ALWAYS_FAILS,
      method: 'GET',
    })
    .reply({
      statusCode: 500,
      data: JSON.stringify(createOAuthErrorResponse(RESPONSE_MESSAGES.PERSISTENT_FAILURE)),
      headers: { 'content-type': 'application/json' },
    })
    .persist();

  // POST /always-fails - always returns 500 (for method filtering tests)
  pool
    .intercept({
      path: PATHS.ALWAYS_FAILS,
      method: 'POST',
    })
    .reply({
      statusCode: 500,
      data: JSON.stringify(createOAuthErrorResponse(RESPONSE_MESSAGES.PERSISTENT_FAILURE)),
      headers: { 'content-type': 'application/json' },
    })
    .persist();

  // GET /rate-limited - returns 429 with Retry-After header
  pool
    .intercept({
      path: PATHS.RATE_LIMITED,
      method: 'GET',
    })
    .reply({
      statusCode: 429,
      data: JSON.stringify(createOAuthErrorResponse(RESPONSE_MESSAGES.TOO_MANY_REQUESTS)),
      headers: {
        'content-type': 'application/json',
        'retry-after': RETRY_CONFIG.RATE_LIMIT_RETRY_AFTER,
      },
    })
    .persist();
}

/**
 * Setup all handlers on the mock pool
 * Call this in beforeAll() after setupMockAgent()
 */
export function setupAllHandlers(): MockPool {
  const pool = getMockPool(MOCK_ORIGIN);

  setupOAuthHandlers(pool);
  setupMultipartHandlers(pool);
  setupRetryHandlers(pool);

  return pool;
}

/**
 * Setup basic test handlers for executor integration tests
 * These are simpler handlers that don't need complex state
 */
export function setupExecutorHandlers(pool: MockPool): void {
  // GET /users - success response
  pool
    .intercept({ path: '/users', method: 'GET' })
    .reply({
      statusCode: 200,
      data: JSON.stringify({ users: [{ id: 1, name: 'Alice' }] }),
      headers: { 'content-type': 'application/json' },
    })
    .persist();

  // GET /echo-query - echo query params
  pool
    .intercept({ path: /^\/echo-query/, method: 'GET' })
    .reply(({ path }) => {
      const url = new URL(path, 'http://localhost');
      const params = Object.fromEntries(url.searchParams);
      return {
        statusCode: 200,
        data: JSON.stringify({ query: params }),
        headers: { 'content-type': 'application/json' },
      };
    })
    .persist();

  // GET /echo-headers - echo request headers
  pool
    .intercept({ path: '/echo-headers', method: 'GET' })
    .reply(({ headers }) => {
      return {
        statusCode: 200,
        data: JSON.stringify({ headers }),
        headers: { 'content-type': 'application/json' },
      };
    })
    .persist();

  // POST /users - create user
  pool
    .intercept({ path: '/users', method: 'POST' })
    .reply(async ({ body }) => {
      let parsedBody = {};
      if (body) {
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
          chunks.push(chunk);
        }
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          parsedBody = JSON.parse(text);
        } catch {
          // ignore parse errors
        }
      }
      return {
        statusCode: 201,
        data: JSON.stringify({ created: parsedBody }),
        headers: { 'content-type': 'application/json' },
      };
    })
    .persist();

  // PUT /users/:id - update user
  pool
    .intercept({ path: /^\/users\/\d+$/, method: 'PUT' })
    .reply(async ({ path, body }) => {
      const id = path.split('/').pop();
      let parsedBody = {};
      if (body) {
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
          chunks.push(chunk);
        }
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          parsedBody = JSON.parse(text);
        } catch {
          // ignore parse errors
        }
      }
      return {
        statusCode: 200,
        data: JSON.stringify({ updated: { id, ...parsedBody } }),
        headers: { 'content-type': 'application/json' },
      };
    })
    .persist();

  // PATCH /users/:id - patch user
  pool
    .intercept({ path: /^\/users\/\d+$/, method: 'PATCH' })
    .reply(async ({ path, body }) => {
      const id = path.split('/').pop();
      let parsedBody = {};
      if (body) {
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
          chunks.push(chunk);
        }
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          parsedBody = JSON.parse(text);
        } catch {
          // ignore parse errors
        }
      }
      return {
        statusCode: 200,
        data: JSON.stringify({ patched: { id, ...parsedBody } }),
        headers: { 'content-type': 'application/json' },
      };
    })
    .persist();

  // DELETE /users/:id - delete user
  pool
    .intercept({ path: /^\/users\/\d+$/, method: 'DELETE' })
    .reply(({ path }) => {
      const id = path.split('/').pop();
      return {
        statusCode: 200,
        data: JSON.stringify({ deleted: id }),
        headers: { 'content-type': 'application/json' },
      };
    })
    .persist();

  // HEAD /health - health check
  pool
    .intercept({ path: '/health', method: 'HEAD' })
    .reply({
      statusCode: 200,
      data: '',
      headers: { 'x-status': 'healthy' },
    })
    .persist();

  // OPTIONS /api - options request
  pool
    .intercept({ path: '/api', method: 'OPTIONS' })
    .reply({
      statusCode: 200,
      data: '',
      headers: { allow: 'GET, POST, PUT, DELETE' },
    })
    .persist();

  // GET /not-found - 404 error
  pool
    .intercept({ path: '/not-found', method: 'GET' })
    .reply({
      statusCode: 404,
      data: JSON.stringify({ error: 'Not found' }),
      headers: { 'content-type': 'application/json' },
    })
    .persist();

  // GET /server-error - 500 error
  pool
    .intercept({ path: '/server-error', method: 'GET' })
    .reply({
      statusCode: 500,
      data: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'content-type': 'application/json' },
    })
    .persist();

  // GET /network-error - simulates network error
  pool
    .intercept({ path: '/network-error', method: 'GET' })
    .replyWithError(new Error('Network error'))
    .persist();
}
