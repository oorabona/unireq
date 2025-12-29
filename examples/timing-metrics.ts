/**
 * Performance Timing Example
 *
 * Demonstrates detailed timing information for HTTP requests
 * useful for monitoring, debugging, and performance optimization.
 *
 * Run: pnpm tsx examples/timing-metrics.ts
 */

import { client } from '@unireq/core';
import { http, parse, type TimedResponse, type TimingInfo, timing } from '@unireq/http';

// Format milliseconds
function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

// Simple metrics collector
const metrics: Array<{ url: string; method: string; timing: TimingInfo }> = [];

async function main() {
  console.log('=== Performance Timing Example ===\n');

  // Create client with timing
  const api = client(
    http('https://jsonplaceholder.typicode.com'),
    timing({
      onTiming: (timingInfo, ctx) => {
        metrics.push({
          url: new URL(ctx.url).pathname,
          method: ctx.method,
          timing: timingInfo,
        });
      },
    }),
    parse.json(),
  );

  // Example 1: Basic timing
  console.log('--- Example 1: Basic Timing ---');

  const response = (await api.get('/posts/1')) as TimedResponse;

  console.log('Request timing breakdown:');
  console.log(`  Time to First Byte (TTFB): ${formatMs(response.timing.ttfb)}`);
  console.log(`  Content Download:          ${formatMs(response.timing.download)}`);
  console.log(`  Total Time:                ${formatMs(response.timing.total)}`);
  console.log(`  Start Time:                ${new Date(response.timing.startTime).toISOString()}`);
  console.log(`  End Time:                  ${new Date(response.timing.endTime).toISOString()}`);

  // Example 2: Multiple requests for comparison
  console.log('\n--- Example 2: Multiple Requests Comparison ---');

  const urls = ['/posts/1', '/posts/2', '/users/1', '/comments/1', '/todos/1'];

  console.log('Making 5 requests to different endpoints...\n');

  for (const url of urls) {
    await api.get(url);
  }

  console.log('Request timing comparison:');
  console.log('-'.repeat(60));
  console.log(`${'Endpoint'.padEnd(20)} | ${'TTFB'.padEnd(12)} | ${'Download'.padEnd(12)} | Total`);
  console.log('-'.repeat(60));

  for (const metric of metrics.slice(-5)) {
    console.log(
      `${metric.url.padEnd(20)} | ` +
        `${formatMs(metric.timing.ttfb).padEnd(12)} | ` +
        `${formatMs(metric.timing.download).padEnd(12)} | ` +
        formatMs(metric.timing.total),
    );
  }

  // Example 3: Timing in response headers
  console.log('\n--- Example 3: Timing in Headers ---');

  const apiWithHeaders = client(
    http('https://jsonplaceholder.typicode.com'),
    timing({
      includeInHeaders: true,
      headerName: 'x-request-timing',
    }),
    parse.json(),
  );

  const headerResponse = (await apiWithHeaders.get('/posts/1')) as TimedResponse;
  console.log('Timing added to response headers:');
  console.log(`  Header: x-request-timing`);
  console.log(`  Value: ${headerResponse.headers['x-request-timing']}`);

  // Example 4: Metrics aggregation
  console.log('\n--- Example 4: Metrics Aggregation ---');

  // Make more requests for better statistics
  for (let i = 0; i < 5; i++) {
    await api.get(`/posts/${i + 1}`);
  }

  const timings = metrics.map((m) => m.timing.total);
  const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
  const minTime = Math.min(...timings);
  const maxTime = Math.max(...timings);
  const sorted = timings.sort((a, b) => a - b);
  const p50 = sorted[Math.floor(timings.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(timings.length * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(timings.length * 0.99)] ?? 0;

  console.log('Aggregated metrics:');
  console.log(`  Total requests:  ${metrics.length}`);
  console.log(`  Average time:    ${formatMs(avgTime)}`);
  console.log(`  Min time:        ${formatMs(minTime)}`);
  console.log(`  Max time:        ${formatMs(maxTime)}`);
  console.log(`  P50 (median):    ${formatMs(p50)}`);
  console.log(`  P95:             ${formatMs(p95)}`);
  console.log(`  P99:             ${formatMs(p99)}`);

  // Example 5: Integration with monitoring
  console.log('\n--- Example 5: Monitoring Integration ---');
  console.log(`
// Integration with OpenTelemetry metrics:
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('http-client');
const requestDuration = meter.createHistogram('http_request_duration_ms');

const api = client(
  http('https://api.example.com'),
  timing({
    onTiming: (timing, ctx) => {
      requestDuration.record(timing.total, {
        'http.method': ctx.method,
        'http.url': new URL(ctx.url).pathname,
      });
    },
  }),
  parse.json()
);

// Integration with custom logging:
const api = client(
  http('https://api.example.com'),
  timing({
    onTiming: (timing, ctx) => {
      logger.info('HTTP request completed', {
        url: ctx.url,
        method: ctx.method,
        ttfb: timing.ttfb,
        download: timing.download,
        total: timing.total,
        timestamp: new Date(timing.startTime).toISOString(),
      });
    },
  }),
  parse.json()
);

// Integration with StatsD/DataDog:
const api = client(
  http('https://api.example.com'),
  timing({
    onTiming: (timing, ctx) => {
      statsd.histogram('http.request.duration', timing.total, {
        endpoint: new URL(ctx.url).pathname,
        method: ctx.method,
      });
      statsd.histogram('http.request.ttfb', timing.ttfb);
    },
  }),
  parse.json()
);
`);

  console.log('\n=== Timing Example Complete ===');
}

main().catch(console.error);
