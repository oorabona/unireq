/**
 * @unireq/presets - End-to-end integration tests (MSW)
 * Verifies each preset works with real HTTP request/response cycles.
 *
 * Uses undici MockAgent (setGlobalDispatcher) because the @unireq/http transport
 * uses undici directly and is not intercepted by MSW's fetch/http.request hooks.
 */

import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preset } from '../builder.js';
import { httpClient, restApi, scraper, webhook } from '../index.js';

// ─── Shared test base ────────────────────────────────────────────────────────
const BASE_HOST = 'preset-test.local';
const BASE = `http://${BASE_HOST}`;

// ─── MockAgent setup (reused per test, handlers registered in beforeEach) ───
let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

// ─── restApi preset ──────────────────────────────────────────────────────────

describe('restApi preset', () => {
  it('GET returns parsed JSON', async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/users/1', method: 'GET' })
      .reply(200, JSON.stringify({ id: 1, name: 'Alice' }), {
        headers: { 'content-type': 'application/json' },
      });

    const api = restApi(BASE);
    const res = await api.get<{ id: number; name: string }>('/users/1');

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ id: 1, name: 'Alice' });
  });

  it('POST with body returns 201', async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/users', method: 'POST' })
      .reply(201, JSON.stringify({ id: 99, name: 'Bob' }), {
        headers: { 'content-type': 'application/json' },
      });

    const api = restApi(BASE);
    const res = await api.post<{ id: number; name: string }>('/users', { body: { name: 'Bob' } });

    expect(res.status).toBe(201);
    expect(res.data).toEqual({ id: 99, name: 'Bob' });
  });

  it('handles 429 with Retry-After, retries and succeeds', async () => {
    vi.useFakeTimers();

    const pool = mockAgent.get(BASE);
    // First call: 429 with Retry-After header
    pool
      .intercept({ path: '/rate-limited', method: 'GET' })
      .reply(429, JSON.stringify({ error: 'rate limited' }), {
        headers: { 'content-type': 'application/json', 'retry-after': '1' },
      });
    // Second call: success
    pool
      .intercept({ path: '/rate-limited', method: 'GET' })
      .reply(200, JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      });

    const api = restApi(BASE, { retries: 3 });
    const promise = api.get<{ ok: boolean }>('/rate-limited');

    // Advance timers past the Retry-After delay (1s = 1000ms)
    await vi.advanceTimersByTimeAsync(1100);

    const res = await promise;
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });

    vi.useRealTimers();
  });

  it('handles 500 without retry (non-retryable for POST), returns error', async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/error', method: 'POST' })
      .reply(500, JSON.stringify({ error: 'server error' }), {
        headers: { 'content-type': 'application/json' },
      });

    // POST is not in the retryable methods list for restApi
    const api = restApi(BASE, { retries: 3 });
    const res = await api.post('/error', { body: {} });

    expect(res.status).toBe(500);
    expect(res.ok).toBe(false);
  });
});

// ─── webhook preset ──────────────────────────────────────────────────────────

describe('webhook preset', () => {
  it('POST sends body with correct content-type', async () => {
    let receivedContentType: string | undefined;
    let receivedBody: string | undefined;

    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/hook', method: 'POST' })
      .reply(200, (_opts) => {
        receivedContentType = _opts.headers?.['content-type'] as string | undefined;
        receivedBody = _opts.body as string | undefined;
        return JSON.stringify({ received: true });
      }, { headers: { 'content-type': 'application/json' } });

    const hooks = webhook(BASE);
    const res = await hooks.post<{ received: boolean }>('/hook', {
      body: { event: 'order.created', orderId: 42 },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ received: true });
    expect(receivedContentType).toContain('application/json');
    expect(JSON.parse(receivedBody ?? '{}')).toEqual({ event: 'order.created', orderId: 42 });
  });

  it('retries aggressively on 5xx (up to 3 times with custom retries)', async () => {
    vi.useFakeTimers();

    let calls = 0;
    const pool = mockAgent.get(BASE);
    // First two calls fail
    pool
      .intercept({ path: '/flaky-hook', method: 'POST' })
      .reply(() => {
        calls++;
        return { statusCode: 503, data: JSON.stringify({ error: 'server error' }), responseOptions: { headers: { 'content-type': 'application/json' } } };
      });
    pool
      .intercept({ path: '/flaky-hook', method: 'POST' })
      .reply(() => {
        calls++;
        return { statusCode: 503, data: JSON.stringify({ error: 'server error' }), responseOptions: { headers: { 'content-type': 'application/json' } } };
      });
    // Third call succeeds
    pool
      .intercept({ path: '/flaky-hook', method: 'POST' })
      .reply(() => {
        calls++;
        return { statusCode: 200, data: JSON.stringify({ delivered: true }), responseOptions: { headers: { 'content-type': 'application/json' } } };
      });

    const hooks = webhook(BASE, { retries: 3 });
    const promise = hooks.post<{ delivered: boolean }>('/flaky-hook', {
      body: { event: 'ping' },
    });

    // Advance through backoff delays (500ms initial, then 1000ms)
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);

    const res = await promise;
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ delivered: true });
    expect(calls).toBe(3);

    vi.useRealTimers();
  });

  it('does NOT follow redirects', async () => {
    const pool = mockAgent.get(BASE);
    // Return a JSON body on the 302 so the json() parser in the chain doesn't error
    pool
      .intercept({ path: '/redirect-hook', method: 'POST' })
      .reply(302, JSON.stringify({ message: 'redirected' }), {
        headers: { 'content-type': 'application/json', location: `${BASE}/other` },
      });
    // /other should NEVER be called — if it is, the test will fail with unmatched request
    // (mockAgent.disableNetConnect() ensures any unexpected call throws)

    // webhook disallows all redirects — should return 302 directly
    const hooks = webhook(BASE);
    const res = await hooks.post('/redirect-hook', { body: {} });

    expect(res.status).toBe(302);
  });
});

// ─── scraper preset ──────────────────────────────────────────────────────────

describe('scraper preset', () => {
  it('GET returns HTML content', async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/page', method: 'GET' })
      .reply(200, '<html><body><h1>Hello</h1></body></html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });

    const crawler = scraper(BASE);
    const res = await crawler.get<string>('/page');

    expect(res.status).toBe(200);
    expect(res.data).toContain('<h1>Hello</h1>');
  });

  it('follows 301 redirect to final destination', async () => {
    const pool = mockAgent.get(BASE);
    // First request: 301 redirect — use relative location so the policy
    // can resolve it against the absolute request URL
    pool
      .intercept({ path: '/old-page', method: 'GET' })
      .reply(301, '', {
        headers: { location: '/new-page' },
      });
    // Redirect target
    pool
      .intercept({ path: '/new-page', method: 'GET' })
      .reply(200, '<html><body>New page</body></html>', {
        headers: { 'content-type': 'text/html' },
      });

    // Pass an absolute URL so the redirect policy can resolve location relative to it
    const crawler = scraper();
    const res = await crawler.get<string>(`${BASE}/old-page`);

    expect(res.status).toBe(200);
    expect(res.data).toContain('New page');
  });

  it('sends User-Agent header', async () => {
    let capturedHeaders: Record<string, string> | undefined;

    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/ua-check', method: 'GET' })
      .reply(200, (_opts) => {
        capturedHeaders = _opts.headers as Record<string, string> | undefined;
        return '<html/>';
      }, { headers: { 'content-type': 'text/html' } });

    const crawler = scraper(BASE);
    await crawler.get('/ua-check');

    // undici preserves header key casing from headersPolicy ('User-Agent')
    const ua = capturedHeaders?.['User-Agent'] ?? capturedHeaders?.['user-agent'];
    expect(ua).toBeDefined();
    expect((ua as string).length).toBeGreaterThan(0);
  });
});

// ─── httpClient helper ───────────────────────────────────────────────────────

describe('httpClient helper', () => {
  it('creates client with baseUrl and makes GET', async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/health', method: 'GET' })
      .reply(200, JSON.stringify({ status: 'ok' }), {
        headers: { 'content-type': 'application/json' },
      });

    const api = httpClient(BASE);
    const res = await api.get<{ status: string }>('/health');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ status: 'ok' });
  });

  it('sends custom headers with every request', async () => {
    let capturedHeaders: Record<string, string> | undefined;

    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/secure', method: 'GET' })
      .reply(200, (_opts) => {
        capturedHeaders = _opts.headers as Record<string, string> | undefined;
        return JSON.stringify({ ok: true });
      }, { headers: { 'content-type': 'application/json' } });

    const api = httpClient(BASE, { headers: { 'X-API-Key': 'test-key-123' } });
    await api.get('/secure');

    // undici preserves header key casing from headersPolicy ('X-API-Key')
    const apiKey = capturedHeaders?.['X-API-Key'] ?? capturedHeaders?.['x-api-key'];
    expect(apiKey).toBe('test-key-123');
  });

  it('applies timeout (fast handler responds before timeout)', async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/fast', method: 'GET' })
      .reply(200, JSON.stringify({ fast: true }), {
        headers: { 'content-type': 'application/json' },
      });

    const api = httpClient(BASE, { timeout: 5000 });
    const res = await api.get<{ fast: boolean }>('/fast');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ fast: true });
  });

  it('timeout triggers when handler delays beyond limit', async () => {
    vi.useFakeTimers();

    const pool = mockAgent.get(BASE);
    // Delay the response using undici's delay option
    pool
      .intercept({ path: '/slow', method: 'GET' })
      .reply(200, JSON.stringify({}), { headers: { 'content-type': 'application/json' } })
      .delay(1000);

    const { TimeoutError } = await import('@unireq/core');
    const api = httpClient(BASE, { timeout: 100 });
    const promise = api.get('/slow');

    // Advance timers past timeout
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).rejects.toThrow(TimeoutError);

    vi.useRealTimers();
  });
});

// ─── Fluent Builder API ──────────────────────────────────────────────────────

describe('preset fluent builder', () => {
  it('builds a working client and makes real request', async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/api/data', method: 'GET' })
      .reply(200, JSON.stringify({ value: 42 }), {
        headers: { 'content-type': 'application/json' },
      });

    const api = preset.api.json.build(BASE);
    const res = await api.get<{ value: number }>('/api/data');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ value: 42 });
  });

  it('full chain .api.json.retry.timeout.build makes real request', async () => {
    const pool = mockAgent.get(BASE);
    pool
      .intercept({ path: '/api/items', method: 'GET' })
      .reply(200, JSON.stringify([{ id: 1 }, { id: 2 }]), {
        headers: { 'content-type': 'application/json' },
      });

    const api = preset.api.json.retry.timeout.build(BASE);
    const res = await api.get<Array<{ id: number }>>('/api/items');

    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(2);
  });

  it('retry works through builder on transient failure', async () => {
    vi.useFakeTimers();

    let calls = 0;
    const pool = mockAgent.get(BASE);
    // First two calls fail with 500
    pool
      .intercept({ path: '/api/flaky', method: 'GET' })
      .reply(() => { calls++; return { statusCode: 500, data: JSON.stringify({ error: 'temporary' }), responseOptions: { headers: { 'content-type': 'application/json' } } }; });
    pool
      .intercept({ path: '/api/flaky', method: 'GET' })
      .reply(() => { calls++; return { statusCode: 500, data: JSON.stringify({ error: 'temporary' }), responseOptions: { headers: { 'content-type': 'application/json' } } }; });
    // Third call succeeds
    pool
      .intercept({ path: '/api/flaky', method: 'GET' })
      .reply(() => { calls++; return { statusCode: 200, data: JSON.stringify({ recovered: true }), responseOptions: { headers: { 'content-type': 'application/json' } } }; });

    const api = preset.api.json.retry.build(BASE);
    const promise = api.get<{ recovered: boolean }>('/api/flaky');

    // Advance through retry backoff delays
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const res = await promise;
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ recovered: true });
    expect(calls).toBe(3);

    vi.useRealTimers();
  });
});
