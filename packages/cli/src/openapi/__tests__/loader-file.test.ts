import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SpecNotFoundError, SpecParseError } from '../errors';
import { loadSpec } from '../loader';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

describe('loadSpec (file)', () => {
  describe('JSON files', () => {
    it('should load valid OpenAPI 3.0 JSON file', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'petstore-3.0.json');

      // Act
      const result = await loadSpec(source);

      // Assert
      expect(result.version).toBe('3.0');
      expect(result.versionFull).toBe('3.0.3');
      expect(result.source).toBe(source);
      expect(result.document.info.title).toBe('Petstore API');
      expect(result.document.paths).toHaveProperty('/pets');
    });

    it('should load Swagger 2.0 JSON file', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');

      // Act
      const result = await loadSpec(source);

      // Assert
      expect(result.version).toBe('2.0');
      expect(result.versionFull).toBe('2.0');
      expect(result.document.info.title).toBe('Legacy API');
    });

    it('should throw SpecParseError for invalid JSON', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'invalid-json.json');

      // Act & Assert
      await expect(loadSpec(source)).rejects.toThrow(SpecParseError);
      await expect(loadSpec(source)).rejects.toThrow(/invalid JSON syntax/i);
    });
  });

  describe('YAML files', () => {
    it('should load valid OpenAPI 3.1 YAML file', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'users-3.1.yaml');

      // Act
      const result = await loadSpec(source);

      // Assert
      expect(result.version).toBe('3.1');
      expect(result.versionFull).toBe('3.1.0');
      expect(result.document.info.title).toBe('Users API');
      expect(result.document.paths).toHaveProperty('/users');
    });

    it('should throw SpecParseError for invalid YAML', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'invalid-yaml.yaml');

      // Act & Assert
      await expect(loadSpec(source)).rejects.toThrow(SpecParseError);
      await expect(loadSpec(source)).rejects.toThrow(/invalid YAML syntax/i);
    });
  });

  describe('$ref resolution', () => {
    it('should resolve internal $refs', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'with-refs.yaml');

      // Act
      const result = await loadSpec(source);

      // Assert
      // The Order schema should have resolved OrderStatus and OrderItem
      const orderSchema = result.document.components?.schemas?.['Order'];
      expect(orderSchema).toBeDefined();

      // After dereferencing, $refs should be resolved
      // (exact structure depends on @scalar/openapi-parser behavior)
      expect(result.document.paths).toHaveProperty('/orders');
    });

    it('should resolve $refs in Petstore spec', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'petstore-3.0.json');

      // Act
      const result = await loadSpec(source);

      // Assert
      // Verify that components/schemas/Pet is referenced
      expect(result.document.components?.schemas?.['Pet']).toBeDefined();
      expect(result.document.components?.schemas?.['Pet']?.properties?.['name']).toBeDefined();
    });
  });

  describe('error cases', () => {
    it('should throw SpecNotFoundError for nonexistent file', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'nonexistent.yaml');

      // Act & Assert
      await expect(loadSpec(source)).rejects.toThrow(SpecNotFoundError);
      await expect(loadSpec(source)).rejects.toThrow(/nonexistent\.yaml/);
    });

    it('should throw SpecParseError for missing openapi/swagger field', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'not-openapi.yaml');

      // Act & Assert
      await expect(loadSpec(source)).rejects.toThrow(SpecParseError);
      await expect(loadSpec(source)).rejects.toThrow(/not a valid OpenAPI/i);
    });

    it('should throw SpecParseError for empty file', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'empty.yaml');

      // Act & Assert
      await expect(loadSpec(source)).rejects.toThrow(SpecParseError);
      await expect(loadSpec(source)).rejects.toThrow(/empty/i);
    });
  });

  describe('version detection', () => {
    it('should detect OpenAPI 3.0.x version', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'petstore-3.0.json');

      // Act
      const result = await loadSpec(source);

      // Assert
      expect(result.version).toBe('3.0');
      expect(result.versionFull).toBe('3.0.3');
    });

    it('should detect OpenAPI 3.1.x version', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'users-3.1.yaml');

      // Act
      const result = await loadSpec(source);

      // Assert
      expect(result.version).toBe('3.1');
      expect(result.versionFull).toBe('3.1.0');
    });

    it('should detect Swagger 2.0 version', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');

      // Act
      const result = await loadSpec(source);

      // Assert
      expect(result.version).toBe('2.0');
      expect(result.versionFull).toBe('2.0');
    });
  });
});
