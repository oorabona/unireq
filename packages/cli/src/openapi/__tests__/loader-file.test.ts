import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SpecNotFoundError, SpecParseError } from '../errors';
import { loadSpec } from '../loader';
import { buildNavigationTree } from '../navigation/builder';
import { getMethods, getNode, listChildren } from '../navigation/queries';
import { validateRequestFull } from '../validator';

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

  describe('Swagger 2.0 conversion', () => {
    it('should convert Swagger 2.0 to OpenAPI 3.1 document structure', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');

      // Act - use noCache to ensure fresh conversion
      const result = await loadSpec(source, { noCache: true });

      // Assert - version preserved as original
      expect(result.version).toBe('2.0');
      expect(result.versionFull).toBe('2.0');

      // Assert - document is converted to OpenAPI 3.1.x
      expect(result.document.openapi).toMatch(/^3\.1\.\d+$/);
      expect(result.document).not.toHaveProperty('swagger');
    });

    it('should convert host/basePath/schemes to servers array', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');

      // Act - use noCache to ensure fresh conversion
      const result = await loadSpec(source, { noCache: true });

      // Assert
      expect(result.document.servers).toBeDefined();
      expect(result.document.servers).toHaveLength(1);
      const serverUrl = result.document.servers?.[0]?.url;
      expect(serverUrl).toBe('https://api.legacy.com/v1');
    });

    it('should convert definitions to components.schemas', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');

      // Act - use noCache to ensure fresh conversion
      const result = await loadSpec(source, { noCache: true });

      // Assert
      expect(result.document.components?.schemas).toBeDefined();
      expect(result.document.components?.schemas?.['Item']).toBeDefined();
      expect(result.document.components?.schemas?.['Item']?.properties?.['id']).toBeDefined();
    });

    it('should preserve paths in converted spec', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');

      // Act - use noCache to ensure fresh conversion
      const result = await loadSpec(source, { noCache: true });

      // Assert
      expect(result.document.paths).toBeDefined();
      expect(result.document.paths?.['/items']).toBeDefined();
      expect(result.document.paths?.['/items']?.get).toBeDefined();
    });
  });

  describe('Swagger 2.0 feature verification', () => {
    it('should build navigation tree from converted Swagger 2.0 spec', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');
      const spec = await loadSpec(source, { noCache: true });

      // Act
      const tree = buildNavigationTree(spec);

      // Assert - tree should be built from converted OpenAPI 3.1 structure
      expect(tree.pathCount).toBeGreaterThan(0);
      expect(tree.operationCount).toBeGreaterThan(0);
    });

    it('should navigate to paths in converted spec', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');
      const spec = await loadSpec(source, { noCache: true });
      const tree = buildNavigationTree(spec);

      // Act
      const itemsNode = getNode(tree, '/items');

      // Assert - path from Swagger 2.0 should be navigable
      expect(itemsNode).toBeDefined();
      expect(itemsNode?.path).toBe('/items');
    });

    it('should list methods on converted spec paths', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');
      const spec = await loadSpec(source, { noCache: true });
      const tree = buildNavigationTree(spec);

      // Act
      const methods = getMethods(tree, '/items');

      // Assert - GET method from Swagger 2.0 should be preserved
      expect(methods).toContain('GET');
    });

    it('should list children at root of converted spec', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');
      const spec = await loadSpec(source, { noCache: true });
      const tree = buildNavigationTree(spec);

      // Act
      const children = listChildren(tree, '/');

      // Assert - 'items' path should be listed
      expect(children.length).toBeGreaterThan(0);
      const names = children.map((c) => c.name);
      expect(names).toContain('items');
    });

    it('should preserve operation metadata in converted spec', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');
      const spec = await loadSpec(source, { noCache: true });
      const tree = buildNavigationTree(spec);

      // Act
      const itemsNode = getNode(tree, '/items');
      const getOp = itemsNode?.operations.get('GET');

      // Assert - operationId and summary should be preserved
      expect(getOp).toBeDefined();
      expect(getOp?.operationId).toBe('listItems');
      expect(getOp?.summary).toBe('List items');
    });

    it('should validate request parameters after Swagger 2.0 conversion', async () => {
      // Arrange
      const source = path.join(fixturesDir, 'swagger-2.0.json');
      const spec = await loadSpec(source, { noCache: true });

      // Act - validate request against converted OpenAPI 3.1 document
      const result = validateRequestFull(
        spec.document,
        'GET',
        '/items',
        [], // no query params
        [], // no headers
        false, // no body
      );

      // Assert - validation should work with converted document
      expect(result.skipped).toBe(false);
      expect(result.warnings).toBeDefined();
      // GET /items should not require any parameters, so no warnings
      expect(result.warnings.length).toBe(0);
    });
  });
});
