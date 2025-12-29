/**
 * @unireq/oauth - Bearer integration tests (MSW)
 * Tests end-to-end OAuth Bearer authentication flows
 */

import { client } from '@unireq/core';
import { http, json } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlers, MOCK_API_BASE } from '../../scripts/msw/handlers.js';

// Setup MSW server for this integration test suite
const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('@unireq/oauth - bearer integration (MSW)', () => {
  let tokenVersion = 1;

  const createTokenSupplier = () => {
    return vi.fn(async () => {
      // Simulate network latency to ensure lock is held long enough for concurrent requests
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Generate JWT with exp claim (1 hour from now)
      const payload = {
        sub: 'test-user',
        exp: Math.floor(Date.now() / 1000) + 3600,
        v: tokenVersion++,
      };

      const encodedPayload = btoa(JSON.stringify(payload));
      return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.signature`;
    });
  };

  beforeEach(() => {
    tokenVersion = 1;
  });

  it('should authenticate with Bearer token (end-to-end)', async () => {
    const tokenSupplier = createTokenSupplier();

    const api = client(http(MOCK_API_BASE), oauthBearer({ tokenSupplier, allowUnsafeMode: true }), json());

    const response = await api.get<{ message: string; user: string; tokenVersion: number }>('/protected');

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Access granted');
    expect(response.data.user).toBe('test-user');
    expect(response.data.tokenVersion).toBe(1);
    expect(tokenSupplier).toHaveBeenCalledOnce();
  });

  it('should handle 401 and auto-refresh token (end-to-end)', async () => {
    let expiredToken = true;

    const tokenSupplier = vi.fn(async () => {
      if (expiredToken) {
        // First call: return expired token
        expiredToken = false;
        const payload = {
          sub: 'test-user',
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          v: 1,
        };
        const encodedPayload = btoa(JSON.stringify(payload));
        return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.signature`;
      }

      // Second call: return fresh token
      const payload = {
        sub: 'test-user',
        exp: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
        v: 2,
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.signature`;
    });

    const api = client(http(MOCK_API_BASE), oauthBearer({ tokenSupplier, allowUnsafeMode: true }), json());

    const response = await api.get<{ message: string; user: string; tokenVersion: number }>('/protected');

    expect(response.status).toBe(200);
    expect(response.data.tokenVersion).toBe(2); // Should use refreshed token
    expect(tokenSupplier).toHaveBeenCalledTimes(2); // Initial expired + refresh
  });

  it('should handle 401 on expired token and auto-refresh once (end-to-end)', async () => {
    const onRefresh = vi.fn();

    // First call returns expired token, second returns fresh
    let callCount = 0;
    const tokenSupplier = vi.fn(async () => {
      callCount++;
      const exp = callCount === 1 ? Math.floor(Date.now() / 1000) - 3600 : Math.floor(Date.now() / 1000) + 3600;

      const payload = { sub: 'test-user', exp, v: callCount };
      const encodedPayload = btoa(JSON.stringify(payload));
      return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.signature`;
    });

    const api = client(http(MOCK_API_BASE), oauthBearer({ tokenSupplier, onRefresh, allowUnsafeMode: true }), json());

    const response = await api.get<{ message: string; tokenVersion: number }>('/protected');

    expect(response.status).toBe(200);
    expect(response.data.tokenVersion).toBe(2); // Used refreshed token
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(tokenSupplier).toHaveBeenCalledTimes(2);
  });

  it('should reuse token for multiple requests (no refresh)', async () => {
    const tokenSupplier = createTokenSupplier();

    const api = client(http(MOCK_API_BASE), oauthBearer({ tokenSupplier, allowUnsafeMode: true }), json());

    // First request
    const response1 = await api.get<{ tokenVersion: number }>('/protected');
    expect(response1.data.tokenVersion).toBe(1);

    // Second request - should reuse token
    const response2 = await api.get<{ tokenVersion: number }>('/protected');
    expect(response2.data.tokenVersion).toBe(1); // Same token

    expect(tokenSupplier).toHaveBeenCalledOnce(); // Only called once
  });

  it('should handle 401 without Bearer challenge (no auto-refresh)', async () => {
    const tokenSupplier = vi.fn(async () => {
      // Invalid token format (not JWT)
      return 'invalid-token';
    });

    const api = client(http(MOCK_API_BASE), oauthBearer({ tokenSupplier, allowUnsafeMode: true }), json());

    const response = await api.get('/protected');

    // Should return 401 without auto-refresh (no Bearer challenge)
    expect(response.status).toBe(401);
    expect(tokenSupplier).toHaveBeenCalledOnce(); // No retry
  });

  it('should handle concurrent requests with single-flight refresh', async () => {
    let firstCall = true;

    const tokenSupplier = vi.fn(async () => {
      // First call: expired token
      // All subsequent calls: fresh token
      const isExpired = firstCall;
      firstCall = false;

      const exp = isExpired ? Math.floor(Date.now() / 1000) - 3600 : Math.floor(Date.now() / 1000) + 3600;

      const payload = { sub: 'test-user', exp, v: isExpired ? 1 : 2 };
      const encodedPayload = btoa(JSON.stringify(payload));

      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.signature`;
    });

    const api = client(http(MOCK_API_BASE), oauthBearer({ tokenSupplier, allowUnsafeMode: true }), json());

    // Make 3 concurrent requests
    const [response1, response2, response3] = await Promise.all([
      api.get<{ tokenVersion: number }>('/protected'),
      api.get<{ tokenVersion: number }>('/protected'),
      api.get<{ tokenVersion: number }>('/protected'),
    ]);

    // All should succeed with refreshed token
    expect(response1.data.tokenVersion).toBe(2);
    expect(response2.data.tokenVersion).toBe(2);
    expect(response3.data.tokenVersion).toBe(2);

    // Token supplier called: initial + single refresh (not 3 refreshes)
    expect(tokenSupplier).toHaveBeenCalledTimes(2);
  });
});
