/**
 * @unireq Scenario Benchmarks — realistic scenarios showing where unireq shines
 *
 * Run: pnpm bench:scenarios
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';

// ---------------------------------------------------------------------------
// Local test server (self-contained, no shared state with http-comparison.ts)
// ---------------------------------------------------------------------------

/** Per-batch flaky counter: key = X-Batch-Id header */
const flakyCounters = new Map<string, number>();

/** Static large payload (~100KB): array of 1000 objects */
const LARGE_PAYLOAD = JSON.stringify(
  Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `item-${i}`,
    value: i * 0.001,
    active: i % 2 === 0,
    tags: [`tag-${i % 10}`, `category-${i % 5}`],
    metadata: { created: 1700000000000, index: i },
  })),
);

/** Stable ETag for the /etag endpoint */
const ETAG_VALUE = '"bench-etag-v1"';

function startServer(port: number): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? '/';

      // GET /data — minimal JSON
      if (req.method === 'GET' && url === '/data') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ts: Date.now() }));
        return;
      }

      // GET /large — ~100KB JSON payload
      if (req.method === 'GET' && url === '/large') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(LARGE_PAYLOAD);
        return;
      }

      // GET /etag — ETag-based conditional response
      if (req.method === 'GET' && url === '/etag') {
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch === ETAG_VALUE) {
          res.writeHead(304, { etag: ETAG_VALUE });
          res.end();
          return;
        }
        res.writeHead(200, {
          'content-type': 'application/json',
          etag: ETAG_VALUE,
        });
        res.end(JSON.stringify({ ok: true, ts: Date.now() }));
        return;
      }

      // GET /flaky — first 2 requests per batch return 503, then 200
      // Batch isolation via X-Batch-Id header.
      if (req.method === 'GET' && url === '/flaky') {
        const batchId =
          (req.headers['x-batch-id'] as string | undefined) ?? req.socket.remoteAddress ?? 'default';
        const count = (flakyCounters.get(batchId) ?? 0) + 1;
        flakyCounters.set(batchId, count);

        if (count <= 2) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'service unavailable', attempt: count }));
          return;
        }

        // Reset counter — this batch is done
        flakyCounters.delete(batchId);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ts: Date.now() }));
        return;
      }

      // POST /json — echo body
      if (req.method === 'POST' && url === '/json') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(body || '{}');
        });
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found', path: url }));
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

interface BenchResult {
  name: string;
  ms: number;
  reqPerSec: number;
  relativeToBaseline: number | null;
  failed: boolean;
  note?: string;
}

async function measure(fn: () => Promise<unknown>, iterations: number): Promise<number> {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  return Math.round(performance.now() - t0);
}

async function runScenario(
  name: string,
  fn: () => Promise<unknown>,
  iterations: number,
  note?: string,
): Promise<BenchResult> {
  try {
    // Warmup (3 iterations)
    for (let i = 0; i < 3; i++) {
      await fn();
    }

    const ms = await measure(fn, iterations);
    return {
      name,
      ms,
      reqPerSec: Math.round((iterations / ms) * 1000),
      relativeToBaseline: null,
      failed: false,
      note,
    };
  } catch (err) {
    console.error(`  [FAILED] ${name}:`, (err as Error).message);
    return { name, ms: 0, reqPerSec: 0, relativeToBaseline: null, failed: true, note };
  }
}

function attachRelative(results: BenchResult[]): BenchResult[] {
  const baseline = results.find((r) => !r.failed);
  if (!baseline) return results;
  return results.map((r) => ({
    ...r,
    relativeToBaseline: r.failed ? null : (r.ms - baseline.ms) / baseline.ms,
  }));
}

// ---------------------------------------------------------------------------
// Library imports
// ---------------------------------------------------------------------------

import { client, retry, throttle } from '@unireq/core';
import { backoff } from '@unireq/core';
import { etag, headers, http, httpRetryPredicate, parse, timeout } from '@unireq/http';
import axios from 'axios';
import got from 'got';
import ky from 'ky';
import { request as undiciRequest } from 'undici';

// ---------------------------------------------------------------------------
// Formatting helpers (same box-drawing style as http-comparison.ts)
// ---------------------------------------------------------------------------

// Column widths: name(28) + time(8) + rps(12) + rel(16) + note(24)
// Inner = 88, separators 4×3=12, margins 2 → BOX_W = 102
const COL_W = [28, 8, 12, 16, 24] as const;
const BOX_W = 96;

function pad(s: string, w: number): string {
  const clean = s.replace(/\u001B\[[0-9;]*m/g, '');
  const needed = w - clean.length;
  if (needed <= 0) return s;
  return s + ' '.repeat(needed);
}

function row(cells: string[], widths: readonly number[]): string {
  const inner = cells.map((c, i) => pad(c, widths[i] ?? 0)).join(' │ ');
  return `║ ${inner} ║`;
}

function divider(): string {
  return `╠${'═'.repeat(BOX_W - 2)}╣`;
}

function header(title: string): string {
  const padded = title.padEnd(BOX_W - 4, ' ');
  return `║ ${padded} ║`;
}

function top(): string {
  return `╔${'═'.repeat(BOX_W - 2)}╗`;
}

function bottom(): string {
  return `╚${'═'.repeat(BOX_W - 2)}╝`;
}

function relStr(r: BenchResult): string {
  if (r.failed) return 'FAILED      ';
  if (r.relativeToBaseline === null || r.relativeToBaseline === 0) return 'baseline    ';
  const pct = (r.relativeToBaseline * 100).toFixed(1);
  return r.relativeToBaseline > 0 ? `+${pct}% slower` : `${pct}% faster`;
}

function printSection(title: string, results: BenchResult[]): void {
  console.log(divider());
  console.log(header(title));
  for (const r of results) {
    const cols = [
      `  ${r.name}`,
      r.failed ? 'FAILED' : `${r.ms}ms`,
      r.failed ? '' : `${r.reqPerSec} req/s`,
      relStr(r),
      r.note ?? '',
    ];
    console.log(row(cols, COL_W));
  }
}

function printMarkdown(
  largePayload: BenchResult[],
  retryFlaky: BenchResult[],
  etagConditional: BenchResult[],
  compositionOverhead: { policies: number; ms: number }[],
): void {
  console.log('\n\n## Scenario Benchmark Results\n');

  console.log('### Scenario 1: Large Payload Parsing (100KB JSON, 100 iterations)\n');
  console.log('| Library | Time (ms) | req/s | vs baseline |');
  console.log('|---------|-----------|-------|-------------|');
  for (const r of largePayload) {
    console.log(`| ${r.name} | ${r.failed ? 'FAILED' : r.ms} | ${r.failed ? '-' : r.reqPerSec} | ${relStr(r).trim()} |`);
  }

  console.log('\n### Scenario 2: Retry with Backoff (flaky server, 100 requests × 3 tries max)\n');
  console.log('| Library | Time (ms) | req/s | vs baseline | Notes |');
  console.log('|---------|-----------|-------|-------------|-------|');
  for (const r of retryFlaky) {
    console.log(
      `| ${r.name} | ${r.failed ? 'FAILED' : r.ms} | ${r.failed ? '-' : r.reqPerSec} | ${relStr(r).trim()} | ${r.note ?? ''} |`,
    );
  }

  console.log('\n### Scenario 3: Conditional Requests / ETag (100 iterations)\n');
  console.log('| Library | Time (ms) | req/s | vs baseline | Notes |');
  console.log('|---------|-----------|-------|-------------|-------|');
  for (const r of etagConditional) {
    console.log(
      `| ${r.name} | ${r.failed ? 'FAILED' : r.ms} | ${r.failed ? '-' : r.reqPerSec} | ${relStr(r).trim()} | ${r.note ?? ''} |`,
    );
  }

  console.log('\n### Scenario 4: Composition Overhead Scaling (@unireq only, 1000 sequential)\n');
  console.log('| Policies | Time (ms) | Overhead vs bare |');
  console.log('|----------|-----------|-----------------|');
  const bare = compositionOverhead[0];
  if (bare) {
    for (const c of compositionOverhead) {
      const overheadPct = bare.ms > 0 ? ((c.ms - bare.ms) / bare.ms) * 100 : 0;
      const overheadStr = overheadPct >= 0 ? `+${overheadPct.toFixed(1)}%` : `${overheadPct.toFixed(1)}%`;
      const label = c.policies === 0 ? 'baseline' : overheadStr;
      console.log(`| ${c.policies} | ${c.ms} | ${label} |`);
    }
  }
}

// ---------------------------------------------------------------------------
// Scenario 1: Large payload parsing (100KB JSON)
// ---------------------------------------------------------------------------

async function benchLargePayload(baseUrl: string): Promise<BenchResult[]> {
  const ITERATIONS = 100;
  const url = `${baseUrl}/large`;

  const unireqApi = client(http(baseUrl), parse.json());

  const results = [
    await runScenario('native fetch', async () => {
      const res = await fetch(url);
      await res.json();
    }, ITERATIONS),
    await runScenario('undici.request', async () => {
      const { body } = await undiciRequest(url, { method: 'GET' });
      await body.json();
    }, ITERATIONS),
    await runScenario('@unireq/http', async () => {
      await unireqApi.get('/large');
    }, ITERATIONS),
    await runScenario('axios', async () => {
      await axios.get<unknown>(url);
    }, ITERATIONS),
    await runScenario('got', async () => {
      await got.get(url).json();
    }, ITERATIONS),
    await runScenario('ky', async () => {
      await ky.get(url).json();
    }, ITERATIONS),
  ];

  return attachRelative(results);
}

// ---------------------------------------------------------------------------
// Scenario 2: Retry with backoff (flaky server — 503 × 2 then 200)
// ---------------------------------------------------------------------------

/**
 * Each logical "request" in this scenario triggers the full 2×503 → 200 cycle.
 * The server uses X-Batch-Id to isolate counters between concurrent libraries.
 */
async function benchRetryFlaky(baseUrl: string): Promise<BenchResult[]> {
  const ITERATIONS = 100;
  const url = `${baseUrl}/flaky`;

  let batchSeq = 0;
  const nextBatchId = (): string => `bench-${++batchSeq}`;

  // unireq: automatic retry with 10ms initial backoff
  const unireqApi = client(
    http(baseUrl),
    retry(httpRetryPredicate({ statusCodes: [503] }), [backoff({ initial: 10, max: 100 })], { tries: 3 }),
  );

  // axios: manual retry with counter + setTimeout
  const axiosRetry = async (): Promise<void> => {
    const bid = nextBatchId();
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await axios.get<unknown>(url, {
        headers: { 'x-batch-id': bid },
        validateStatus: () => true,
      });
      if (res.status === 200) return;
      if (attempt < 2) await new Promise<void>((r) => setTimeout(r, 10 * 2 ** attempt));
    }
    throw new Error('max retries exceeded');
  };

  // got: built-in retry with attemptCount field
  const gotRetry = async (): Promise<void> => {
    const bid = nextBatchId();
    await got.get(url, {
      headers: { 'x-batch-id': bid },
      retry: {
        limit: 3,
        statusCodes: [503],
        calculateDelay: ({ attemptCount }) => 10 * 2 ** attemptCount,
      },
    });
  };

  // ky: built-in retry — delay capped at 10ms to keep benchmark fast
  const kyRetry = async (): Promise<void> => {
    const bid = nextBatchId();
    await ky.get(url, {
      headers: { 'x-batch-id': bid },
      retry: {
        limit: 3,
        statusCodes: [503],
        delay: (attemptCount: number) => 10 * 2 ** (attemptCount - 1),
      },
    });
  };

  // native fetch: manual retry loop
  const fetchRetry = async (): Promise<void> => {
    const bid = nextBatchId();
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { headers: { 'x-batch-id': bid } });
      if (res.ok) return;
      if (attempt < 2) await new Promise<void>((r) => setTimeout(r, 10 * 2 ** attempt));
    }
    throw new Error('max retries exceeded');
  };

  const results = [
    await runScenario(
      '@unireq/http',
      async () => {
        const bid = nextBatchId();
        await unireqApi.get('/flaky', headers({ 'x-batch-id': bid }));
      },
      ITERATIONS,
      'automatic retry policy',
    ),
    await runScenario('axios', axiosRetry, ITERATIONS, 'manual loop + setTimeout'),
    await runScenario('got', gotRetry, ITERATIONS, 'retry:{limit:3,statusCodes:[503]}'),
    await runScenario('ky', kyRetry, ITERATIONS, 'retry:{limit:3,statusCodes:[503]}'),
    await runScenario('native fetch', fetchRetry, ITERATIONS, 'manual loop + setTimeout'),
  ];

  return attachRelative(results);
}

// ---------------------------------------------------------------------------
// Scenario 3: Conditional requests / ETag caching
// ---------------------------------------------------------------------------

/**
 * Measures 100 iterations where the first request fetches + caches the ETag,
 * and the remaining 99 should be 304 Not Modified (no body transfer).
 * Each library is tested in a single batch of 100 sequential requests.
 */
async function benchETag(baseUrl: string): Promise<BenchResult[]> {
  const ITERATIONS = 100;
  const url = `${baseUrl}/etag`;

  // unireq: etag() policy handles If-None-Match automatically
  const makeUnireqETagBatch = async (): Promise<void> => {
    const api = client(http(baseUrl), etag());
    for (let i = 0; i < ITERATIONS; i++) {
      await api.get('/etag');
    }
  };

  // native fetch: manual If-None-Match handling
  const makeFetchETagBatch = async (): Promise<void> => {
    let cachedEtag: string | null = null;
    let cachedData: unknown = null;
    for (let i = 0; i < ITERATIONS; i++) {
      const init: RequestInit = cachedEtag ? { headers: { 'if-none-match': cachedEtag } } : {};
      const res = await fetch(url, init);
      if (res.status === 304) {
        void cachedData; // reuse cached
      } else {
        cachedEtag = res.headers.get('etag');
        cachedData = await res.json();
      }
    }
  };

  // axios: manual If-None-Match handling
  const makeAxiosETagBatch = async (): Promise<void> => {
    let cachedEtag: string | null = null;
    let cachedData: unknown = null;
    for (let i = 0; i < ITERATIONS; i++) {
      const reqHeaders: Record<string, string> = cachedEtag ? { 'if-none-match': cachedEtag } : {};
      type AxiosRes = import('axios').AxiosResponse<unknown>;
      const res: AxiosRes = await axios.get<unknown>(url, {
        headers: reqHeaders,
        validateStatus: (s: number) => s === 200 || s === 304,
      });
      if (res.status === 304) {
        void cachedData;
      } else {
        cachedEtag = (res.headers['etag'] as string | undefined) ?? null;
        cachedData = res.data;
      }
    }
  };

  // got: manual If-None-Match handling
  const makeGotETagBatch = async (): Promise<void> => {
    let cachedEtag: string | null = null;
    let cachedData: unknown = null;
    for (let i = 0; i < ITERATIONS; i++) {
      const reqHeaders: Record<string, string> = cachedEtag ? { 'if-none-match': cachedEtag } : {};
      type GotRes = import('got').Response<string>;
      const res: GotRes = await got.get(url, {
        headers: reqHeaders,
        throwHttpErrors: false,
      });
      if (res.statusCode === 304) {
        void cachedData;
      } else {
        cachedEtag = (res.headers['etag'] as string | undefined) ?? null;
        cachedData = JSON.parse(res.body) as unknown;
      }
    }
  };

  // ky: manual If-None-Match handling
  const makeKyETagBatch = async (): Promise<void> => {
    let cachedEtag: string | null = null;
    let cachedData: unknown = null;
    for (let i = 0; i < ITERATIONS; i++) {
      const reqHeaders: Record<string, string> = cachedEtag ? { 'if-none-match': cachedEtag } : {};
      const res: Response = await ky.get(url, {
        headers: reqHeaders,
        throwHttpErrors: false,
      });
      if (res.status === 304) {
        void cachedData;
      } else {
        cachedEtag = res.headers.get('etag');
        cachedData = await res.json() as unknown;
      }
    }
  };

  // Each "run" performs ITERATIONS requests internally — we pass iterations=1
  // so measure() calls the batch function once. Warmup is 3 full batches.
  const results = [
    await runScenario('@unireq/http', makeUnireqETagBatch, 1, 'automatic etag() policy'),
    await runScenario('native fetch', makeFetchETagBatch, 1, 'manual If-None-Match'),
    await runScenario('axios', makeAxiosETagBatch, 1, 'manual If-None-Match'),
    await runScenario('got', makeGotETagBatch, 1, 'manual If-None-Match'),
    await runScenario('ky', makeKyETagBatch, 1, 'manual If-None-Match'),
  ];

  // Override reqPerSec to reflect actual request count (ITERATIONS per run)
  const withActualRps = results.map((r) => ({
    ...r,
    reqPerSec: r.failed || r.ms === 0 ? 0 : Math.round((ITERATIONS / r.ms) * 1000),
  }));

  return attachRelative(withActualRps);
}

// ---------------------------------------------------------------------------
// Scenario 4: Composition overhead scaling (@unireq only)
// ---------------------------------------------------------------------------

async function benchCompositionScaling(baseUrl: string): Promise<{ policies: number; ms: number }[]> {
  const ITERATIONS = 1000;

  type ApiClient = { get: (path: string) => Promise<unknown> };

  const configs: { policies: number; make: () => ApiClient }[] = [
    {
      policies: 0,
      make: () => client(http(baseUrl)),
    },
    {
      policies: 1,
      make: () => client(http(baseUrl), parse.json()),
    },
    {
      policies: 3,
      make: () =>
        client(
          http(baseUrl),
          parse.json(),
          retry(httpRetryPredicate(), [backoff({ initial: 10 })], { tries: 3 }),
          timeout(5000),
        ),
    },
    {
      policies: 5,
      make: () =>
        client(
          http(baseUrl),
          parse.json(),
          retry(httpRetryPredicate(), [backoff({ initial: 10 })], { tries: 3 }),
          timeout(5000),
          throttle({ limit: 2000, interval: 1000 }),
          headers({ 'x-bench': 'true' }),
        ),
    },
    {
      policies: 7,
      make: () =>
        client(
          http(baseUrl),
          parse.json(),
          retry(httpRetryPredicate(), [backoff({ initial: 10 })], { tries: 3 }),
          timeout(5000),
          throttle({ limit: 2000, interval: 1000 }),
          headers({ 'x-bench': 'true' }),
          etag(),
          headers({ 'x-bench-extra': 'true' }),
        ),
    },
  ];

  const results: { policies: number; ms: number }[] = [];

  for (const config of configs) {
    const api = config.make();
    // Warmup
    for (let i = 0; i < 3; i++) {
      await api.get('/data');
    }
    const ms = await measure(() => api.get('/data'), ITERATIONS);
    results.push({ policies: config.policies, ms });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const PORT = 19284; // Different port from http-comparison.ts (19283)

async function main(): Promise<void> {
  const server = await startServer(PORT);
  const baseUrl = `http://127.0.0.1:${PORT}`;

  console.log(top());
  console.log(header(`@unireq Scenario Benchmarks — Node ${process.version}`));

  // ── Scenario 1: Large Payload ────────────────────────────────────────────
  const s1 = await benchLargePayload(baseUrl);
  printSection('Scenario 1: Large Payload (100KB JSON, 100 iters)', s1);

  // ── Scenario 2: Retry with Backoff ───────────────────────────────────────
  const s2 = await benchRetryFlaky(baseUrl);
  printSection('Scenario 2: Retry with Backoff (flaky server, 100 requests)', s2);

  // ── Scenario 3: ETag Conditional Requests ───────────────────────────────
  const s3 = await benchETag(baseUrl);
  printSection('Scenario 3: ETag Conditional (100 iters per batch)', s3);

  // ── Scenario 4: Composition Overhead Scaling ─────────────────────────────
  console.log(divider());
  console.log(header('Scenario 4: Composition Overhead Scaling (@unireq, 1000 sequential)'));
  const s4 = await benchCompositionScaling(baseUrl);
  const s4Bare = s4[0];
  if (s4Bare) {
    for (const c of s4) {
      const overheadPct = s4Bare.ms > 0 ? ((c.ms - s4Bare.ms) / s4Bare.ms) * 100 : 0;
      const overheadStr = overheadPct >= 0 ? `+${overheadPct.toFixed(1)}%` : `${overheadPct.toFixed(1)}%`;
      const label = c.policies === 0 ? 'baseline    ' : `${overheadStr} overhead`;
      const policyLabel = `  ${c.policies} ${c.policies === 1 ? 'policy ' : 'policies'}`;
      console.log(
        row(
          [policyLabel, `${c.ms}ms`, `${s4Bare.ms > 0 ? Math.round((1000 / c.ms) * 1000) : 0} req/s`, label, ''],
          COL_W,
        ),
      );
    }
  }
  console.log(bottom());

  // ── Markdown output ──────────────────────────────────────────────────────
  printMarkdown(s1, s2, s3, s4);

  await stopServer(server);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
