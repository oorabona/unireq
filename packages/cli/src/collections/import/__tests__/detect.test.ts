/**
 * Tests for format detection
 */

import { describe, expect, it } from 'vitest';
import { detectFormat, detectFormatFromString, getFormatDisplayName, getFormatFileExtension } from '../detect.js';
import { ImportError } from '../types.js';

describe('detectFormat', () => {
  describe('when input is Postman v2.1 collection', () => {
    it('should detect Postman format with high confidence', () => {
      // Arrange
      const data = {
        info: {
          name: 'Test Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      };

      // Act
      const result = detectFormat(data);

      // Assert
      expect(result.format).toBe('postman');
      expect(result.version).toBe('2.1.0');
      expect(result.confidence).toBe('high');
    });

    it('should detect Postman format with items', () => {
      // Arrange
      const data = {
        info: {
          name: 'API Tests',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          _postman_id: 'abc-123',
        },
        item: [
          {
            name: 'Get Users',
            request: {
              method: 'GET',
              url: 'https://api.example.com/users',
            },
          },
        ],
      };

      // Act
      const result = detectFormat(data);

      // Assert
      expect(result.format).toBe('postman');
      expect(result.confidence).toBe('high');
    });

    it('should reject Postman v2.0 with clear error message', () => {
      // Arrange
      const data = {
        info: {
          name: 'Old Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json',
        },
        item: [],
      };

      // Act & Assert
      expect(() => detectFormat(data)).toThrow(ImportError);
      expect(() => detectFormat(data)).toThrow('Postman Collection v2.0 is not supported');
    });
  });

  describe('when input is Insomnia v4 export', () => {
    it('should detect Insomnia format with high confidence', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 4,
        __export_date: '2026-01-07T10:00:00.000Z',
        __export_source: 'insomnia.desktop.app:v2023.5.8',
        resources: [],
      };

      // Act
      const result = detectFormat(data);

      // Assert
      expect(result.format).toBe('insomnia');
      expect(result.version).toBe('4');
      expect(result.confidence).toBe('high');
    });

    it('should detect Insomnia with resources', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 4,
        __export_date: '2026-01-07T10:00:00.000Z',
        __export_source: 'insomnia.desktop.app:v2023.5.8',
        resources: [
          {
            _id: 'wrk_abc123',
            _type: 'workspace',
            parentId: null,
            name: 'My API',
          },
          {
            _id: 'req_def456',
            _type: 'request',
            parentId: 'wrk_abc123',
            name: 'Get Users',
            method: 'GET',
            url: 'https://api.example.com/users',
          },
        ],
      };

      // Act
      const result = detectFormat(data);

      // Assert
      expect(result.format).toBe('insomnia');
      expect(result.confidence).toBe('high');
    });

    it('should reject Insomnia v3 with clear error message', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 3,
        resources: [],
      };

      // Act & Assert
      expect(() => detectFormat(data)).toThrow(ImportError);
      expect(() => detectFormat(data)).toThrow('Insomnia export format 3 is not supported');
    });

    it('should handle newer Insomnia format with low confidence', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 5, // Hypothetical future version
        resources: [],
      };

      // Act
      const result = detectFormat(data);

      // Assert
      expect(result.format).toBe('insomnia');
      expect(result.version).toBe('5');
      // Low confidence because schema validation fails (format 5 != 4)
      expect(result.confidence).toBe('low');
    });
  });

  describe('when input is HAR 1.2 archive', () => {
    it('should detect HAR format with high confidence', () => {
      // Arrange
      const data = {
        log: {
          version: '1.2',
          creator: {
            name: 'Chrome DevTools',
            version: '120.0',
          },
          entries: [],
        },
      };

      // Act
      const result = detectFormat(data);

      // Assert
      expect(result.format).toBe('har');
      expect(result.version).toBe('1.2');
      expect(result.confidence).toBe('high');
    });

    it('should detect HAR with entries', () => {
      // Arrange
      const data = {
        log: {
          version: '1.2',
          creator: {
            name: 'Firefox',
            version: '121.0',
          },
          entries: [
            {
              startedDateTime: '2026-01-07T10:00:00.000Z',
              time: 150,
              request: {
                method: 'GET',
                url: 'https://api.example.com/health',
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: [],
                queryString: [],
                headersSize: -1,
                bodySize: -1,
              },
              response: {
                status: 200,
                statusText: 'OK',
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: [],
                content: {
                  size: 42,
                  mimeType: 'application/json',
                },
                redirectURL: '',
                headersSize: -1,
                bodySize: -1,
              },
              cache: {},
              timings: {
                send: 1,
                wait: 100,
                receive: 49,
              },
            },
          ],
        },
      };

      // Act
      const result = detectFormat(data);

      // Assert
      expect(result.format).toBe('har');
      expect(result.confidence).toBe('high');
    });

    it('should detect HAR 1.1 with medium confidence', () => {
      // Arrange
      const data = {
        log: {
          version: '1.1',
          creator: {
            name: 'Old Tool',
            version: '1.0',
          },
          entries: [],
        },
      };

      // Act
      const result = detectFormat(data);

      // Assert
      expect(result.format).toBe('har');
      expect(result.version).toBe('1.1');
      expect(result.confidence).toBe('medium');
    });
  });

  describe('when input is not a recognized format', () => {
    it('should throw for null input', () => {
      // Act & Assert
      expect(() => detectFormat(null)).toThrow(ImportError);
      expect(() => detectFormat(null)).toThrow('Input is not a valid JSON object');
    });

    it('should throw for primitive input', () => {
      // Act & Assert
      expect(() => detectFormat('string')).toThrow(ImportError);
      expect(() => detectFormat(123)).toThrow(ImportError);
      expect(() => detectFormat(true)).toThrow(ImportError);
    });

    it('should throw for empty object', () => {
      // Act & Assert
      expect(() => detectFormat({})).toThrow(ImportError);
      expect(() => detectFormat({})).toThrow('Unable to detect format');
    });

    it('should throw for array', () => {
      // Act & Assert
      expect(() => detectFormat([])).toThrow(ImportError);
    });

    it('should throw for random JSON object', () => {
      // Arrange
      const data = {
        name: 'Something',
        items: [1, 2, 3],
      };

      // Act & Assert
      expect(() => detectFormat(data)).toThrow(ImportError);
      expect(() => detectFormat(data)).toThrow('Unable to detect format');
    });
  });
});

describe('detectFormatFromString', () => {
  describe('when string is valid JSON', () => {
    it('should parse and detect Postman format', () => {
      // Arrange
      const json = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      });

      // Act
      const result = detectFormatFromString(json);

      // Assert
      expect(result.format).toBe('postman');
    });

    it('should parse and detect HAR format', () => {
      // Arrange
      const json = JSON.stringify({
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          entries: [],
        },
      });

      // Act
      const result = detectFormatFromString(json);

      // Assert
      expect(result.format).toBe('har');
    });
  });

  describe('when string is invalid JSON', () => {
    it('should throw ImportError with INVALID_JSON code', () => {
      // Arrange
      const invalidJson = '{ not valid json }';

      // Act & Assert
      expect(() => detectFormatFromString(invalidJson)).toThrow(ImportError);
      try {
        detectFormatFromString(invalidJson);
      } catch (error) {
        expect((error as ImportError).code).toBe('INVALID_JSON');
        expect((error as ImportError).message).toContain('Invalid JSON');
      }
    });

    it('should include parse error details', () => {
      // Arrange
      const invalidJson = '{"name": }'; // Missing value

      // Act & Assert
      expect(() => detectFormatFromString(invalidJson)).toThrow(ImportError);
    });
  });
});

describe('getFormatDisplayName', () => {
  it('should return correct display name for postman', () => {
    expect(getFormatDisplayName('postman')).toBe('Postman Collection');
  });

  it('should return correct display name for insomnia', () => {
    expect(getFormatDisplayName('insomnia')).toBe('Insomnia Export');
  });

  it('should return correct display name for har', () => {
    expect(getFormatDisplayName('har')).toBe('HAR Archive');
  });
});

describe('getFormatFileExtension', () => {
  it('should return correct extension for postman', () => {
    expect(getFormatFileExtension('postman')).toBe('.postman_collection.json');
  });

  it('should return correct extension for insomnia', () => {
    expect(getFormatFileExtension('insomnia')).toBe('.json');
  });

  it('should return correct extension for har', () => {
    expect(getFormatFileExtension('har')).toBe('.har');
  });
});
