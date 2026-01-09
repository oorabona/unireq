import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SpecLoadError, SpecNotFoundError, SpecParseError } from '../errors';
import { loadSpec } from '../loader';

// Mock agent setup
let mockAgent: MockAgent;

beforeEach(() => {
  // Enable fresh mocks for each test
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

describe('loadSpec (URL)', () => {
  describe('successful loading', () => {
    it('should load spec from HTTPS URL', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://api.example.com');
      mockPool.intercept({ path: '/openapi.json', method: 'GET' }).reply(
        200,
        {
          openapi: '3.0.3',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {},
        },
        { headers: { 'content-type': 'application/json' } },
      );

      // Act
      const result = await loadSpec('https://api.example.com/openapi.json');

      // Assert
      expect(result.version).toBe('3.0');
      expect(result.document.info.title).toBe('Test API');
    });

    it('should load YAML spec from URL', async () => {
      // Arrange
      const yamlContent = `
openapi: 3.1.0
info:
  title: YAML API
  version: 2.0.0
paths: {}
`;
      const mockPool = mockAgent.get('https://api.example.com');
      mockPool.intercept({ path: '/openapi.yaml', method: 'GET' }).reply(200, yamlContent, {
        headers: { 'content-type': 'application/yaml' },
      });

      // Act
      const result = await loadSpec('https://api.example.com/openapi.yaml');

      // Assert
      expect(result.version).toBe('3.1');
      expect(result.document.info.title).toBe('YAML API');
    });

    it('should load from HTTP localhost when allowed', async () => {
      // Arrange
      const mockPool = mockAgent.get('http://localhost:3000');
      mockPool.intercept({ path: '/spec.json', method: 'GET' }).reply(
        200,
        {
          openapi: '3.0.0',
          info: { title: 'Local API', version: '1.0.0' },
          paths: {},
        },
        { headers: { 'content-type': 'application/json' } },
      );

      // Act
      const result = await loadSpec('http://localhost:3000/spec.json', {
        allowInsecureLocalhost: true,
      });

      // Assert
      expect(result.document.info.title).toBe('Local API');
    });

    it('should load from HTTP 127.0.0.1 when allowed', async () => {
      // Arrange
      const mockPool = mockAgent.get('http://127.0.0.1:8080');
      mockPool.intercept({ path: '/spec.json', method: 'GET' }).reply(
        200,
        {
          openapi: '3.0.0',
          info: { title: 'Localhost API', version: '1.0.0' },
          paths: {},
        },
        { headers: { 'content-type': 'application/json' } },
      );

      // Act
      const result = await loadSpec('http://127.0.0.1:8080/spec.json', {
        allowInsecureLocalhost: true,
      });

      // Assert
      expect(result.document.info.title).toBe('Localhost API');
    });
  });

  describe('security checks', () => {
    it('should reject HTTP URL to remote host', async () => {
      // Arrange & Act & Assert
      await expect(loadSpec('http://api.example.com/spec.json')).rejects.toThrow(SpecLoadError);
      await expect(loadSpec('http://api.example.com/spec.json')).rejects.toThrow(/HTTPS required/);
    });

    it('should reject HTTP localhost when not allowed', async () => {
      // Arrange & Act & Assert
      await expect(
        loadSpec('http://localhost:3000/spec.json', {
          allowInsecureLocalhost: false,
        }),
      ).rejects.toThrow(SpecLoadError);
      await expect(
        loadSpec('http://localhost:3000/spec.json', {
          allowInsecureLocalhost: false,
        }),
      ).rejects.toThrow(/HTTPS required/);
    });
  });

  describe('error handling', () => {
    it('should throw SpecNotFoundError for 404', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://api.example.com');
      mockPool.intercept({ path: '/missing.json', method: 'GET' }).reply(404, '');

      // Act & Assert
      await expect(loadSpec('https://api.example.com/missing.json')).rejects.toThrow(SpecNotFoundError);
    });

    it('should throw SpecLoadError for server errors', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://api.example.com');
      mockPool.intercept({ path: '/error.json', method: 'GET' }).reply(500, '');

      // Act & Assert
      await expect(loadSpec('https://api.example.com/error.json')).rejects.toThrow(SpecLoadError);
    });

    it('should throw SpecLoadError on timeout', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://api.example.com');
      mockPool
        .intercept({ path: '/slow.json', method: 'GET' })
        .reply(200, {
          openapi: '3.0.0',
          info: { title: 'Slow API', version: '1.0.0' },
          paths: {},
        })
        .delay(5000); // Longer than our timeout

      // Act & Assert
      await expect(loadSpec('https://api.example.com/slow.json', { timeout: 100 })).rejects.toThrow(SpecLoadError);
    });

    it('should throw SpecParseError for invalid JSON', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://api.example.com');
      mockPool.intercept({ path: '/invalid.json', method: 'GET' }).reply(200, '{ invalid json }', {
        headers: { 'content-type': 'application/json' },
      });

      // Act & Assert
      await expect(loadSpec('https://api.example.com/invalid.json')).rejects.toThrow(SpecParseError);
    });

    it('should throw SpecParseError for empty response', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://api.example.com');
      mockPool.intercept({ path: '/empty.json', method: 'GET' }).reply(200, '', {
        headers: { 'content-type': 'application/json' },
      });

      // Act & Assert
      await expect(loadSpec('https://api.example.com/empty.json')).rejects.toThrow(SpecParseError);
    });

    it('should throw SpecParseError for non-OpenAPI content', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://api.example.com');
      mockPool.intercept({ path: '/not-openapi.json', method: 'GET' }).reply(
        200,
        {
          name: 'Not OpenAPI',
          version: '1.0.0',
        },
        { headers: { 'content-type': 'application/json' } },
      );

      // Act & Assert
      await expect(loadSpec('https://api.example.com/not-openapi.json')).rejects.toThrow(SpecParseError);
    });
  });

  describe('content-type detection', () => {
    it('should use content-type header for JSON', async () => {
      // Arrange - URL has .yaml but content-type says JSON
      const mockPool = mockAgent.get('https://api.example.com');
      mockPool.intercept({ path: '/spec.yaml', method: 'GET' }).reply(
        200,
        {
          openapi: '3.0.0',
          info: { title: 'JSON Content', version: '1.0.0' },
          paths: {},
        },
        { headers: { 'content-type': 'application/json' } },
      );

      // Act
      const result = await loadSpec('https://api.example.com/spec.yaml');

      // Assert
      expect(result.document.info.title).toBe('JSON Content');
    });
  });
});
