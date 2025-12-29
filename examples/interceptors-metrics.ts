/**
 * Interceptors - Metrics example
 * Demonstrates metrics collection using interceptors
 * Usage: pnpm example:interceptors-metrics
 */

import { client } from '@unireq/core';
import {
  type ErrorInterceptor,
  http,
  interceptError,
  interceptRequest,
  interceptResponse,
  parse,
  type RequestInterceptor,
  type ResponseInterceptor,
} from '@unireq/http';

console.log('📊 Interceptors - Metrics Examples\n');

// Example 1: Request counter
console.log('📊 Example 1: Request counter\n');

const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  requestsByMethod: {} as Record<string, number>,
  requestsByStatus: {} as Record<number, number>,
};

const countRequest: RequestInterceptor = (ctx) => {
  metrics.totalRequests++;
  metrics.requestsByMethod[ctx.method] = (metrics.requestsByMethod[ctx.method] || 0) + 1;
  return ctx;
};

const countResponse: ResponseInterceptor = (response) => {
  metrics.requestsByStatus[response.status] = (metrics.requestsByStatus[response.status] || 0) + 1;
  if (response.ok) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }
  return response;
};

const countError: ErrorInterceptor = (error) => {
  metrics.failedRequests++;
  throw error;
};

const api1 = client(
  http('http://localhost:3001'),
  interceptRequest(countRequest),
  interceptResponse(countResponse),
  interceptError(countError),
);

await api1.get('/get', parse.json());
await api1.post('/post', parse.json());
await api1.get('/status/404', parse.raw());

console.log('Metrics:');
console.log(`  Total requests: ${metrics.totalRequests}`);
console.log(`  Successful: ${metrics.successfulRequests}`);
console.log(`  Failed: ${metrics.failedRequests}`);
console.log(`  By method: ${JSON.stringify(metrics.requestsByMethod)}`);
console.log(`  By status: ${JSON.stringify(metrics.requestsByStatus)}`);
console.log('');

// Example 2: Response time tracking
console.log('📊 Example 2: Response time tracking\n');

interface TimingMetrics {
  count: number;
  total: number;
  min: number;
  max: number;
  avg: number;
}

const timings: Record<string, TimingMetrics> = {};

const trackTimingRequest: RequestInterceptor = (ctx) => {
  return { ...ctx, startTime: Date.now() };
};

const trackTimingResponse: ResponseInterceptor = (response, ctx) => {
  if ('startTime' in ctx) {
    const duration = Date.now() - (ctx['startTime'] as number);
    // Extract path from URL
    const url = ctx.url.startsWith('http') ? new URL(ctx.url).pathname : ctx.url;
    const key = `${ctx.method} ${url}`;

    if (!timings[key]) {
      timings[key] = { count: 0, total: 0, min: duration, max: duration, avg: 0 };
    }

    timings[key].count++;
    timings[key].total += duration;
    timings[key].min = Math.min(timings[key].min, duration);
    timings[key].max = Math.max(timings[key].max, duration);
    timings[key].avg = timings[key].total / timings[key].count;
  }
  return response;
};

const api2 = client(
  http('http://localhost:3001'),
  interceptRequest(trackTimingRequest),
  interceptResponse(trackTimingResponse),
);

await api2.get('/delay/1', parse.json());
await api2.get('/delay/2', parse.json());
await api2.post('/post', parse.json());

console.log('Response time metrics:');
for (const [endpoint, timing] of Object.entries(timings)) {
  console.log(`  ${endpoint}:`);
  console.log(`    Count: ${timing.count}`);
  console.log(`    Min: ${timing.min}ms`);
  console.log(`    Max: ${timing.max}ms`);
  console.log(`    Avg: ${timing.avg.toFixed(2)}ms`);
}
console.log('');

// Example 3: Bandwidth tracking
console.log('📊 Example 3: Bandwidth tracking\n');

const bandwidth = {
  sent: 0,
  received: 0,
};

const trackBandwidthRequest: RequestInterceptor = (ctx) => {
  if (ctx.body !== undefined) {
    try {
      const bodySize = typeof ctx.body === 'string' ? ctx.body.length : JSON.stringify(ctx.body).length;
      bandwidth.sent += bodySize;
    } catch {
      // Skip if body cannot be stringified
    }
  }
  return ctx;
};

const trackBandwidthResponse: ResponseInterceptor = (response) => {
  if (response.data !== undefined && response.data !== null) {
    try {
      const dataSize = typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length;
      bandwidth.received += dataSize;
    } catch {
      // Skip if data cannot be stringified
    }
  }
  return response;
};

const api3 = client(
  http('http://localhost:3001'),
  interceptRequest(trackBandwidthRequest),
  interceptResponse(trackBandwidthResponse),
);

await api3.get('/get', parse.json());
await api3.post('/post', parse.json());

console.log('Bandwidth usage:');
console.log(`  Sent: ${bandwidth.sent} bytes`);
console.log(`  Received: ${bandwidth.received} bytes`);
console.log(`  Total: ${bandwidth.sent + bandwidth.received} bytes`);
console.log('');

// Example 4: Real-time dashboard
console.log('📊 Example 4: Real-time metrics dashboard\n');

interface Dashboard {
  requests: {
    total: number;
    perSecond: number;
    lastMinute: number[];
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    current: number[];
  };
  errors: {
    rate: number;
    total: number;
  };
}

const dashboard: Dashboard = {
  requests: {
    total: 0,
    perSecond: 0,
    lastMinute: [],
  },
  latency: {
    p50: 0,
    p95: 0,
    p99: 0,
    current: [],
  },
  errors: {
    rate: 0,
    total: 0,
  },
};

const updateDashboardRequest: RequestInterceptor = (ctx) => {
  dashboard.requests.total++;
  dashboard.requests.lastMinute.push(Date.now());
  // Keep only last minute
  const oneMinuteAgo = Date.now() - 60000;
  dashboard.requests.lastMinute = dashboard.requests.lastMinute.filter((t) => t > oneMinuteAgo);
  dashboard.requests.perSecond = dashboard.requests.lastMinute.length / 60;

  return { ...ctx, startTime: Date.now() };
};

const updateDashboardResponse: ResponseInterceptor = (response, ctx) => {
  if ('startTime' in ctx) {
    const latency = Date.now() - (ctx['startTime'] as number);
    dashboard.latency.current.push(latency);

    // Keep last 100 samples
    if (dashboard.latency.current.length > 100) {
      dashboard.latency.current.shift();
    }

    // Calculate percentiles
    const sorted = [...dashboard.latency.current].sort((a, b) => a - b);
    dashboard.latency.p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    dashboard.latency.p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    dashboard.latency.p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  }

  if (!response.ok) {
    dashboard.errors.total++;
    dashboard.errors.rate = dashboard.errors.total / dashboard.requests.total;
  }

  return response;
};

const api4 = client(
  http('http://localhost:3001'),
  interceptRequest(updateDashboardRequest),
  interceptResponse(updateDashboardResponse),
);

// Simulate some traffic
await api4.get('/get', parse.json());
await api4.post('/post', parse.json());
await api4.get('/status/500', parse.raw());
await api4.get('/delay/1', parse.json());

console.log('Real-time Dashboard:');
console.log('  Requests:');
console.log(`    Total: ${dashboard.requests.total}`);
console.log(`    Per second (avg last min): ${dashboard.requests.perSecond.toFixed(2)}`);
console.log('  Latency:');
console.log(`    P50: ${dashboard.latency.p50}ms`);
console.log(`    P95: ${dashboard.latency.p95}ms`);
console.log(`    P99: ${dashboard.latency.p99}ms`);
console.log('  Errors:');
console.log(`    Total: ${dashboard.errors.total}`);
console.log(`    Rate: ${(dashboard.errors.rate * 100).toFixed(2)}%`);
console.log('');

console.log('✨ Metrics interceptors examples completed!');
console.log('\n💡 Metrics use cases:');
console.log('1. Performance monitoring');
console.log('2. SLA tracking');
console.log('3. Capacity planning');
console.log('4. Error rate alerting');
console.log('5. API usage analytics');
