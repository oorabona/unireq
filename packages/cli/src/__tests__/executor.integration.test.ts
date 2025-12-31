/**
 * Integration tests for executeRequest using msw
 * Following GWT (Given/When/Then) pattern for integration tests
 */

import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { executeRequest } from '../executor.js';
import type { ParsedRequest } from '../types.js';

// Mock consola to capture output
vi.mock('consola', () => ({
  consola: {
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { consola } from 'consola';

// Test server URL
const TEST_URL = 'http://test.local';

// MSW handlers
const handlers = [
  // GET success
  http.get(`${TEST_URL}/users`, () => {
    return HttpResponse.json({ users: [{ id: 1, name: 'Alice' }] });
  }),

  // GET with query params echo
  http.get(`${TEST_URL}/echo-query`, ({ request }) => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    return HttpResponse.json({ query: params });
  }),

  // GET with headers echo
  http.get(`${TEST_URL}/echo-headers`, ({ request }) => {
    const echoHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      echoHeaders[key] = value;
    });
    return HttpResponse.json({ headers: echoHeaders });
  }),

  // POST with JSON body
  http.post(`${TEST_URL}/users`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ created: body }, { status: 201 });
  }),

  // PUT request
  http.put(`${TEST_URL}/users/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({ updated: { id: params['id'], ...(body as object) } });
  }),

  // PATCH request
  http.patch(`${TEST_URL}/users/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({ patched: { id: params['id'], ...(body as object) } });
  }),

  // DELETE request
  http.delete(`${TEST_URL}/users/:id`, ({ params }) => {
    return HttpResponse.json({ deleted: params['id'] });
  }),

  // HEAD request
  http.head(`${TEST_URL}/health`, () => {
    return new HttpResponse(null, {
      status: 200,
      headers: { 'x-status': 'healthy' },
    });
  }),

  // OPTIONS request
  http.options(`${TEST_URL}/api`, () => {
    return new HttpResponse(null, {
      status: 200,
      headers: { Allow: 'GET, POST, PUT, DELETE' },
    });
  }),

  // 404 error
  http.get(`${TEST_URL}/not-found`, () => {
    return HttpResponse.json({ error: 'Not found' }, { status: 404 });
  }),

  // 500 error
  http.get(`${TEST_URL}/server-error`, () => {
    return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
  }),

  // Network error simulation
  http.get(`${TEST_URL}/network-error`, () => {
    return HttpResponse.error();
  }),
];

// Setup msw server
const server = setupServer(...handlers);

describe('executeRequest integration', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  describe('Given msw server is running', () => {
    describe('When GET request is executed', () => {
      it('Then response is displayed correctly', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'GET',
          url: `${TEST_URL}/users`,
          headers: [],
          query: [],
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('200'));
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('users'));
      });
    });

    describe('When GET request with query params is executed', () => {
      it('Then query params are sent to server', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'GET',
          url: `${TEST_URL}/echo-query`,
          headers: [],
          query: ['foo=bar', 'baz=qux'],
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('foo'));
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('bar'));
      });
    });

    describe('When GET request with custom headers is executed', () => {
      it('Then headers are sent to server', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'GET',
          url: `${TEST_URL}/echo-headers`,
          headers: ['X-Custom-Header:test-value'],
          query: [],
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('x-custom-header'));
      });
    });

    describe('When POST request with JSON body is executed', () => {
      it('Then body is sent and response received', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'POST',
          url: `${TEST_URL}/users`,
          headers: [],
          query: [],
          body: '{"name":"Bob"}',
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('201'));
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('Bob'));
      });
    });

    describe('When PUT request is executed', () => {
      it('Then update response is received', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'PUT',
          url: `${TEST_URL}/users/123`,
          headers: [],
          query: [],
          body: '{"name":"Updated"}',
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('200'));
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('Updated'));
      });
    });

    describe('When PATCH request is executed', () => {
      it('Then patch response is received', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'PATCH',
          url: `${TEST_URL}/users/456`,
          headers: [],
          query: [],
          body: '{"status":"active"}',
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('200'));
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('active'));
      });
    });

    describe('When DELETE request is executed', () => {
      it('Then delete response is received', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'DELETE',
          url: `${TEST_URL}/users/789`,
          headers: [],
          query: [],
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('200'));
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('789'));
      });
    });

    describe('When HEAD request is executed', () => {
      it('Then status and headers are received', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'HEAD',
          url: `${TEST_URL}/health`,
          headers: [],
          query: [],
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('200'));
      });
    });

    describe('When OPTIONS request is executed', () => {
      it('Then allowed methods are received', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'OPTIONS',
          url: `${TEST_URL}/api`,
          headers: [],
          query: [],
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('200'));
      });
    });
  });

  describe('Given server returns error response', () => {
    describe('When 404 error is returned', () => {
      it('Then error status is displayed', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'GET',
          url: `${TEST_URL}/not-found`,
          headers: [],
          query: [],
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('404'));
      });
    });

    describe('When 500 error is returned', () => {
      it('Then error status is displayed', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'GET',
          url: `${TEST_URL}/server-error`,
          headers: [],
          query: [],
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('500'));
      });
    });
  });

  describe('Given network error occurs', () => {
    describe('When request fails with network error', () => {
      it('Then error message is displayed', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'GET',
          url: `${TEST_URL}/network-error`,
          headers: [],
          query: [],
        };

        // Act
        await executeRequest(request);

        // Assert
        expect(consola.error).toHaveBeenCalled();
      });
    });
  });
});
