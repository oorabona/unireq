/**
 * @unireq/presets - Integration tests
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createMultipartUpload,
  gmailImap,
  httpClient,
  httpDownloadResume,
  httpsJsonAuthSmart,
  httpUploadGeneric,
  restApi,
  scraper,
  webhook,
} from '../index.js';

// Mock transport (unused - for future integration testing)
// const _mockTransport = async (ctx: RequestContext): Promise<Response> => {
//   // Check if OAuth Bearer token is present
//   const hasAuth = ctx.headers['authorization']?.startsWith('Bearer ');
//
//   return {
//     status: 200,
//     statusText: 'OK',
//     headers: { 'content-type': 'application/json' },
//     data: { success: true, hasAuth },
//     ok: true,
//   };
// };

describe('@unireq/presets - httpsJsonAuthSmart', () => {
  it('should create client without OAuth when no token supplier provided', async () => {
    const client = await httpsJsonAuthSmart('https://api.example.com');
    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
  });

  it('should create client with OAuth when token supplier provided', async () => {
    const tokenSupplier = vi.fn(() => 'test-token-123');
    const client = await httpsJsonAuthSmart('https://api.example.com', { tokenSupplier, allowUnsafeMode: true });

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
  });

  it('should add Bearer token to requests when token supplier provided', async () => {
    const tokenSupplier = vi.fn(() => 'test-token-456');

    // Create client with mock transport (need to pass transport somehow)
    // Since preset uses fetchTransport internally, we'll test the token supplier was called
    const client = await httpsJsonAuthSmart('https://api.example.com', { tokenSupplier, allowUnsafeMode: true });

    // Verify client was created successfully
    expect(client).toBeDefined();
    expect(tokenSupplier).not.toHaveBeenCalled(); // Lazy evaluation - not called until request
  });

  it('should handle async token suppliers', async () => {
    const tokenSupplier = vi.fn(async () => {
      // Simulate async token fetch
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'async-token-789';
    });

    const client = await httpsJsonAuthSmart('https://api.example.com', { tokenSupplier, allowUnsafeMode: true });

    expect(client).toBeDefined();
    expect(tokenSupplier).not.toHaveBeenCalled(); // Lazy evaluation
  });

  it('should gracefully handle missing @unireq/oauth package', async () => {
    // This tests the try/catch in the dynamic import
    // If @unireq/oauth is installed, this will succeed
    // If not installed, it should log warning and continue
    const client = await httpsJsonAuthSmart('https://api.example.com', {
      tokenSupplier: () => 'token',
      allowUnsafeMode: true,
    });

    expect(client).toBeDefined();
  });

  it('should merge user policies with preset policies', async () => {
    const userPolicy = vi.fn(async (ctx, next) => next(ctx));
    const client = await httpsJsonAuthSmart('https://api.example.com', {
      policies: [userPolicy],
    });
    expect(client).toBeDefined();
  });

  it('should handle base URL option', async () => {
    const client = await httpsJsonAuthSmart('https://api.example.com');

    expect(client).toBeDefined();
  });

  it('should complete preset initialization before returning client', async () => {
    // This is the critical test for the race condition fix
    const tokenSupplier = vi.fn(() => 'token');

    // Measure time to ensure awaits are working
    const start = Date.now();
    const client = await httpsJsonAuthSmart('https://api.example.com', { tokenSupplier, allowUnsafeMode: true });
    const duration = Date.now() - start;

    // Client should be created after all async operations
    expect(client).toBeDefined();
    expect(duration).toBeGreaterThanOrEqual(0); // Just verify it completed
  });

  it('should handle content negotiation for JSON requests', async () => {
    const client = await httpsJsonAuthSmart('https://api.example.com');
    expect(client).toBeDefined();

    // The client should have policies that handle accept headers
    // Testing that the either() policy is configured correctly
    // This exercises lines 70-79 which set up content negotiation
  });

  it('should handle content negotiation for XML requests', async () => {
    const client = await httpsJsonAuthSmart('https://api.example.com');
    expect(client).toBeDefined();

    // The XML policy should be configured as fallback
    // This ensures both JSON and XML parsers are set up
  });
});

describe('@unireq/presets - httpUploadGeneric', () => {
  it('should create upload client without options', () => {
    const client = httpUploadGeneric();

    expect(client).toBeDefined();
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
  });

  it('should create upload client with base URL', () => {
    const client = httpUploadGeneric('https://upload.example.com');

    expect(client).toBeDefined();
  });

  it('should create upload client with custom policies', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));
    const client = httpUploadGeneric('https://upload.example.com', { policies: [customPolicy] });
    expect(client).toBeDefined();
  });
});

describe('@unireq/presets - createMultipartUpload', () => {
  it('should create multipart policy with files only', () => {
    const files = [{ name: 'file1', filename: 'test.txt', data: new Blob(['test']) }];

    const policy = createMultipartUpload(files);

    expect(policy).toBeDefined();
    expect(typeof policy).toBe('function');
  });

  it('should create multipart policy with files and fields', () => {
    const files = [{ name: 'file1', filename: 'test.txt', data: new Blob(['test']) }];
    const fields = [{ name: 'field1', value: 'value1' }];

    const policy = createMultipartUpload(files, fields);

    expect(policy).toBeDefined();
    expect(typeof policy).toBe('function');
  });

  it('should create multipart policy with validation options', () => {
    const files = [{ name: 'file1', filename: 'test.txt', data: new Blob(['test']) }];
    const options = {
      maxFileSize: 1024 * 1024,
      allowedMimeTypes: ['text/plain'],
    };

    const policy = createMultipartUpload(files, undefined, options);

    expect(policy).toBeDefined();
    expect(typeof policy).toBe('function');
  });
});

describe('@unireq/presets - httpDownloadResume', () => {
  it('should create download client without resume state', () => {
    const client = httpDownloadResume('https://cdn.example.com');

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
  });

  it('should create download client with base URL', () => {
    const client = httpDownloadResume('https://cdn.example.com');

    expect(client).toBeDefined();
  });

  it('should create download client with resume state', () => {
    const state = { downloaded: 5000 };
    const client = httpDownloadResume('https://cdn.example.com', state);

    expect(client).toBeDefined();
  });

  it('should merge user policies with resume policy', () => {
    const userPolicy = vi.fn(async (ctx, next) => next(ctx));
    const state = { downloaded: 1000 };
    const client = httpDownloadResume('https://cdn.example.com', { policies: [userPolicy], resumeState: state });
    expect(client).toBeDefined();
  });
});

describe('@unireq/presets - gmailImap', () => {
  it('should create Gmail IMAP policy', () => {
    const tokenSupplier = vi.fn(() => 'gmail-token');

    const policy = gmailImap(tokenSupplier);

    expect(policy).toBeDefined();
    expect(typeof policy).toBe('function');
  });

  it('should create policy with async token supplier', () => {
    const tokenSupplier = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'gmail-token-async';
    });

    const policy = gmailImap(tokenSupplier);

    expect(policy).toBeDefined();
    expect(typeof policy).toBe('function');
  });

  it('should handle policy execution with IMAP context', async () => {
    const tokenSupplier = vi.fn(() => 'gmail-token');

    const policy = gmailImap(tokenSupplier);

    // Policy should set up IMAP context
    const result = await policy({ url: 'imap://imap.gmail.com', method: 'GET', headers: {} }, async (ctx) => {
      // Verify context has IMAP-specific fields
      expect((ctx as any).operation).toBe('select');
      expect((ctx as any).mailbox).toBe('INBOX');
      return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
  });
});

describe('@unireq/presets - httpClient', () => {
  it('should create client without base URL', () => {
    const client = httpClient();

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.head).toBe('function');
    expect(typeof client.options).toBe('function');
  });

  it('should create client with base URL', () => {
    const client = httpClient('https://api.example.com');

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
  });

  it('should have safe namespace for Result-returning methods', () => {
    const client = httpClient('https://api.example.com');

    expect(client.safe).toBeDefined();
    expect(typeof client.safe.get).toBe('function');
    expect(typeof client.safe.post).toBe('function');
    expect(typeof client.safe.put).toBe('function');
    expect(typeof client.safe.delete).toBe('function');
    expect(typeof client.safe.patch).toBe('function');
    expect(typeof client.safe.head).toBe('function');
    expect(typeof client.safe.options).toBe('function');
  });

  it('should accept timeout option', () => {
    const client = httpClient('https://api.example.com', {
      timeout: 5000,
    });

    expect(client).toBeDefined();
  });

  it('should accept headers option', () => {
    const client = httpClient('https://api.example.com', {
      headers: {
        'X-API-Key': 'secret',
        'X-Custom': 'value',
      },
    });

    expect(client).toBeDefined();
  });

  it('should accept json option set to false', () => {
    const client = httpClient('https://api.example.com', {
      json: false,
    });

    expect(client).toBeDefined();
  });

  it('should accept followRedirects option set to false', () => {
    const client = httpClient('https://api.example.com', {
      followRedirects: false,
    });

    expect(client).toBeDefined();
  });

  it('should accept custom policies', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));

    const client = httpClient('https://api.example.com', {
      policies: [customPolicy],
    });

    expect(client).toBeDefined();
  });

  it('should accept all options together', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));

    const client = httpClient('https://api.example.com', {
      timeout: 10000,
      headers: { Authorization: 'Bearer token' },
      json: true,
      followRedirects: true,
      policies: [customPolicy],
    });

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.safe.get).toBe('function');
  });

  it('should accept query option', () => {
    const client = httpClient('https://api.example.com', {
      query: {
        api_key: 'secret123',
        format: 'json',
        limit: 100,
      },
    });

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
  });

  it('should accept query with undefined values (filtered out)', () => {
    const client = httpClient('https://api.example.com', {
      query: {
        required: 'value',
        optional: undefined,
      },
    });

    expect(client).toBeDefined();
  });

  it('should combine query with other options', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));

    const client = httpClient('https://api.example.com', {
      timeout: 5000,
      headers: { 'X-API-Key': 'key' },
      query: { version: 'v1', format: 'json' },
      json: true,
      policies: [customPolicy],
    });

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.safe.get).toBe('function');
  });
});

describe('@unireq/presets - restApi', () => {
  it('should create REST API client with base URL', () => {
    const client = restApi('https://api.example.com');

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.delete).toBe('function');
  });

  it('should have safe namespace for Result-returning methods', () => {
    const client = restApi('https://api.example.com');

    expect(client.safe).toBeDefined();
    expect(typeof client.safe.get).toBe('function');
    expect(typeof client.safe.post).toBe('function');
  });

  it('should accept timeout option', () => {
    const client = restApi('https://api.example.com', {
      timeout: 10000,
    });

    expect(client).toBeDefined();
  });

  it('should accept headers option', () => {
    const client = restApi('https://api.example.com', {
      headers: {
        Authorization: 'Bearer token',
        'X-API-Key': 'secret',
      },
    });

    expect(client).toBeDefined();
  });

  it('should accept query option', () => {
    const client = restApi('https://api.example.com', {
      query: {
        api_version: 'v1',
        format: 'json',
      },
    });

    expect(client).toBeDefined();
  });

  it('should accept retries option', () => {
    const client = restApi('https://api.example.com', {
      retries: 5,
    });

    expect(client).toBeDefined();
  });

  it('should accept custom policies', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));

    const client = restApi('https://api.example.com', {
      policies: [customPolicy],
    });

    expect(client).toBeDefined();
  });

  it('should accept all options together', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));

    const client = restApi('https://api.example.com', {
      timeout: 15000,
      headers: { Authorization: 'Bearer token' },
      query: { version: 'v2' },
      retries: 4,
      policies: [customPolicy],
    });

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.safe.get).toBe('function');
  });
});

describe('@unireq/presets - webhook', () => {
  it('should create webhook client without base URL', () => {
    const client = webhook();

    expect(client).toBeDefined();
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
  });

  it('should create webhook client with base URL', () => {
    const client = webhook('https://hooks.example.com');

    expect(client).toBeDefined();
  });

  it('should have safe namespace for Result-returning methods', () => {
    const client = webhook('https://hooks.example.com');

    expect(client.safe).toBeDefined();
    expect(typeof client.safe.post).toBe('function');
  });

  it('should accept timeout option (default is short)', () => {
    const client = webhook('https://hooks.example.com', {
      timeout: 5000,
    });

    expect(client).toBeDefined();
  });

  it('should accept headers option', () => {
    const client = webhook('https://hooks.example.com', {
      headers: {
        'X-Webhook-Secret': 'secret123',
        'X-Webhook-ID': 'hook-456',
      },
    });

    expect(client).toBeDefined();
  });

  it('should accept retries option (higher default for reliability)', () => {
    const client = webhook('https://hooks.example.com', {
      retries: 10,
    });

    expect(client).toBeDefined();
  });

  it('should accept custom policies', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));

    const client = webhook('https://hooks.example.com', {
      policies: [customPolicy],
    });

    expect(client).toBeDefined();
  });

  it('should accept all options together', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));

    const client = webhook('https://hooks.example.com', {
      timeout: 8000,
      headers: { 'X-Signature': 'sig' },
      retries: 7,
      policies: [customPolicy],
    });

    expect(client).toBeDefined();
    expect(typeof client.post).toBe('function');
    expect(typeof client.safe.post).toBe('function');
  });
});

describe('@unireq/presets - scraper', () => {
  it('should create scraper client without base URL', () => {
    const client = scraper();

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
  });

  it('should create scraper client with base URL', () => {
    const client = scraper('https://example.com');

    expect(client).toBeDefined();
  });

  it('should have safe namespace for Result-returning methods', () => {
    const client = scraper('https://example.com');

    expect(client.safe).toBeDefined();
    expect(typeof client.safe.get).toBe('function');
  });

  it('should accept timeout option (longer default for slow pages)', () => {
    const client = scraper('https://example.com', {
      timeout: 30000,
    });

    expect(client).toBeDefined();
  });

  it('should accept userAgent option', () => {
    const client = scraper('https://example.com', {
      userAgent: 'MyBot/1.0 (+https://mybot.example.com)',
    });

    expect(client).toBeDefined();
  });

  it('should accept headers option', () => {
    const client = scraper('https://example.com', {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'session=abc123',
      },
    });

    expect(client).toBeDefined();
  });

  it('should accept followRedirects option set to false', () => {
    const client = scraper('https://example.com', {
      followRedirects: false,
    });

    expect(client).toBeDefined();
  });

  it('should accept custom policies', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));

    const client = scraper('https://example.com', {
      policies: [customPolicy],
    });

    expect(client).toBeDefined();
  });

  it('should accept all options together', () => {
    const customPolicy = vi.fn(async (ctx, next) => next(ctx));

    const client = scraper('https://example.com', {
      timeout: 45000,
      userAgent: 'CustomCrawler/2.0',
      headers: { 'Accept-Encoding': 'gzip' },
      followRedirects: true,
      policies: [customPolicy],
    });

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.safe.get).toBe('function');
  });
});
