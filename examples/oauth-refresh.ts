/**
 * OAuth with automatic token refresh example
 * Usage: pnpm example:oauth
 */

import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

// Simulated token supplier (in real app, this would call your auth server)
let tokenVersion = 1;

const tokenSupplier = async () => {
  console.log(`🔐 Fetching new token (version ${tokenVersion})...`);

  // Simulate token refresh API call
  await new Promise((resolve) => setTimeout(resolve, 100));

  const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(
    JSON.stringify({ exp: Math.floor((Date.now() + 3600000) / 1000), v: tokenVersion++ }),
  )}.signature`;

  console.log(`✅ Token refreshed! New version: ${tokenVersion - 1}`);

  return token;
};

// Create client with OAuth
// In real usage, provide JWKS or public key for secure verification
const api = client(
  http('https://jsonplaceholder.typicode.com'),
  oauthBearer({ tokenSupplier, allowUnsafeMode: true }),
  parse.json(),
);

// Make authenticated requests
console.log('\n📡 Making authenticated request...');
const response = await api.get<{ id: number; title: string }>('/posts/1');
console.log(`Response: ${response.data.title}`);

console.log('\n📡 Making another request (should reuse token)...');
const response2 = await api.get<{ id: number }>('/posts/2');
console.log(`Response: Post #${response2.data.id}`);

console.log('\n✨ OAuth example completed!');
