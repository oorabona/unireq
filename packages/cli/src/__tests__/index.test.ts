import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../index.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

describe('@unireq/cli', () => {
  describe('VERSION', () => {
    it('should export version from package.json', () => {
      // Arrange
      const expectedVersion = pkg.version;

      // Act
      const version = VERSION;

      // Assert
      expect(version).toBe(expectedVersion);
      expect(typeof version).toBe('string');
      expect(version).toMatch(/^\d+\.\d+\.\d+/); // SemVer format
    });
  });
});
