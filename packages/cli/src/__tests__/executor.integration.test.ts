/**
 * Integration tests for executeRequest using undici MockAgent
 * Following GWT (Given/When/Then) pattern for integration tests
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupExecutorHandlers } from './helpers/undici-mock/handlers.js';
import { closeMockAgent, getMockPool, setupMockAgent } from './helpers/undici-mock/setup.js';
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

// Setup undici MockAgent
beforeAll(() => {
  setupMockAgent();
  const pool = getMockPool(TEST_URL);
  setupExecutorHandlers(pool);
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await closeMockAgent();
});

describe('executeRequest integration', () => {
  describe('Given MockAgent server is running', () => {
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
        const result = await executeRequest(request);

        // Assert - body content is displayed
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('users'));
        // Status is returned in result (not shown in output by default)
        expect(result?.status).toBe(200);
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

        // Assert - headers are echoed back (case may vary)
        expect(consola.log).toHaveBeenCalledWith(
          expect.stringMatching(/x-custom-header/i),
        );
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
        const result = await executeRequest(request);

        // Assert - body content is displayed
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('Bob'));
        // Status is returned in result
        expect(result?.status).toBe(201);
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
        const result = await executeRequest(request);

        // Assert - body content is displayed
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('Updated'));
        // Status is returned in result
        expect(result?.status).toBe(200);
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
        const result = await executeRequest(request);

        // Assert - body content is displayed
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('active'));
        // Status is returned in result
        expect(result?.status).toBe(200);
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
        const result = await executeRequest(request);

        // Assert - body content is displayed
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('789'));
        // Status is returned in result
        expect(result?.status).toBe(200);
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
        const result = await executeRequest(request);

        // Assert - HEAD returns empty body, status in result
        expect(result?.status).toBe(200);
        expect(result?.headers['x-status']).toBe('healthy');
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
        const result = await executeRequest(request);

        // Assert - OPTIONS returns empty body, status in result
        expect(result?.status).toBe(200);
        expect(result?.headers['allow']).toBe('GET, POST, PUT, DELETE');
      });
    });
  });

  describe('Given server returns error response', () => {
    describe('When 404 error is returned', () => {
      it('Then error status is returned in result', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'GET',
          url: `${TEST_URL}/not-found`,
          headers: [],
          query: [],
        };

        // Act
        const result = await executeRequest(request);

        // Assert - error body is displayed, status in result
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('Not found'));
        expect(result?.status).toBe(404);
      });
    });

    describe('When 500 error is returned', () => {
      it('Then error status is returned in result', async () => {
        // Arrange
        const request: ParsedRequest = {
          method: 'GET',
          url: `${TEST_URL}/server-error`,
          headers: [],
          query: [],
        };

        // Act
        const result = await executeRequest(request);

        // Assert - error body is displayed, status in result
        expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('Internal server error'));
        expect(result?.status).toBe(500);
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
