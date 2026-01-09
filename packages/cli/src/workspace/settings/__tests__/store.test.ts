/**
 * Settings store tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GlobalConfig } from '../../config/types.js';
import * as globalConfig from '../../global-config.js';
import {
  clearSessionSettings,
  getAllSettings,
  getSetting,
  getTheme,
  resetAllSettings,
  resetSetting,
  setSessionSetting,
  setSetting,
  shouldPreserveExternalColors,
} from '../store.js';

// Mock the global config functions
vi.mock('../../global-config.js', () => ({
  loadGlobalConfig: vi.fn(),
  saveGlobalConfig: vi.fn(),
}));

describe('Settings Store', () => {
  let mockConfig: GlobalConfig & { settings?: Record<string, unknown> };

  beforeEach(() => {
    mockConfig = {
      version: 1,
      activeWorkspace: undefined,
      activeProfile: undefined,
      settings: {},
    };

    vi.mocked(globalConfig.loadGlobalConfig).mockReturnValue(mockConfig);
    vi.mocked(globalConfig.saveGlobalConfig).mockImplementation((config) => {
      mockConfig = config as typeof mockConfig;
    });

    // Clear session settings between tests
    clearSessionSettings();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getSetting', () => {
    it('should return built-in default when no config exists', () => {
      const result = getSetting('theme');

      expect(result).toEqual({
        key: 'theme',
        value: 'auto',
        source: 'built-in',
      });
    });

    it('should return config value when set in persistent config', () => {
      mockConfig.settings = { theme: 'dark' };

      const result = getSetting('theme');

      expect(result).toEqual({
        key: 'theme',
        value: 'dark',
        source: 'config',
      });
    });

    it('should return session value when set (highest priority)', () => {
      mockConfig.settings = { theme: 'dark' };
      setSessionSetting('theme', 'light');

      const result = getSetting('theme');

      expect(result).toEqual({
        key: 'theme',
        value: 'light',
        source: 'session',
      });
    });

    it('should handle nested color settings', () => {
      mockConfig.settings = {
        colors: { event: { command: 'blue' } },
      };

      const result = getSetting('colors.event.command');

      expect(result).toEqual({
        key: 'colors.event.command',
        value: 'blue',
        source: 'config',
      });
    });

    it('should return built-in default for nested settings when not configured', () => {
      const result = getSetting('colors.status.2xx');

      expect(result).toEqual({
        key: 'colors.status.2xx',
        value: 'green',
        source: 'built-in',
      });
    });
  });

  describe('getAllSettings', () => {
    it('should return all settings with sources', () => {
      const results = getAllSettings();

      // 1 theme + 5 event + 4 status + 4 ui + 2 syntax + 1 externalColors = 17
      expect(results).toHaveLength(17);
      expect(results.map((r) => r.key)).toContain('theme');
      expect(results.map((r) => r.key)).toContain('colors.event.command');
      expect(results.map((r) => r.key)).toContain('colors.status.2xx');
      expect(results.map((r) => r.key)).toContain('colors.ui.border');
      expect(results.map((r) => r.key)).toContain('externalColors');
    });

    it('should mix sources correctly', () => {
      mockConfig.settings = { theme: 'light' };
      setSessionSetting('colors.event.command', 'blue');

      const results = getAllSettings();

      const themeResult = results.find((r) => r.key === 'theme');
      const commandResult = results.find((r) => r.key === 'colors.event.command');
      const statusResult = results.find((r) => r.key === 'colors.status.2xx');

      expect(themeResult?.source).toBe('config');
      expect(commandResult?.source).toBe('session');
      expect(statusResult?.source).toBe('built-in');
    });
  });

  describe('setSetting', () => {
    it('should persist valid theme setting', () => {
      const error = setSetting('theme', 'dark');

      expect(error).toBeUndefined();
      expect(mockConfig.settings?.theme).toBe('dark');
    });

    it('should reject invalid theme value', () => {
      const error = setSetting('theme', 'invalid');

      expect(error).toBe('Must be: dark, light, or auto');
      expect(mockConfig.settings?.theme).toBeUndefined();
    });

    it('should persist valid color setting', () => {
      const error = setSetting('colors.event.command', 'blue');

      expect(error).toBeUndefined();
      expect(
        ((mockConfig.settings?.colors as Record<string, unknown>)?.['event'] as Record<string, unknown>)?.['command'],
      ).toBe('blue');
    });

    it('should accept hex color values', () => {
      const error = setSetting('colors.ui.border', '#ff0000');

      expect(error).toBeUndefined();
      expect(
        ((mockConfig.settings?.colors as Record<string, unknown>)?.['ui'] as Record<string, unknown>)?.['border'],
      ).toBe('#ff0000');
    });

    it('should reject invalid color value', () => {
      const error = setSetting('colors.status.2xx', 'notacolor');

      expect(error).toBe('Must be a color name (cyan, red, etc.) or hex (#fff)');
    });

    it('should persist boolean settings', () => {
      const error = setSetting('syntax.json', 'false');

      expect(error).toBeUndefined();
      expect((mockConfig.settings?.syntax as Record<string, unknown>)?.['json']).toBe(false);
    });

    it('should reject unknown setting key', () => {
      const error = setSetting('unknown.key', 'value');

      expect(error).toBe('Unknown setting: unknown.key');
    });

    it('should clear session override when setting is persisted', () => {
      setSessionSetting('theme', 'light');
      setSetting('theme', 'dark');

      const result = getSetting('theme');

      expect(result.source).toBe('config');
      expect(result.value).toBe('dark');
    });
  });

  describe('setSessionSetting', () => {
    it('should set session-only override', () => {
      const error = setSessionSetting('theme', 'light');

      expect(error).toBeUndefined();

      const result = getSetting('theme');
      expect(result.source).toBe('session');
      expect(result.value).toBe('light');
    });

    it('should not persist to config', () => {
      setSessionSetting('theme', 'light');

      expect(mockConfig.settings?.theme).toBeUndefined();
    });

    it('should validate value', () => {
      const error = setSessionSetting('theme', 'invalid');

      expect(error).toBe('Must be: dark, light, or auto');
    });
  });

  describe('resetSetting', () => {
    it('should reset specific setting to default', () => {
      mockConfig.settings = { theme: 'dark' };

      const error = resetSetting('theme');

      expect(error).toBeUndefined();
      expect(mockConfig.settings?.theme).toBeUndefined();
    });

    it('should clear session override', () => {
      setSessionSetting('theme', 'light');

      resetSetting('theme');

      const result = getSetting('theme');
      expect(result.source).toBe('built-in');
    });

    it('should reject unknown key', () => {
      const error = resetSetting('unknown');

      expect(error).toBe('Unknown setting: unknown');
    });
  });

  describe('resetAllSettings', () => {
    it('should clear all session and config settings', () => {
      mockConfig.settings = { theme: 'dark', externalColors: false };
      setSessionSetting('colors.event.command', 'blue');

      resetAllSettings();

      const results = getAllSettings();
      expect(results.every((r) => r.source === 'built-in')).toBe(true);
    });
  });

  describe('getTheme', () => {
    it('should return dark when theme is auto (default for terminals)', () => {
      expect(getTheme()).toBe('dark');
    });

    it('should return explicit theme value', () => {
      mockConfig.settings = { theme: 'light' };

      expect(getTheme()).toBe('light');
    });
  });

  describe('shouldPreserveExternalColors', () => {
    it('should return true by default', () => {
      expect(shouldPreserveExternalColors()).toBe(true);
    });

    it('should return false when disabled', () => {
      mockConfig.settings = { externalColors: false };

      expect(shouldPreserveExternalColors()).toBe(false);
    });
  });
});
