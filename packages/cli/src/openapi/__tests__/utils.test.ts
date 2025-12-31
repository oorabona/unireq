import { describe, expect, it } from 'vitest';
import { detectFormat, detectVersion, isLocalhost, isSecureUrl, isUrl, resolvePath } from '../utils';

describe('isUrl', () => {
  it('should return true for https URLs', () => {
    // Arrange & Act & Assert
    expect(isUrl('https://api.example.com/spec.json')).toBe(true);
    expect(isUrl('https://localhost:3000/openapi.yaml')).toBe(true);
  });

  it('should return true for http URLs', () => {
    // Arrange & Act & Assert
    expect(isUrl('http://localhost:3000/spec.json')).toBe(true);
    expect(isUrl('http://api.example.com/openapi.yaml')).toBe(true);
  });

  it('should return false for file paths', () => {
    // Arrange & Act & Assert
    expect(isUrl('./spec.yaml')).toBe(false);
    expect(isUrl('/absolute/path/spec.json')).toBe(false);
    expect(isUrl('relative/path/spec.yaml')).toBe(false);
    expect(isUrl('../parent/spec.json')).toBe(false);
  });

  it('should return false for other protocols', () => {
    // Arrange & Act & Assert
    expect(isUrl('file:///path/to/spec.json')).toBe(false);
    expect(isUrl('ftp://server.com/spec.yaml')).toBe(false);
  });
});

describe('isLocalhost', () => {
  it('should return true for localhost hostname', () => {
    // Arrange & Act & Assert
    expect(isLocalhost('http://localhost:3000/spec.json')).toBe(true);
    expect(isLocalhost('https://localhost/spec.yaml')).toBe(true);
    expect(isLocalhost('http://LOCALHOST:8080/api')).toBe(true);
  });

  it('should return true for 127.0.0.1', () => {
    // Arrange & Act & Assert
    expect(isLocalhost('http://127.0.0.1:3000/spec.json')).toBe(true);
    expect(isLocalhost('https://127.0.0.1/spec.yaml')).toBe(true);
  });

  it('should return true for IPv6 localhost', () => {
    // Arrange & Act & Assert
    expect(isLocalhost('http://[::1]:3000/spec.json')).toBe(true);
  });

  it('should return false for remote hosts', () => {
    // Arrange & Act & Assert
    expect(isLocalhost('http://api.example.com/spec.json')).toBe(false);
    expect(isLocalhost('https://petstore.swagger.io/v2/swagger.json')).toBe(false);
  });

  it('should return false for invalid URLs', () => {
    // Arrange & Act & Assert
    expect(isLocalhost('not-a-url')).toBe(false);
    expect(isLocalhost('./local-file.yaml')).toBe(false);
  });
});

describe('isSecureUrl', () => {
  it('should return true for HTTPS URLs', () => {
    // Arrange & Act & Assert
    expect(isSecureUrl('https://api.example.com/spec.json', false)).toBe(true);
    expect(isSecureUrl('https://localhost/spec.json', false)).toBe(true);
  });

  it('should return false for HTTP URLs to remote hosts', () => {
    // Arrange & Act & Assert
    expect(isSecureUrl('http://api.example.com/spec.json', false)).toBe(false);
    expect(isSecureUrl('http://api.example.com/spec.json', true)).toBe(false);
  });

  it('should return true for HTTP localhost when allowed', () => {
    // Arrange & Act & Assert
    expect(isSecureUrl('http://localhost:3000/spec.json', true)).toBe(true);
    expect(isSecureUrl('http://127.0.0.1:8080/spec.yaml', true)).toBe(true);
  });

  it('should return false for HTTP localhost when not allowed', () => {
    // Arrange & Act & Assert
    expect(isSecureUrl('http://localhost:3000/spec.json', false)).toBe(false);
    expect(isSecureUrl('http://127.0.0.1:8080/spec.yaml', false)).toBe(false);
  });

  it('should return false for invalid URLs', () => {
    // Arrange & Act & Assert
    expect(isSecureUrl('not-a-url', true)).toBe(false);
    expect(isSecureUrl('./local-file.yaml', false)).toBe(false);
  });
});

describe('detectVersion', () => {
  describe('OpenAPI 3.1.x', () => {
    it('should detect 3.1.0', () => {
      // Arrange
      const doc = { openapi: '3.1.0', info: { title: 'Test' } };

      // Act
      const result = detectVersion(doc);

      // Assert
      expect(result.version).toBe('3.1');
      expect(result.versionFull).toBe('3.1.0');
    });

    it('should detect 3.1.1', () => {
      // Arrange
      const doc = { openapi: '3.1.1', info: { title: 'Test' } };

      // Act
      const result = detectVersion(doc);

      // Assert
      expect(result.version).toBe('3.1');
      expect(result.versionFull).toBe('3.1.1');
    });
  });

  describe('OpenAPI 3.0.x', () => {
    it('should detect 3.0.0', () => {
      // Arrange
      const doc = { openapi: '3.0.0', info: { title: 'Test' } };

      // Act
      const result = detectVersion(doc);

      // Assert
      expect(result.version).toBe('3.0');
      expect(result.versionFull).toBe('3.0.0');
    });

    it('should detect 3.0.3', () => {
      // Arrange
      const doc = { openapi: '3.0.3', info: { title: 'Test' } };

      // Act
      const result = detectVersion(doc);

      // Assert
      expect(result.version).toBe('3.0');
      expect(result.versionFull).toBe('3.0.3');
    });
  });

  describe('Swagger 2.0', () => {
    it('should detect 2.0', () => {
      // Arrange
      const doc = { swagger: '2.0', info: { title: 'Test' } };

      // Act
      const result = detectVersion(doc);

      // Assert
      expect(result.version).toBe('2.0');
      expect(result.versionFull).toBe('2.0');
    });
  });

  describe('error cases', () => {
    it('should throw for missing version field', () => {
      // Arrange
      const doc = { info: { title: 'Test' } };

      // Act & Assert
      expect(() => detectVersion(doc)).toThrow('Not a valid OpenAPI specification');
    });

    it('should throw for null document', () => {
      // Arrange & Act & Assert
      expect(() => detectVersion(null)).toThrow('Document is not an object');
    });

    it('should throw for non-object document', () => {
      // Arrange & Act & Assert
      expect(() => detectVersion('not an object')).toThrow('Document is not an object');
      expect(() => detectVersion(42)).toThrow('Document is not an object');
    });

    it('should throw for unsupported Swagger version', () => {
      // Arrange
      const doc = { swagger: '1.2', info: { title: 'Test' } };

      // Act & Assert
      expect(() => detectVersion(doc)).toThrow('Unsupported Swagger version');
    });

    it('should throw for unsupported OpenAPI version', () => {
      // Arrange
      const doc = { openapi: '2.0.0', info: { title: 'Test' } };

      // Act & Assert
      expect(() => detectVersion(doc)).toThrow('Unsupported OpenAPI version');
    });
  });
});

describe('detectFormat', () => {
  it('should detect JSON from extension', () => {
    // Arrange & Act & Assert
    expect(detectFormat('./spec.json')).toBe('json');
    expect(detectFormat('/path/to/api.JSON')).toBe('json');
    expect(detectFormat('https://api.example.com/openapi.json')).toBe('json');
  });

  it('should detect YAML from .yaml extension', () => {
    // Arrange & Act & Assert
    expect(detectFormat('./spec.yaml')).toBe('yaml');
    expect(detectFormat('/path/to/api.YAML')).toBe('yaml');
    expect(detectFormat('https://api.example.com/openapi.yaml')).toBe('yaml');
  });

  it('should detect YAML from .yml extension', () => {
    // Arrange & Act & Assert
    expect(detectFormat('./spec.yml')).toBe('yaml');
    expect(detectFormat('/path/to/api.YML')).toBe('yaml');
  });

  it('should detect YAML from .openapi extension', () => {
    // Arrange & Act & Assert
    expect(detectFormat('./api.openapi')).toBe('yaml');
  });

  it('should default to YAML for unknown extensions', () => {
    // Arrange & Act & Assert
    expect(detectFormat('./spec')).toBe('yaml');
    expect(detectFormat('./spec.txt')).toBe('yaml');
    expect(detectFormat('https://api.example.com/openapi')).toBe('yaml');
  });
});

describe('resolvePath', () => {
  describe('URL resolution', () => {
    it('should resolve relative path against URL', () => {
      // Arrange & Act
      const result = resolvePath('https://api.example.com/specs/main.yaml', './schemas/user.yaml');

      // Assert
      expect(result).toBe('https://api.example.com/specs/schemas/user.yaml');
    });

    it('should resolve parent path against URL', () => {
      // Arrange & Act
      const result = resolvePath('https://api.example.com/specs/v1/main.yaml', '../common.yaml');

      // Assert
      expect(result).toBe('https://api.example.com/specs/common.yaml');
    });

    it('should resolve absolute path against URL', () => {
      // Arrange & Act
      const result = resolvePath('https://api.example.com/specs/main.yaml', '/other/spec.yaml');

      // Assert
      expect(result).toBe('https://api.example.com/other/spec.yaml');
    });
  });

  describe('file path resolution', () => {
    it('should resolve relative path against file', () => {
      // Arrange & Act
      const result = resolvePath('./specs/main.yaml', './schemas/user.yaml');

      // Assert
      expect(result).toBe('specs/schemas/user.yaml');
    });

    it('should resolve parent path against file', () => {
      // Arrange & Act
      const result = resolvePath('./specs/v1/main.yaml', '../common.yaml');

      // Assert
      expect(result).toBe('specs/common.yaml');
    });
  });
});
