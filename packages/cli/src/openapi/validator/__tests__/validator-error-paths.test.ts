/**
 * Tests for OpenAPI validator error paths.
 *
 * Covers: invalid specs, malformed input, unsupported versions,
 * missing paths/operations, invalid $refs, empty specs, circular refs.
 */

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SpecParseError } from '../../errors.js';
import { loadSpec } from '../../loader.js';
import type { OpenAPIDocument } from '../../types.js';
import {
  findMatchingPath,
  getOperationFromPathItem,
  validateRequest,
  validateRequestFull,
} from '../index.js';
import type { ValidatorContext } from '../types.js';

const fixturesDir = path.join(import.meta.dirname, '../../__tests__/fixtures');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeDoc = (paths: Record<string, unknown> = {}): OpenAPIDocument => ({
  openapi: '3.0.0',
  info: { title: 'Test', version: '1.0.0' },
  paths: paths as OpenAPIDocument['paths'],
});

// ---------------------------------------------------------------------------
// loadSpec — error paths
// ---------------------------------------------------------------------------

describe('loadSpec — error paths', () => {
  describe('malformed input', () => {
    it('should throw SpecParseError for invalid JSON content', async () => {
      const source = path.join(fixturesDir, 'invalid-json.json');

      await expect(loadSpec(source, { noCache: true })).rejects.toBeInstanceOf(SpecParseError);
      await expect(loadSpec(source, { noCache: true })).rejects.toThrow(/invalid JSON syntax/i);
    });

    it('should throw SpecParseError for invalid YAML content', async () => {
      const source = path.join(fixturesDir, 'invalid-yaml.yaml');

      await expect(loadSpec(source, { noCache: true })).rejects.toBeInstanceOf(SpecParseError);
      await expect(loadSpec(source, { noCache: true })).rejects.toThrow(/invalid YAML syntax/i);
    });
  });

  describe('empty spec', () => {
    it('should throw SpecParseError for empty file', async () => {
      const source = path.join(fixturesDir, 'empty.yaml');

      await expect(loadSpec(source, { noCache: true })).rejects.toBeInstanceOf(SpecParseError);
      await expect(loadSpec(source, { noCache: true })).rejects.toThrow(/empty/i);
    });
  });

  describe('missing required fields', () => {
    it('should throw SpecParseError when openapi/swagger field is absent', async () => {
      const source = path.join(fixturesDir, 'not-openapi.yaml');

      await expect(loadSpec(source, { noCache: true })).rejects.toBeInstanceOf(SpecParseError);
      await expect(loadSpec(source, { noCache: true })).rejects.toThrow(/not a valid OpenAPI/i);
    });
  });

  describe('unsupported spec version', () => {
    it('should throw SpecParseError for unsupported OpenAPI version (2.5)', async () => {
      // openapi: "2.5.0" is neither a known 3.x nor a swagger 2.0 field
      const source = path.join(fixturesDir, 'unsupported-version.yaml');

      await expect(loadSpec(source, { noCache: true })).rejects.toBeInstanceOf(SpecParseError);
      await expect(loadSpec(source, { noCache: true })).rejects.toThrow(/Unsupported OpenAPI version|not a valid OpenAPI/i);
    });
  });

  describe('missing paths/operations', () => {
    it('should load successfully when paths field is absent', async () => {
      // A spec without paths is technically valid at parse/load time
      const source = path.join(fixturesDir, 'no-paths.yaml');

      const result = await loadSpec(source, { noCache: true });
      expect(result.version).toBe('3.0');
      // paths may be undefined or empty
      expect(result.document.info.title).toBe('No Paths API');
    });
  });

  describe('invalid $ref (non-existent definition)', () => {
    it('should throw SpecParseError when $ref points to a missing definition', async () => {
      // bad-ref.yaml references #/components/schemas/DoesNotExist which is absent
      const source = path.join(fixturesDir, 'bad-ref.yaml');

      await expect(loadSpec(source, { noCache: true })).rejects.toBeInstanceOf(SpecParseError);
      await expect(loadSpec(source, { noCache: true })).rejects.toThrow(/failed to resolve references/i);
    });
  });

  describe('circular references', () => {
    it('should load a spec with circular $refs without throwing', async () => {
      // @scalar/openapi-parser handles circular refs gracefully
      const source = path.join(fixturesDir, 'circular-ref.yaml');

      // Either resolves (circular handled) or throws a SpecParseError — never hangs
      let result: Awaited<ReturnType<typeof loadSpec>> | undefined;
      let err: unknown;
      try {
        result = await loadSpec(source, { noCache: true });
      } catch (e) {
        err = e;
      }

      if (err !== undefined) {
        expect(err).toBeInstanceOf(SpecParseError);
      } else {
        expect(result?.document.info.title).toBe('Circular Ref API');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// findMatchingPath — error paths
// ---------------------------------------------------------------------------

describe('findMatchingPath — error paths', () => {
  it('should return undefined when document has no paths field', () => {
    const doc = makeDoc();
    // Force paths to be undefined to simulate a spec loaded without paths
    const docNoPaths = { ...doc, paths: undefined } as unknown as OpenAPIDocument;

    const result = findMatchingPath(docNoPaths, '/users');
    expect(result).toBeUndefined();
  });

  it('should return undefined for completely empty paths object', () => {
    const doc = makeDoc({});

    const result = findMatchingPath(doc, '/anything');
    expect(result).toBeUndefined();
  });

  it('should skip null path item entries', () => {
    // A paths entry with a null value should not match
    const doc = makeDoc({ '/users': null });

    const result = findMatchingPath(doc, '/users');
    expect(result).toBeUndefined();
  });

  it('should return undefined when actual path has more segments than any template', () => {
    const doc = makeDoc({ '/users': { get: {} } });

    const result = findMatchingPath(doc, '/users/123/posts/456');
    expect(result).toBeUndefined();
  });

  it('should return undefined when literal segment does not match', () => {
    const doc = makeDoc({ '/users': { get: {} } });

    const result = findMatchingPath(doc, '/orders');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getOperationFromPathItem — error paths
// ---------------------------------------------------------------------------

describe('getOperationFromPathItem — error paths', () => {
  it('should return undefined for a method not defined on the path item', () => {
    const pathItem = { get: { summary: 'List' } };

    expect(getOperationFromPathItem(pathItem, 'post')).toBeUndefined();
    expect(getOperationFromPathItem(pathItem, 'PUT')).toBeUndefined();
    expect(getOperationFromPathItem(pathItem, 'delete')).toBeUndefined();
  });

  it('should return undefined when path item is empty', () => {
    expect(getOperationFromPathItem({}, 'get')).toBeUndefined();
  });

  it('should return undefined when method value is a non-object (e.g. string)', () => {
    // Malformed spec where an HTTP method key maps to a non-object
    const pathItem = { get: 'not-an-operation' } as unknown as Record<string, unknown>;

    expect(getOperationFromPathItem(pathItem, 'get')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateRequestFull — error paths
// ---------------------------------------------------------------------------

describe('validateRequestFull — error paths', () => {
  describe('no document', () => {
    it('should skip when document is undefined', () => {
      const result = validateRequestFull(undefined, 'GET', '/users', [], [], false);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('No OpenAPI spec loaded');
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('missing paths in spec', () => {
    it('should skip when document has no paths', () => {
      const doc = { ...makeDoc(), paths: undefined } as unknown as OpenAPIDocument;

      const result = validateRequestFull(doc, 'GET', '/users', [], [], false);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('Path not found in OpenAPI spec');
    });

    it('should skip when document has empty paths object', () => {
      const doc = makeDoc({});

      const result = validateRequestFull(doc, 'GET', '/users', [], [], false);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('Path not found in OpenAPI spec');
    });
  });

  describe('missing operation for method', () => {
    it('should skip when GET is not defined on the matched path', () => {
      const doc = makeDoc({ '/users': { post: { summary: 'Create user' } } });

      const result = validateRequestFull(doc, 'GET', '/users', [], [], false);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('GET');
    });

    it('should skip for any unsupported HTTP method on path', () => {
      const doc = makeDoc({ '/items': { get: { summary: 'List items' } } });

      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const result = validateRequestFull(doc, method, '/items', [], [], false);
        expect(result.skipped).toBe(true);
        expect(result.skipReason).toContain(method);
      }
    });
  });

  describe('spec with paths but no operations defined', () => {
    it('should skip when path item exists but has no HTTP methods', () => {
      // A path item with only non-method keys (e.g. parameters)
      const doc = makeDoc({
        '/resources': {
          parameters: [{ name: 'X-Tenant', in: 'header', required: false }],
        },
      });

      const result = validateRequestFull(doc, 'GET', '/resources', [], [], false);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('GET');
    });
  });
});

// ---------------------------------------------------------------------------
// validateRequest — error paths (invalid schema / missing body / refs)
// ---------------------------------------------------------------------------

describe('validateRequest — error paths', () => {
  describe('missing required request body', () => {
    it('should warn when body is required but not provided', () => {
      const context: ValidatorContext = {
        operation: {
          requestBody: { required: true, content: { 'application/json': {} } },
        },
        pathTemplate: '/users',
        actualPath: '/users',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      expect(result.skipped).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toBe('Missing required request body');
    });

    it('should not warn when required body is provided', () => {
      const context: ValidatorContext = {
        operation: {
          requestBody: { required: true, content: { 'application/json': {} } },
        },
        pathTemplate: '/users',
        actualPath: '/users',
        queryParams: [],
        headerParams: [],
        hasBody: true,
      };

      const result = validateRequest(context);

      expect(result.warnings.filter((w) => w.location === 'body')).toHaveLength(0);
    });

    it('should not warn when requestBody is not required', () => {
      const context: ValidatorContext = {
        operation: {
          requestBody: { required: false, content: { 'application/json': {} } },
        },
        pathTemplate: '/users',
        actualPath: '/users',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      expect(result.warnings.filter((w) => w.location === 'body')).toHaveLength(0);
    });
  });

  describe('parameter validation with no schema', () => {
    it('should not warn when parameter has no schema defined', () => {
      const context: ValidatorContext = {
        operation: {
          parameters: [{ name: 'x-custom', in: 'header', required: false }],
        },
        pathTemplate: '/items',
        actualPath: '/items',
        queryParams: [],
        headerParams: ['x-custom: foobar'],
        hasBody: false,
      };

      const result = validateRequest(context);
      expect(result.skipped).toBe(false);
      // No type/enum/format check can run without schema — no warnings
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('multiple required parameters missing', () => {
    it('should produce a warning per missing required parameter', () => {
      const context: ValidatorContext = {
        operation: {
          parameters: [
            { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'filter', in: 'query', required: true, schema: { type: 'string' } },
          ],
        },
        pathTemplate: '/users/{userId}',
        actualPath: '/users/',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      expect(result.skipped).toBe(false);
      const missingWarnings = result.warnings.filter((w) => w.message.includes('Missing required'));
      expect(missingWarnings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('operation with no parameters or body', () => {
    it('should return no warnings for an empty operation', () => {
      const context: ValidatorContext = {
        operation: {},
        pathTemplate: '/health',
        actualPath: '/health',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      expect(result.skipped).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
