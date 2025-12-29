import type { Policy, RequestContext, Response } from '@unireq/core';
import { describe, expect, it } from 'vitest';
import { PresetBuilder, preset } from '../builder.js';

describe('@unireq/presets - Fluent Builder API', () => {
  describe('preset entry point', () => {
    it('should provide api entry point', () => {
      expect(preset.api).toBeInstanceOf(PresetBuilder);
    });

    it('should provide uri method', () => {
      const builder = preset.uri('https://api.example.com');
      expect(builder).toBeInstanceOf(PresetBuilder);
    });
  });

  describe('PresetBuilder property chaining', () => {
    it('should chain .json as property', () => {
      const builder = preset.api.json;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain .retry as property', () => {
      const builder = preset.api.retry;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain .timeout as property', () => {
      const builder = preset.api.timeout;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain .cache as property', () => {
      const builder = preset.api.cache;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain .logging as property', () => {
      const builder = preset.api.logging;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain .redirect as property', () => {
      const builder = preset.api.redirect;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain multiple properties', () => {
      const builder = preset.api.json.retry.timeout;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain all available properties', () => {
      const builder = preset.api.json.retry.timeout.cache.logging.redirect;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });
  });

  describe('PresetBuilder method chaining', () => {
    it('should chain .withRetry() with options', () => {
      const builder = preset.api.withRetry({ tries: 5 });
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain .withTimeout() with ms', () => {
      const builder = preset.api.withTimeout(5000);
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain .withCache() with options', () => {
      const builder = preset.api.withCache({ defaultTtl: 60000 });
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain .withLogging() with logger', () => {
      const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
      const builder = preset.api.withLogging(logger);
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain .withRedirect() with options', () => {
      const builder = preset.api.withRedirect({ allow: [301, 302] });
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should chain mixed properties and methods', () => {
      const builder = preset.api.json.withRetry({ tries: 3 }).withTimeout(10000).cache;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });
  });

  describe('PresetBuilder.build()', () => {
    it('should build client with uri parameter', () => {
      const client = preset.api.json.build('https://api.example.com');
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
      expect(typeof client.post).toBe('function');
    });

    it('should build client with preset uri', () => {
      const client = preset.uri('https://api.example.com').json.build();
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
    });

    it('should throw if no URI provided', () => {
      expect(() => preset.api.json.build()).toThrow('Base URI is required');
    });

    it('should build with retry configuration', () => {
      const client = preset.api.json.retry.build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with custom retry configuration', () => {
      const client = preset.api.json.withRetry({ tries: 5 }).build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with timeout configuration', () => {
      const client = preset.api.json.timeout.build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with custom timeout configuration', () => {
      const client = preset.api.json.withTimeout(5000).build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with cache configuration', () => {
      const client = preset.api.json.cache.build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with custom cache configuration', () => {
      const client = preset.api.json.withCache({ defaultTtl: 60000 }).build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with oauth configuration', () => {
      const client = preset.api.json
        .oauth({
          tokenSupplier: () => 'test-token',
          allowUnsafeMode: true,
        })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with custom policies', () => {
      const customPolicy: Policy = async (ctx, next) => next(ctx);
      const client = preset.api.json.with(customPolicy).build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with all options combined', () => {
      const client = preset.uri('https://api.example.com').json.retry.timeout.cache.redirect.build();
      expect(client).toBeDefined();
    });
  });

  describe('Builder immutability', () => {
    it('should not modify previous builder when chaining', () => {
      const builder1 = preset.api.json;
      const builder2 = builder1.retry;
      const builder3 = builder1.cache;

      // All should be different instances
      expect(builder1).not.toBe(builder2);
      expect(builder1).not.toBe(builder3);
      expect(builder2).not.toBe(builder3);
    });
  });

  describe('Full chain examples (user requested patterns)', () => {
    it('should support preset.api.json.retry.timeout pattern', () => {
      // This is the exact pattern the user requested
      const client = preset.api.json.retry.timeout.build('https://api.example.com');
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
      expect(typeof client.post).toBe('function');
      expect(typeof client.put).toBe('function');
      expect(typeof client.delete).toBe('function');
    });

    it('should support preset.api.json.withRetry().withTimeout() pattern', () => {
      const client = preset.api.json.withRetry({ tries: 3 }).withTimeout(5000).build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should support oauth + json + retry + timeout pattern', () => {
      const client = preset.api.json
        .oauth({
          tokenSupplier: async () => 'token',
          allowUnsafeMode: true,
        })
        .retry.timeout.build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should support mixed property and method chain', () => {
      const client = preset.api.json.retry
        .withTimeout(10000)
        .withCache({ defaultTtl: 30000 })
        .logging.build('https://api.example.com');
      expect(client).toBeDefined();
    });
  });

  describe('XML support', () => {
    it('should support .xml property', () => {
      const builder = preset.api.xml;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should build with xml accept header', () => {
      const client = preset.api.xml.build('https://api.example.com');
      expect(client).toBeDefined();
    });
  });

  describe('New primitives support', () => {
    it('should support .circuitBreaker property', () => {
      const builder = preset.api.circuitBreaker;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should support .withCircuitBreaker() method', () => {
      const builder = preset.api.withCircuitBreaker({ threshold: 10, resetTimeout: 60000 });
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should support .throttle property', () => {
      const builder = preset.api.throttle;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should support .withThrottle() method', () => {
      const builder = preset.api.withThrottle({ limit: 5, interval: 1000 });
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should support .conditional property', () => {
      const builder = preset.api.conditional;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should support .withConditional() method', () => {
      const builder = preset.api.withConditional({ ttl: 300000 });
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should support .withHeaders() method', () => {
      const builder = preset.api.withHeaders({ 'X-API-Key': 'secret' });
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should support .withQuery() method', () => {
      const builder = preset.api.withQuery({ version: 'v2' });
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should support .withInterceptors() method', () => {
      const builder = preset.api.withInterceptors({
        request: (ctx) => ctx,
        response: (response) => response,
      });
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should support .withValidation() method', () => {
      const mockSchema = {};
      const mockAdapter = { validate: (_schema: unknown, data: unknown) => data };
      const builder = preset.api.withValidation(mockSchema, mockAdapter);
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should build with all new primitives', () => {
      const client = preset.api.json.circuitBreaker.throttle.conditional
        .withHeaders({ 'X-API-Key': 'test' })
        .withQuery({ version: 'v2' })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should chain all primitives together', () => {
      const builder = preset.api.json.retry.timeout.cache.circuitBreaker.throttle.conditional.redirect.logging;
      expect(builder).toBeInstanceOf(PresetBuilder);
    });

    it('should build with both json and xml accept headers', () => {
      const client = preset.api.json.xml.build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with retry respectRateLimit disabled', () => {
      const client = preset.api.json.withRetry({ tries: 3, respectRateLimit: false }).build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should support array of request interceptors', () => {
      const interceptor1 = (ctx: RequestContext) => ctx;
      const interceptor2 = (ctx: RequestContext) => ctx;
      const client = preset.api.json
        .withInterceptors({
          request: [interceptor1, interceptor2],
        })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should support array of response interceptors', () => {
      const interceptor1 = (response: Response) => response;
      const interceptor2 = (response: Response) => response;
      const client = preset.api.json
        .withInterceptors({
          response: [interceptor1, interceptor2],
        })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should support array of error interceptors', () => {
      const interceptor1 = (error: unknown) => {
        throw error;
      };
      const interceptor2 = (error: unknown) => {
        throw error;
      };
      const client = preset.api.json
        .withInterceptors({
          error: [interceptor1, interceptor2],
        })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should support single error interceptor', () => {
      const client = preset.api.json
        .withInterceptors({
          error: (error) => {
            throw error;
          },
        })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with validation policy', () => {
      const mockSchema = {};
      const mockAdapter = { validate: (_schema: unknown, data: unknown) => data };
      const client = preset.api.json.withValidation(mockSchema, mockAdapter).build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with custom logging configuration', () => {
      const client = preset.api.json
        .withLogging({
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with custom retry backoff options', () => {
      const client = preset.api.json
        .withRetry({
          tries: 3,
          backoff: { initial: 500, max: 10000, jitter: false },
        })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with custom retry methods and status codes', () => {
      const client = preset.api.json
        .withRetry({
          tries: 2,
          methods: ['POST'],
          statusCodes: [500, 503],
        })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should merge headers when called multiple times', () => {
      const client = preset.api
        .withHeaders({ 'X-Header-1': 'value1' })
        .withHeaders({ 'X-Header-2': 'value2' })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should merge query params when called multiple times', () => {
      const client = preset.api
        .withQuery({ param1: 'value1' })
        .withQuery({ param2: 'value2' })
        .build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should build with default console logging (property getter)', () => {
      // This tests the .logging property getter which uses default console logger
      const client = preset.api.logging.build('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('should use uri() method to set base URI', () => {
      const builder = preset.api.uri('https://api.example.com');
      expect(builder).toBeInstanceOf(PresetBuilder);
    });
  });

  describe('Protocol presets', () => {
    it('should provide smtp entry point', () => {
      // This tests the smtp getter
      expect(preset.smtp).toBeDefined();
    });

    it('should provide imap entry point', () => {
      expect(preset.imap).toBeDefined();
    });

    it('should provide ftp entry point', () => {
      expect(preset.ftp).toBeDefined();
    });

    it('should provide h2 entry point', () => {
      expect(preset.h2).toBeDefined();
    });
  });
});
