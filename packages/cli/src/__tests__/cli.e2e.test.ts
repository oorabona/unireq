/**
 * E2E tests for CLI binary
 * Following GWT (Given/When/Then) pattern for E2E tests
 *
 * These tests spawn the actual CLI binary as a subprocess
 * and verify the complete user experience from command to output.
 *
 * Note: Uses a real HTTP test server (not MSW) because MSW
 * cannot intercept requests from child processes.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { type ExecaError, execa, type Result } from 'execa';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// CLI binary path (relative to this test file)
const CLI_PATH = path.join(import.meta.dirname, '../../dist/cli.js');

// Test server configuration
const TEST_PORT = 19876; // High port to avoid conflicts
const TEST_URL = `http://127.0.0.1:${TEST_PORT}`;

// Type for CLI result
interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Helper to ensure value is a string
 */
function ensureString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * Run the CLI with given arguments
 * @param args CLI arguments
 * @returns Promise with stdout, stderr, and exit code
 */
async function runCli(args: string[]): Promise<CliResult> {
  try {
    const result: Result = await execa('node', [CLI_PATH, ...args], {
      reject: false, // Don't throw on non-zero exit
      timeout: 10000, // 10 second timeout
      env: {
        ...process.env,
        FORCE_COLOR: '0', // Disable colors for consistent output
      },
    });
    // Debug: Log all output
    if (process.env['DEBUG_E2E']) {
      console.log(`[DEBUG] CLI_PATH: ${CLI_PATH}`);
      console.log(`[DEBUG] args: ${JSON.stringify(args)}`);
      console.log(`[DEBUG] stdout: ${result.stdout}`);
      console.log(`[DEBUG] stderr: ${result.stderr}`);
      console.log(`[DEBUG] exitCode: ${result.exitCode}`);
    }
    return {
      stdout: ensureString(result.stdout),
      stderr: ensureString(result.stderr),
      exitCode: result.exitCode ?? 0,
    };
  } catch (error) {
    const execaError = error as ExecaError;
    if (process.env['DEBUG_E2E']) {
      console.log(`[DEBUG] Error: ${execaError.message}`);
    }
    return {
      stdout: ensureString(execaError.stdout),
      stderr: ensureString(execaError.stderr),
      exitCode: execaError.exitCode ?? 1,
    };
  }
}

// Test HTTP server
let server: Server;

// Request handler for test server
function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', `http://localhost:${TEST_PORT}`);
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  // Collect body
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });

  req.on('end', () => {
    // Set JSON content type by default
    res.setHeader('Content-Type', 'application/json');

    // Route handling
    if (pathname === '/users' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ users: [{ id: 1, name: 'Alice' }] }));
      return;
    }

    if (pathname === '/users' && method === 'POST') {
      res.writeHead(201);
      const parsedBody = body ? JSON.parse(body) : {};
      res.end(JSON.stringify({ created: parsedBody }));
      return;
    }

    if (pathname === '/users/123' && method === 'PUT') {
      res.writeHead(200);
      const parsedBody = body ? JSON.parse(body) : {};
      res.end(JSON.stringify({ updated: { id: 123, ...parsedBody } }));
      return;
    }

    if (pathname === '/users/123' && method === 'PATCH') {
      res.writeHead(200);
      const parsedBody = body ? JSON.parse(body) : {};
      res.end(JSON.stringify({ patched: { id: 123, ...parsedBody } }));
      return;
    }

    if (pathname === '/users/123' && method === 'DELETE') {
      res.writeHead(200);
      res.end(JSON.stringify({ deleted: 123 }));
      return;
    }

    if (pathname === '/health' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'healthy' }));
      return;
    }

    if (pathname === '/echo-query' && method === 'GET') {
      const params = Object.fromEntries(url.searchParams);
      res.writeHead(200);
      res.end(JSON.stringify({ query: params }));
      return;
    }

    if (pathname === '/echo-headers' && method === 'GET') {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      }
      res.writeHead(200);
      res.end(JSON.stringify({ headers }));
      return;
    }

    if (pathname === '/not-found') {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    if (pathname === '/server-error') {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
      return;
    }

    // Default: 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found', path: pathname, method }));
  });
}

describe('CLI E2E', () => {
  beforeAll(async () => {
    // Start test HTTP server
    server = createServer(handleRequest);
    await new Promise<void>((resolve, reject) => {
      server.on('error', (err) => {
        reject(err);
      });
      server.listen(TEST_PORT, '127.0.0.1', () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Stop test HTTP server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('Given CLI is built and test server is running', () => {
    describe('When GET request is executed', () => {
      it('Then response is displayed and exit code is 0', async () => {
        // Act
        const result = await runCli(['get', `${TEST_URL}/users`]);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('200');
        expect(result.stdout).toContain('Alice');
      });
    });

    describe('When POST request with body is executed', () => {
      it('Then request body is sent and response received', async () => {
        // Act - use -b for body (CLI uses -b, not -d like curl)
        const result = await runCli(['post', `${TEST_URL}/users`, '-b', '{"name":"Bob"}']);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('201');
        expect(result.stdout).toContain('Bob');
      });
    });

    describe('When request subcommand is used', () => {
      it('Then request is executed correctly', async () => {
        // Act
        const result = await runCli(['request', 'GET', `${TEST_URL}/health`]);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('200');
        expect(result.stdout).toContain('healthy');
      });
    });

    describe('When PUT request is executed', () => {
      it('Then update response is received', async () => {
        // Act - use -b for body
        const result = await runCli(['put', `${TEST_URL}/users/123`, '-b', '{"name":"Updated"}']);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('200');
        expect(result.stdout).toContain('Updated');
      });
    });

    describe('When PATCH request is executed', () => {
      it('Then patch response is received', async () => {
        // Act - use -b for body
        const result = await runCli(['patch', `${TEST_URL}/users/123`, '-b', '{"status":"active"}']);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('200');
        expect(result.stdout).toContain('active');
      });
    });

    describe('When DELETE request is executed', () => {
      it('Then delete response is received', async () => {
        // Act
        const result = await runCli(['delete', `${TEST_URL}/users/123`]);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('200');
        expect(result.stdout).toContain('123');
      });
    });
  });

  describe('Given CLI is built and test server returns errors', () => {
    describe('When 404 response is returned', () => {
      it('Then error status is displayed and exit code is 0', async () => {
        // Act
        const result = await runCli(['get', `${TEST_URL}/not-found`]);

        // Assert
        // Exit code 0 because server responded (not a CLI error)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('404');
      });
    });

    describe('When 500 response is returned', () => {
      it('Then error status is displayed', async () => {
        // Act
        const result = await runCli(['get', `${TEST_URL}/server-error`]);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('500');
      });
    });
  });

  describe('Given CLI is built with custom options', () => {
    describe('When custom header is provided', () => {
      it('Then header is sent to server', async () => {
        // Act
        const result = await runCli(['get', `${TEST_URL}/echo-headers`, '-H', 'X-Custom-Header:test-value']);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('x-custom-header');
      });
    });

    describe('When query parameter is provided', () => {
      it('Then query param is sent to server', async () => {
        // Act
        const result = await runCli(['get', `${TEST_URL}/echo-query`, '-q', 'foo=bar']);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('foo');
        expect(result.stdout).toContain('bar');
      });
    });

    describe('When trace mode is enabled', () => {
      it('Then timing information is displayed', async () => {
        // Act - --trace flag comes after subcommand
        const result = await runCli(['get', `${TEST_URL}/users`, '--trace']);

        // Assert
        expect(result.exitCode).toBe(0);
        // Trace output should contain timing info (e.g., "Total: 50ms")
        expect(result.stdout).toMatch(/\d+(\.\d+)?\s*(ms|s)/i);
      });
    });

    describe('When JSON output mode is used', () => {
      it('Then output is valid JSON', async () => {
        // Act - -o flag comes after subcommand
        const result = await runCli(['get', `${TEST_URL}/users`, '-o', 'json']);

        // Assert
        expect(result.exitCode).toBe(0);
        // Should be parseable JSON (strip consola [log] prefix if present)
        const output = result.stdout.replace(/^\[log\]\s*/, '').trim();
        expect(() => JSON.parse(output)).not.toThrow();
      });
    });
  });

  describe('Given network errors occur', () => {
    describe('When server is unreachable', () => {
      it('Then error message is displayed and exit code is non-zero', async () => {
        // Act - use a port that is definitely not listening
        const result = await runCli(['get', 'http://localhost:59999/fail']);

        // Assert
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toBeTruthy();
      });
    });
  });

  describe('Given invalid CLI arguments', () => {
    describe('When no URL is provided', () => {
      it('Then usage help is shown', async () => {
        // Act
        const result = await runCli(['get']);

        // Assert
        // Should show help/error about missing URL
        const output = result.stdout + result.stderr;
        expect(output).toBeTruthy();
      });
    });

    describe('When --version is requested', () => {
      it('Then version is displayed', async () => {
        // Act
        const result = await runCli(['--version']);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
      });
    });

    describe('When --help is requested', () => {
      it('Then help is displayed', async () => {
        // Act
        const result = await runCli(['--help']);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('unireq');
      });
    });
  });
});
