import { delay, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SpecLoadError, SpecNotFoundError, SpecParseError } from '../errors';
import { loadSpec } from '../loader';

// Mock server setup
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('loadSpec (URL)', () => {
  describe('successful loading', () => {
    it('should load spec from HTTPS URL', async () => {
      // Arrange
      server.use(
        http.get('https://api.example.com/openapi.json', () => {
          return HttpResponse.json({
            openapi: '3.0.3',
            info: { title: 'Test API', version: '1.0.0' },
            paths: {},
          });
        }),
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
      server.use(
        http.get('https://api.example.com/openapi.yaml', () => {
          return new HttpResponse(yamlContent, {
            headers: { 'Content-Type': 'application/yaml' },
          });
        }),
      );

      // Act
      const result = await loadSpec('https://api.example.com/openapi.yaml');

      // Assert
      expect(result.version).toBe('3.1');
      expect(result.document.info.title).toBe('YAML API');
    });

    it('should load from HTTP localhost when allowed', async () => {
      // Arrange
      server.use(
        http.get('http://localhost:3000/spec.json', () => {
          return HttpResponse.json({
            openapi: '3.0.0',
            info: { title: 'Local API', version: '1.0.0' },
            paths: {},
          });
        }),
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
      server.use(
        http.get('http://127.0.0.1:8080/spec.json', () => {
          return HttpResponse.json({
            openapi: '3.0.0',
            info: { title: 'Localhost API', version: '1.0.0' },
            paths: {},
          });
        }),
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
      server.use(
        http.get('https://api.example.com/missing.json', () => {
          return new HttpResponse(null, { status: 404 });
        }),
      );

      // Act & Assert
      await expect(loadSpec('https://api.example.com/missing.json')).rejects.toThrow(SpecNotFoundError);
      await expect(loadSpec('https://api.example.com/missing.json')).rejects.toThrow(/404/);
    });

    it('should throw SpecLoadError for server errors', async () => {
      // Arrange
      server.use(
        http.get('https://api.example.com/error.json', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      // Act & Assert
      await expect(loadSpec('https://api.example.com/error.json')).rejects.toThrow(SpecLoadError);
      await expect(loadSpec('https://api.example.com/error.json')).rejects.toThrow(/500/);
    });

    it('should throw SpecLoadError on timeout', async () => {
      // Arrange
      server.use(
        http.get('https://api.example.com/slow.json', async () => {
          await delay(5000); // Longer than our timeout
          return HttpResponse.json({
            openapi: '3.0.0',
            info: { title: 'Slow API', version: '1.0.0' },
            paths: {},
          });
        }),
      );

      // Act & Assert
      await expect(loadSpec('https://api.example.com/slow.json', { timeout: 100 })).rejects.toThrow(SpecLoadError);
      await expect(loadSpec('https://api.example.com/slow.json', { timeout: 100 })).rejects.toThrow(/timeout/);
    });

    it('should throw SpecParseError for invalid JSON', async () => {
      // Arrange
      server.use(
        http.get('https://api.example.com/invalid.json', () => {
          return new HttpResponse('{ invalid json }', {
            headers: { 'Content-Type': 'application/json' },
          });
        }),
      );

      // Act & Assert
      await expect(loadSpec('https://api.example.com/invalid.json')).rejects.toThrow(SpecParseError);
      await expect(loadSpec('https://api.example.com/invalid.json')).rejects.toThrow(/invalid JSON/i);
    });

    it('should throw SpecParseError for empty response', async () => {
      // Arrange
      server.use(
        http.get('https://api.example.com/empty.json', () => {
          return new HttpResponse('', {
            headers: { 'Content-Type': 'application/json' },
          });
        }),
      );

      // Act & Assert
      await expect(loadSpec('https://api.example.com/empty.json')).rejects.toThrow(SpecParseError);
      await expect(loadSpec('https://api.example.com/empty.json')).rejects.toThrow(/empty/i);
    });

    it('should throw SpecParseError for non-OpenAPI content', async () => {
      // Arrange
      server.use(
        http.get('https://api.example.com/not-openapi.json', () => {
          return HttpResponse.json({
            name: 'Not OpenAPI',
            version: '1.0.0',
          });
        }),
      );

      // Act & Assert
      await expect(loadSpec('https://api.example.com/not-openapi.json')).rejects.toThrow(SpecParseError);
      await expect(loadSpec('https://api.example.com/not-openapi.json')).rejects.toThrow(/not a valid OpenAPI/i);
    });
  });

  describe('content-type detection', () => {
    it('should use content-type header for JSON', async () => {
      // Arrange - URL has .yaml but content-type says JSON
      server.use(
        http.get('https://api.example.com/spec.yaml', () => {
          return HttpResponse.json(
            {
              openapi: '3.0.0',
              info: { title: 'JSON Content', version: '1.0.0' },
              paths: {},
            },
            {
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }),
      );

      // Act
      const result = await loadSpec('https://api.example.com/spec.yaml');

      // Assert
      expect(result.document.info.title).toBe('JSON Content');
    });
  });
});
