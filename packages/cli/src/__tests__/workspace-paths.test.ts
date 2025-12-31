/**
 * Tests for workspace global path resolution
 * Following AAA pattern for unit tests
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGlobalWorkspacePath } from '../workspace/paths.js';

// Mock node:os module
vi.mock('node:os', () => ({
  homedir: vi.fn(),
}));

describe('getGlobalWorkspacePath', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset mocks
    vi.mocked(homedir).mockReturnValue('/home/testuser');
    // Clear environment variables we care about
    delete process.env['XDG_CONFIG_HOME'];
    delete process.env['APPDATA'];
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    // Restore environment
    process.env = { ...originalEnv };
  });

  describe('when on Linux', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
    });

    it('should return XDG_CONFIG_HOME path when set', () => {
      // Arrange
      process.env['XDG_CONFIG_HOME'] = '/custom/config';

      // Act
      const result = getGlobalWorkspacePath();

      // Assert
      expect(result).toBe('/custom/config/unireq');
    });

    it('should return ~/.config/unireq when XDG_CONFIG_HOME is not set', () => {
      // Arrange
      vi.mocked(homedir).mockReturnValue('/home/testuser');

      // Act
      const result = getGlobalWorkspacePath();

      // Assert
      expect(result).toBe('/home/testuser/.config/unireq');
    });

    it('should handle empty XDG_CONFIG_HOME as unset', () => {
      // Arrange
      process.env['XDG_CONFIG_HOME'] = '';
      vi.mocked(homedir).mockReturnValue('/home/testuser');

      // Act
      const result = getGlobalWorkspacePath();

      // Assert
      // Empty string is falsy, so falls back to default
      expect(result).toBe('/home/testuser/.config/unireq');
    });
  });

  describe('when on macOS', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
    });

    it('should return ~/Library/Application Support/unireq', () => {
      // Arrange
      vi.mocked(homedir).mockReturnValue('/Users/dev');

      // Act
      const result = getGlobalWorkspacePath();

      // Assert
      expect(result).toBe('/Users/dev/Library/Application Support/unireq');
    });
  });

  describe('when on Windows', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });

    it('should return APPDATA path when set', () => {
      // Arrange
      process.env['APPDATA'] = 'C:\\Users\\dev\\AppData\\Roaming';

      // Act
      const result = getGlobalWorkspacePath();

      // Assert
      expect(result).toBe(join('C:\\Users\\dev\\AppData\\Roaming', 'unireq'));
    });

    it('should fallback to home directory when APPDATA is not set', () => {
      // Arrange
      vi.mocked(homedir).mockReturnValue('C:\\Users\\dev');
      delete process.env['APPDATA'];

      // Act
      const result = getGlobalWorkspacePath();

      // Assert
      expect(result).toBe(join('C:\\Users\\dev', 'AppData', 'Roaming', 'unireq'));
    });
  });

  describe('when HOME is not set', () => {
    it('should return null when homedir returns empty string', () => {
      // Arrange
      vi.mocked(homedir).mockReturnValue('');
      Object.defineProperty(process, 'platform', { value: 'linux' });

      // Act
      const result = getGlobalWorkspacePath();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('when on unknown platform', () => {
    it('should use Linux-style paths as default', () => {
      // Arrange
      Object.defineProperty(process, 'platform', { value: 'freebsd' });
      vi.mocked(homedir).mockReturnValue('/home/user');

      // Act
      const result = getGlobalWorkspacePath();

      // Assert
      expect(result).toBe('/home/user/.config/unireq');
    });
  });
});
