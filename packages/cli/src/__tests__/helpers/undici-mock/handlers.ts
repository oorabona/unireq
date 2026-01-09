/**
 * Undici MockAgent handlers for integration tests
 * Equivalent to MSW handlers but using undici's MockAgent
 * @see https://undici.nodejs.org/docs/docs/api/MockAgent
 */

import type { MockPool } from 'undici';

/**
 * Type for mock reply options returned from callback
 */
interface MockReplyOptions {
  statusCode: number;
  data?: string | object | Buffer;
  responseOptions?: { headers?: Record<string, string> };
}

import {
  createMultipartSuccessResponse,
  createOAuthErrorResponse,
  createOAuthSuccessResponse,
  createRetryErrorResponse,
  createRetrySuccessResponse,
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
 * Helper to get a header value from either Headers or Record<string, string>
 */
function getHeader(headers: Record<string, string> | Headers | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  return headers[name];
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
    .reply(({ headers }): MockReplyOptions => {
      const auth = getHeader(headers, 'authorization');

      if (!auth?.startsWith('Bearer ')) {
        return {
          statusCode: 401,
          data: createOAuthErrorResponse(RESPONSE_MESSAGES.UNAUTHORIZED),
          responseOptions: {
            headers: {
              'content-type': 'application/json',
              ...OAUTH_HEADERS.UNAUTHORIZED,
            },
          },
        };
      }

      const token = auth.substring(7);
      const { valid, payload, error } = parseJWT(token);

      if (!valid || !payload) {
        const wwwAuth =
          error === RESPONSE_MESSAGES.TOKEN_EXPIRED ? OAUTH_HEADERS.INVALID_TOKEN : OAUTH_HEADERS.UNAUTHORIZED;

        return {
          statusCode: 401,
          data: createOAuthErrorResponse(error || RESPONSE_MESSAGES.INVALID_TOKEN),
          responseOptions: {
            headers: {
              'content-type': 'application/json',
              ...wwwAuth,
            },
          },
        };
      }

      return {
        statusCode: 200,
        data: createOAuthSuccessResponse(payload),
        responseOptions: { headers: { 'content-type': 'application/json' } },
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
    .reply((): MockReplyOptions => {
      try {
        const files: Record<string, { filename: string; size: number; type: string }> = {};
        const fields: Record<string, string> = {};

        return {
          statusCode: 200,
          data: createMultipartSuccessResponse(files, fields, true),
          responseOptions: { headers: { 'content-type': 'application/json' } },
        };
      } catch {
        return {
          statusCode: 400,
          data: createOAuthErrorResponse(RESPONSE_MESSAGES.MULTIPART_PARSE_FAILED),
          responseOptions: { headers: { 'content-type': 'application/json' } },
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
    .reply((): MockReplyOptions => {
      retryAttempts++;

      if (retryAttempts < RETRY_CONFIG.FLAKY_SUCCESS_AFTER) {
        return {
          statusCode: 500,
          data: createRetryErrorResponse(retryAttempts),
          responseOptions: { headers: { 'content-type': 'application/json' } },
        };
      }

      // Reset for next test
      const attempt = retryAttempts;
      retryAttempts = 0;

      return {
        statusCode: 200,
        data: createRetrySuccessResponse(attempt),
        responseOptions: { headers: { 'content-type': 'application/json' } },
      };
    })
    .persist();

  // GET /always-fails - always returns 500
  pool
    .intercept({
      path: PATHS.ALWAYS_FAILS,
      method: 'GET',
    })
    .reply(500, createOAuthErrorResponse(RESPONSE_MESSAGES.PERSISTENT_FAILURE), {
      headers: { 'content-type': 'application/json' },
    })
    .persist();

  // POST /always-fails - always returns 500 (for method filtering tests)
  pool
    .intercept({
      path: PATHS.ALWAYS_FAILS,
      method: 'POST',
    })
    .reply(500, createOAuthErrorResponse(RESPONSE_MESSAGES.PERSISTENT_FAILURE), {
      headers: { 'content-type': 'application/json' },
    })
    .persist();

  // GET /rate-limited - returns 429 with Retry-After header
  pool
    .intercept({
      path: PATHS.RATE_LIMITED,
      method: 'GET',
    })
    .reply(429, createOAuthErrorResponse(RESPONSE_MESSAGES.TOO_MANY_REQUESTS), {
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
    .reply(
      200,
      { users: [{ id: 1, name: 'Alice' }] },
      {
        headers: { 'content-type': 'application/json' },
      },
    )
    .persist();

  // GET /echo-query - echo query params
  pool
    .intercept({ path: /^\/echo-query/, method: 'GET' })
    .reply(({ path }): MockReplyOptions => {
      const url = new URL(path, 'http://localhost');
      const params = Object.fromEntries(url.searchParams);
      return {
        statusCode: 200,
        data: { query: params },
        responseOptions: { headers: { 'content-type': 'application/json' } },
      };
    })
    .persist();

  // GET /echo-headers - echo request headers
  pool
    .intercept({ path: '/echo-headers', method: 'GET' })
    .reply(({ headers }): MockReplyOptions => {
      return {
        statusCode: 200,
        data: { headers },
        responseOptions: { headers: { 'content-type': 'application/json' } },
      };
    })
    .persist();

  // POST /users - create user
  pool
    .intercept({ path: '/users', method: 'POST' })
    .reply(({ body }): MockReplyOptions => {
      let parsedBody = {};
      if (body) {
        // Body comes as string when sent via fetch
        if (typeof body === 'string') {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            // ignore parse errors
          }
        }
      }
      return {
        statusCode: 201,
        data: { created: parsedBody },
        responseOptions: { headers: { 'content-type': 'application/json' } },
      };
    })
    .persist();

  // PUT /users/:id - update user
  pool
    .intercept({ path: /^\/users\/\d+$/, method: 'PUT' })
    .reply(({ path, body }): MockReplyOptions => {
      const id = path.split('/').pop();
      let parsedBody = {};
      if (body) {
        if (typeof body === 'string') {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            // ignore parse errors
          }
        }
      }
      return {
        statusCode: 200,
        data: { updated: { id, ...parsedBody } },
        responseOptions: { headers: { 'content-type': 'application/json' } },
      };
    })
    .persist();

  // PATCH /users/:id - patch user
  pool
    .intercept({ path: /^\/users\/\d+$/, method: 'PATCH' })
    .reply(({ path, body }): MockReplyOptions => {
      const id = path.split('/').pop();
      let parsedBody = {};
      if (body) {
        if (typeof body === 'string') {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            // ignore parse errors
          }
        }
      }
      return {
        statusCode: 200,
        data: { patched: { id, ...parsedBody } },
        responseOptions: { headers: { 'content-type': 'application/json' } },
      };
    })
    .persist();

  // DELETE /users/:id - delete user
  pool
    .intercept({ path: /^\/users\/\d+$/, method: 'DELETE' })
    .reply(({ path }): MockReplyOptions => {
      const id = path.split('/').pop();
      return {
        statusCode: 200,
        data: { deleted: id },
        responseOptions: { headers: { 'content-type': 'application/json' } },
      };
    })
    .persist();

  // HEAD /health - health check
  pool
    .intercept({ path: '/health', method: 'HEAD' })
    .reply(200, '', { headers: { 'x-status': 'healthy' } })
    .persist();

  // OPTIONS /api - options request
  pool
    .intercept({ path: '/api', method: 'OPTIONS' })
    .reply(200, '', { headers: { allow: 'GET, POST, PUT, DELETE' } })
    .persist();

  // GET /not-found - 404 error
  pool
    .intercept({ path: '/not-found', method: 'GET' })
    .reply(
      404,
      { error: 'Not found' },
      {
        headers: { 'content-type': 'application/json' },
      },
    )
    .persist();

  // GET /server-error - 500 error
  pool
    .intercept({ path: '/server-error', method: 'GET' })
    .reply(
      500,
      { error: 'Internal server error' },
      {
        headers: { 'content-type': 'application/json' },
      },
    )
    .persist();

  // GET /network-error - simulates network error
  pool.intercept({ path: '/network-error', method: 'GET' }).replyWithError(new Error('Network error')).persist();
}
