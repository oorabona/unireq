/**
 * MSW handlers for integration tests
 * @see https://mswjs.io/docs/
 */

import { HttpResponse, http } from 'msw';
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

/**
 * Base URL for mock API
 */
export const MOCK_API_BASE = MOCK_ENDPOINTS.TEST;

/**
 * OAuth handlers for integration tests
 */
export const oauthHandlers = [
  // GET /protected - requires Bearer token
  http.get(`${MOCK_API_BASE}${PATHS.PROTECTED}`, ({ request }) => {
    const auth = request.headers.get('authorization');

    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(createOAuthErrorResponse(RESPONSE_MESSAGES.UNAUTHORIZED), {
        status: 401,
        headers: OAUTH_HEADERS.UNAUTHORIZED,
      });
    }

    const token = auth.substring(7);
    const { valid, payload, error } = parseJWT(token);

    if (!valid || !payload) {
      const headers = error === RESPONSE_MESSAGES.TOKEN_EXPIRED ? OAUTH_HEADERS.INVALID_TOKEN : undefined;

      return HttpResponse.json(createOAuthErrorResponse(error || RESPONSE_MESSAGES.INVALID_TOKEN), {
        status: 401,
        headers,
      });
    }

    return HttpResponse.json(createOAuthSuccessResponse(payload));
  }),
];

/**
 * Multipart upload handlers for integration tests
 */
export const multipartHandlers = [
  // POST /upload - multipart/form-data handler
  http.post(`${MOCK_API_BASE}${PATHS.UPLOAD}`, async ({ request }) => {
    try {
      // Clone request to avoid stream consumption issues
      const formData = await request.clone().formData();
      const { files, fields } = extractMultipartData(formData);

      return HttpResponse.json(createMultipartSuccessResponse(files, fields, true));
    } catch (error) {
      console.error('[MSW] FormData parse error:', error);
      console.error('[MSW] Request headers:', Object.fromEntries(request.headers.entries()));
      return HttpResponse.json(createOAuthErrorResponse(RESPONSE_MESSAGES.MULTIPART_PARSE_FAILED), {
        status: 400,
      });
    }
  }),
];

/**
 * Retry handlers for integration tests
 */
let retryAttempts = 0;

export const retryHandlers = [
  // GET /flaky - returns 500 for first 2 attempts, then 200
  http.get(`${MOCK_API_BASE}${PATHS.FLAKY}`, () => {
    retryAttempts++;

    if (retryAttempts < RETRY_CONFIG.FLAKY_SUCCESS_AFTER) {
      return HttpResponse.json(createRetryErrorResponse(retryAttempts), { status: 500 });
    }

    // Reset for next test
    const attempt = retryAttempts;
    retryAttempts = 0;

    return HttpResponse.json(createRetrySuccessResponse(attempt));
  }),

  // GET /always-fails - always returns 500
  http.get(`${MOCK_API_BASE}${PATHS.ALWAYS_FAILS}`, () => {
    return HttpResponse.json(createOAuthErrorResponse(RESPONSE_MESSAGES.PERSISTENT_FAILURE), {
      status: 500,
    });
  }),

  // POST /always-fails - always returns 500 (for method filtering tests)
  http.post(`${MOCK_API_BASE}${PATHS.ALWAYS_FAILS}`, () => {
    return HttpResponse.json(createOAuthErrorResponse(RESPONSE_MESSAGES.PERSISTENT_FAILURE), {
      status: 500,
    });
  }),

  // GET /rate-limited - returns 429 with Retry-After header
  http.get(`${MOCK_API_BASE}${PATHS.RATE_LIMITED}`, () => {
    return HttpResponse.json(createOAuthErrorResponse(RESPONSE_MESSAGES.TOO_MANY_REQUESTS), {
      status: 429,
      headers: { 'retry-after': RETRY_CONFIG.RATE_LIMIT_RETRY_AFTER },
    });
  }),
];

/**
 * All handlers combined for integration tests
 */
export const handlers = [...oauthHandlers, ...multipartHandlers, ...retryHandlers];

/**
 * Reset retry counter (call in beforeEach or afterEach)
 */
export function resetRetryCounter() {
  retryAttempts = 0;
}
