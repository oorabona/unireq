/**
 * Proxy Usage Example
 *
 * Demonstrates configuring HTTP proxy for corporate networks
 * and environments with restricted internet access.
 *
 * Run: pnpm tsx examples/proxy-usage.ts
 */

import { client } from '@unireq/core';
import { http, parse, proxy } from '@unireq/http';

async function main() {
  console.log('=== Proxy Usage Example ===\n');

  // Example 1: Simple proxy URL
  console.log('--- Example 1: Simple Proxy URL ---');
  // Create client with simple proxy URL (unused in demo, showing configuration)
  void client(http('https://api.example.com'), proxy('http://proxy.corp.com:8080'), parse.json());
  console.log('Created client with proxy: http://proxy.corp.com:8080');

  // Example 2: Proxy with authentication
  console.log('\n--- Example 2: Proxy with Authentication ---');
  // Create client with authenticated proxy (unused in demo, showing configuration)
  void client(
    http('https://api.example.com'),
    proxy({
      url: 'http://proxy.corp.com:8080',
      auth: {
        username: 'proxy-user',
        password: 'proxy-pass',
      },
    }),
    parse.json(),
  );
  console.log('Created client with authenticated proxy');

  // Example 3: Proxy with bypass list (NO_PROXY)
  console.log('\n--- Example 3: Proxy with Bypass List ---');
  // Create client with bypass list (unused in demo, showing configuration)
  void client(
    http('https://api.example.com'),
    proxy({
      url: 'http://proxy.corp.com:8080',
      noProxy: [
        'localhost',
        '127.0.0.1',
        '*.internal.corp.com',
        '10.*', // All 10.x.x.x IPs
        '.local', // All .local domains
      ],
    }),
    parse.json(),
  );
  console.log('Created client with bypass list:');
  console.log('  - localhost, 127.0.0.1');
  console.log('  - *.internal.corp.com');
  console.log('  - 10.* (all internal IPs)');
  console.log('  - .local domains');

  // Example 4: Environment-based proxy (HTTP_PROXY, HTTPS_PROXY, NO_PROXY)
  console.log('\n--- Example 4: Environment-based Proxy ---');
  console.log('Using environment variables:');
  console.log(`  HTTP_PROXY=${process.env['HTTP_PROXY'] || '(not set)'}`);
  console.log(`  HTTPS_PROXY=${process.env['HTTPS_PROXY'] || '(not set)'}`);
  console.log(`  NO_PROXY=${process.env['NO_PROXY'] || '(not set)'}`);

  // Create client using environment proxy settings (unused in demo, showing configuration)
  void client(
    http('https://api.example.com'),
    proxy.fromEnv(), // Automatically reads from environment
    parse.json(),
  );
  console.log('Created client using environment proxy settings');

  // Example 5: Proxy URL with embedded credentials
  console.log('\n--- Example 5: Proxy URL with Credentials ---');
  // Create client with credentials in URL (unused in demo, showing configuration)
  void client(http('https://api.example.com'), proxy('http://user:password@proxy.corp.com:8080'), parse.json());
  console.log('Created client with credentials in URL (not recommended for production)');

  // Real-world usage pattern
  console.log('\n--- Real-world Pattern ---');
  console.log(`
// Recommended production pattern:
const api = client(
  http(config.apiBaseUrl),
  process.env.HTTP_PROXY
    ? proxy.fromEnv()
    : identity, // No-op if no proxy
  retry(...),
  parse.json()
);

// Or with explicit configuration:
const api = client(
  http(config.apiBaseUrl),
  proxy({
    url: config.proxyUrl,
    auth: config.proxyAuth,
    noProxy: config.noProxyHosts,
  }),
  parse.json()
);
`);

  console.log('\n=== Proxy Example Complete ===');
}

main().catch(console.error);
