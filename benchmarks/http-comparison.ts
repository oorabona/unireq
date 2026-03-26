/**
 * @unireq HTTP Benchmark — compares @unireq/http against axios, got, ky, undici, native fetch
 *
 * Run: pnpm bench
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';

// ---------------------------------------------------------------------------
// Local test server
// ---------------------------------------------------------------------------

const RESPONSE_BODY = JSON.stringify({ ok: true, ts: 0 }); // ts filled per-request

function startServer(port: number): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(body || RESPONSE_BODY);
        });
      } else {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ts: Date.now() }));
      }
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
}

async function measure(fn: () => Promise<void>, iterations: number): Promise<number> {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  return performance.now() - t0;
}

async function measureConcurrent(fn: () => Promise<void>, count: number): Promise<number> {
  const t0 = performance.now();
  await Promise.all(Array.from({ length: count }, () => fn()));
  return performance.now() - t0;
}

// ---------------------------------------------------------------------------
// Library imports
// ---------------------------------------------------------------------------

import { client, retry, throttle } from '@unireq/core';
import { http, timeout } from '@unireq/http';
import { preset } from '@unireq/presets';
import axios from 'axios';
import got from 'got';
import ky from 'ky';
import { request as undiciRequest } from 'undici';

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

const SEQUENTIAL = 1000;
const CONCURRENT = 100;
const WARMUP = 3;
const PORT = 19283;

type BenchFn = (url: string) => Promise<void>;

async function runBench(
  name: string,
  fn: BenchFn,
  url: string,
  mode: 'sequential' | 'concurrent',
  count: number,
): Promise<BenchResult> {
  try {
    // Warmup
    for (let i = 0; i < WARMUP; i++) {
      await fn(url);
    }

    const ms =
      mode === 'sequential' ? await measure(() => fn(url), count) : await measureConcurrent(() => fn(url), count);

    return {
      name,
      ms: Math.round(ms),
      reqPerSec: Math.round((count / ms) * 1000),
      relativeToBaseline: null,
      failed: false,
    };
  } catch (err) {
    console.error(`  [FAILED] ${name}:`, (err as Error).message);
    return { name, ms: 0, reqPerSec: 0, relativeToBaseline: null, failed: true };
  }
}

function attachRelative(results: BenchResult[]): BenchResult[] {
  const baseline = results.find((r) => !r.failed && r.name === 'native fetch');
  if (!baseline) return results;
  return results.map((r) => ({
    ...r,
    relativeToBaseline: r.failed ? null : (r.ms - baseline.ms) / baseline.ms,
  }));
}

// ---------------------------------------------------------------------------
// Individual library GET helpers
// ---------------------------------------------------------------------------

async function nativeFetchGet(url: string): Promise<void> {
  const res = await fetch(url);
  await res.json();
}

async function undiciGet(url: string): Promise<void> {
  const { body } = await undiciRequest(url, { method: 'GET' });
  await body.json();
}

async function axiosGet(url: string): Promise<void> {
  await axios.get(url);
}

async function gotGet(url: string): Promise<void> {
  await got.get(url).json();
}

async function kyGet(url: string): Promise<void> {
  await ky.get(url).json();
}

// unireq/http — create client once outside the bench fn (per benchmark)
function makeUnireqGetFn(baseUrl: string): BenchFn {
  const api = client(http(baseUrl));
  return async (_url: string) => {
    await api.get('/');
  };
}

function makeUnireqPresetGetFn(baseUrl: string): BenchFn {
  const api = preset.api.build(baseUrl);
  return async (_url: string) => {
    await api.get('/');
  };
}

// ---------------------------------------------------------------------------
// Individual library POST helpers
// ---------------------------------------------------------------------------

const POST_PAYLOAD = { name: 'test', value: 42 };

async function nativeFetchPost(url: string): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(POST_PAYLOAD),
  });
  await res.json();
}

async function undiciPost(url: string): Promise<void> {
  const { body } = await undiciRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(POST_PAYLOAD),
  });
  await body.json();
}

async function axiosPost(url: string): Promise<void> {
  await axios.post(url, POST_PAYLOAD);
}

async function gotPost(url: string): Promise<void> {
  await got.post(url, { json: POST_PAYLOAD }).json();
}

async function kyPost(url: string): Promise<void> {
  await ky.post(url, { json: POST_PAYLOAD }).json();
}

function makeUnireqPostFn(baseUrl: string): BenchFn {
  const api = client(http(baseUrl));
  return async (_url: string) => {
    await api.post('/', { body: POST_PAYLOAD });
  };
}

function makeUnireqPresetPostFn(baseUrl: string): BenchFn {
  const api = preset.api.build(baseUrl);
  return async (_url: string) => {
    await api.post('/', { body: POST_PAYLOAD });
  };
}

// ---------------------------------------------------------------------------
// Policy overhead benchmark (@unireq only)
// ---------------------------------------------------------------------------

async function policyOverheadBench(baseUrl: string): Promise<{ bare: number; withPolicies: number }> {
  // Bare (no policies)
  const bareApi = client(http(baseUrl));

  for (let i = 0; i < WARMUP; i++) {
    await bareApi.get('/');
  }
  const bareMs = Math.round(
    await measure(async () => {
      await bareApi.get('/');
    }, SEQUENTIAL),
  );

  // With retry(3) + timeout(5000) + throttle(100/s)
  const enrichedApi = client(
    http(baseUrl),
    retry((_ctx, _err) => false, [], { tries: 3 }),
    timeout(5000),
    throttle({ limit: 1000, interval: 1000 }),
  );

  for (let i = 0; i < WARMUP; i++) {
    await enrichedApi.get('/');
  }
  const withMs = Math.round(
    await measure(async () => {
      await enrichedApi.get('/');
    }, SEQUENTIAL),
  );

  return { bare: bareMs, withPolicies: withMs };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

// Column widths: name(22) + time(8) + rps(12) + rel(16) + separators(9) + margins(2) = 69 → BOX_W 71
const COL_W = [22, 8, 12, 16] as const;
// Total inner = 22+8+12+16 = 58, separators: 3×3=9, margin: 2 = 69
const BOX_W = 71;

function pad(s: string, w: number): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping
  const clean = s.replace(/\x1b\[[0-9;]*m/g, '');
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
  if (r.failed) return 'FAILED    ';
  if (r.relativeToBaseline === null || r.relativeToBaseline === 0) return 'baseline  ';
  const pct = (r.relativeToBaseline * 100).toFixed(1);
  return r.relativeToBaseline > 0 ? `+${pct}% slower` : `${pct}% faster`;
}

function printSection(title: string, results: BenchResult[]): void {
  console.log(divider());
  console.log(header(title));
  for (const r of results) {
    const cols = [`  ${r.name}`, r.failed ? 'FAILED' : `${r.ms}ms`, r.failed ? '' : `${r.reqPerSec} req/s`, relStr(r)];
    console.log(row(cols, COL_W));
  }
}

// ---------------------------------------------------------------------------
// Markdown table
// ---------------------------------------------------------------------------

function printMarkdown(
  simpleGET: BenchResult[],
  concurrentGET: BenchResult[],
  postJSON: BenchResult[],
  policyOverhead: { bare: number; withPolicies: number },
): void {
  console.log('\n\n## HTTP Benchmark Results\n');
  console.log('### Simple GET (1000 sequential)\n');
  console.log('| Library | Time (ms) | req/s | vs baseline |');
  console.log('|---------|-----------|-------|-------------|');
  for (const r of simpleGET) {
    console.log(`| ${r.name} | ${r.failed ? 'FAILED' : r.ms} | ${r.failed ? '-' : r.reqPerSec} | ${relStr(r)} |`);
  }

  console.log('\n### Concurrent GET (100 parallel)\n');
  console.log('| Library | Time (ms) | req/s | vs baseline |');
  console.log('|---------|-----------|-------|-------------|');
  for (const r of concurrentGET) {
    console.log(`| ${r.name} | ${r.failed ? 'FAILED' : r.ms} | ${r.failed ? '-' : r.reqPerSec} | ${relStr(r)} |`);
  }

  console.log('\n### POST JSON (1000 sequential)\n');
  console.log('| Library | Time (ms) | req/s | vs baseline |');
  console.log('|---------|-----------|-------|-------------|');
  for (const r of postJSON) {
    console.log(`| ${r.name} | ${r.failed ? 'FAILED' : r.ms} | ${r.failed ? '-' : r.reqPerSec} | ${relStr(r)} |`);
  }

  const overhead = (((policyOverhead.withPolicies - policyOverhead.bare) / policyOverhead.bare) * 100).toFixed(1);
  console.log('\n### Policy Overhead (@unireq only)\n');
  console.log('| Configuration | Time (ms) | overhead |');
  console.log('|---------------|-----------|----------|');
  console.log(`| bare (no policies) | ${policyOverhead.bare} | baseline |`);
  console.log(`| retry(3) + timeout(5000) + throttle(1000/s) | ${policyOverhead.withPolicies} | +${overhead}% |`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const server = await startServer(PORT);
  const baseUrl = `http://127.0.0.1:${PORT}`;

  console.log(top());
  console.log(header(`@unireq HTTP Benchmark — Node ${process.version}`));

  // Build per-run clients (created once, reused across iterations)
  const unireqGetFn = makeUnireqGetFn(baseUrl);
  const unireqPresetGetFn = makeUnireqPresetGetFn(baseUrl);
  const unireqPostFn = makeUnireqPostFn(baseUrl);
  const unireqPresetPostFn = makeUnireqPresetPostFn(baseUrl);

  // ── Simple GET ───────────────────────────────────────────────────────────
  const simpleGET = attachRelative([
    await runBench('native fetch', nativeFetchGet, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('undici.request', undiciGet, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('@unireq/http', unireqGetFn, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('@unireq/presets', unireqPresetGetFn, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('axios', axiosGet, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('got', gotGet, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('ky', kyGet, baseUrl, 'sequential', SEQUENTIAL),
  ]);
  printSection(`Simple GET (${SEQUENTIAL} sequential)`, simpleGET);

  // ── Concurrent GET ───────────────────────────────────────────────────────
  const concurrentGET = attachRelative([
    await runBench('native fetch', nativeFetchGet, baseUrl, 'concurrent', CONCURRENT),
    await runBench('undici.request', undiciGet, baseUrl, 'concurrent', CONCURRENT),
    await runBench('@unireq/http', unireqGetFn, baseUrl, 'concurrent', CONCURRENT),
    await runBench('@unireq/presets', unireqPresetGetFn, baseUrl, 'concurrent', CONCURRENT),
    await runBench('axios', axiosGet, baseUrl, 'concurrent', CONCURRENT),
    await runBench('got', gotGet, baseUrl, 'concurrent', CONCURRENT),
    await runBench('ky', kyGet, baseUrl, 'concurrent', CONCURRENT),
  ]);
  printSection(`Concurrent GET (${CONCURRENT} parallel)`, concurrentGET);

  // ── POST JSON ────────────────────────────────────────────────────────────
  const postJSON = attachRelative([
    await runBench('native fetch', nativeFetchPost, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('undici.request', undiciPost, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('@unireq/http', unireqPostFn, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('@unireq/presets', unireqPresetPostFn, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('axios', axiosPost, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('got', gotPost, baseUrl, 'sequential', SEQUENTIAL),
    await runBench('ky', kyPost, baseUrl, 'sequential', SEQUENTIAL),
  ]);
  printSection(`POST JSON (${SEQUENTIAL} sequential)`, postJSON);

  // ── Policy Overhead ──────────────────────────────────────────────────────
  const policy = await policyOverheadBench(baseUrl);
  const overheadPct = (((policy.withPolicies - policy.bare) / policy.bare) * 100).toFixed(1);

  console.log(divider());
  console.log(header(`Policy Overhead (@unireq only, ${SEQUENTIAL} sequential)`));
  console.log(row(['  bare (no policies)', `${policy.bare}ms`, '', 'baseline'], COL_W));
  console.log(row(['  retry+timeout+throttle', `${policy.withPolicies}ms`, '', `+${overheadPct}% overhead`], COL_W));
  console.log(bottom());

  // Markdown output
  printMarkdown(simpleGET, concurrentGET, postJSON, policy);

  await stopServer(server);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
