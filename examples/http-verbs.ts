/**
 * HTTP verbs walkthrough
 * Usage: pnpm example:http-verbs
 */

import { client } from '@unireq/core';
import { body, headers, http, parse } from '@unireq/http';

type HttpBinEcho<T = unknown> = {
  args: Record<string, string>;
  headers: Record<string, string>;
  json: T;
  method: string;
  url: string;
};

const api = client(http('https://httpbin.org'), headers({ 'user-agent': 'unireq-http-verbs/1.0' }));

async function demoHeadBeforeGet() {
  console.log('\n=== HEAD + GET /bytes/1024 ===');
  const headResponse = await api.head('/bytes/1024', parse.raw());
  const expectedLength = Number(headResponse.headers['content-length'] ?? 0);
  console.log('HEAD Content-Length:', expectedLength);

  const download = await api.get<ArrayBuffer>('/bytes/1024', parse.binary());
  console.log('GET downloaded bytes:', download.data.byteLength);
}

async function demoGet() {
  console.log('\n=== GET /get ===');
  const response = await api.get<HttpBinEcho>('/get', headers({ 'x-trace-id': crypto.randomUUID() }), parse.json());
  console.log('Status:', response.status);
  console.log('Args:', response.data.args);
}

async function demoPost() {
  console.log('\n=== POST /anything ===');
  const payload = { email: 'jane@example.com', name: 'Jane' };
  const response = await api.post<HttpBinEcho<typeof payload>>(
    '/anything',
    body.json(payload),
    headers({ 'x-idempotency-key': crypto.randomUUID() }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('Echoed JSON:', response.data.json);
}

async function demoPut() {
  console.log('\n=== PUT /anything/profile ===');
  const response = await api.put<HttpBinEcho<{ id: number; role: string }>>(
    '/anything/profile',
    body.json({ id: 42, role: 'admin' }),
    headers({ 'if-match': 'W/"profile-v1"' }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('Headers sent:', response.data.headers);
}

async function demoPatch() {
  console.log('\n=== PATCH /anything/profile ===');
  const response = await api.patch<HttpBinEcho<{ role: string }>>(
    '/anything/profile',
    body.json({ role: 'editor' }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('JSON delta:', response.data.json);
}

async function demoDelete() {
  console.log('\n=== DELETE /anything/session ===');
  const response = await api.delete<HttpBinEcho>(
    '/anything/session',
    headers({ 'x-confirm-delete': 'true' }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('Was JSON returned?', Boolean(response.data.json));
}

async function demoOptions() {
  console.log('\n=== OPTIONS /anything ===');
  const response = await api.options('/anything', headers({ Origin: 'https://docs.unireq.dev' }), parse.raw());
  console.log('Status:', response.status);
  console.log('Allow header:', response.headers['allow']);
  console.log('CORS methods:', response.headers['access-control-allow-methods']);
}

async function main() {
  await demoHeadBeforeGet();
  await demoGet();
  await demoPost();
  await demoPut();
  await demoPatch();
  await demoDelete();
  await demoOptions();
}

main().catch((error) => {
  console.error('❌ HTTP verbs demo failed:', error);
  process.exitCode = 1;
});
