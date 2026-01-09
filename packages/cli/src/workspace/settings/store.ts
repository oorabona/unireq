/**
 * Settings store with session and persistent storage
 *
 * Follows the same pattern as defaults/source-tracker.ts
 */

import type { GlobalSettingsConfig } from '../config/types.js';
import { loadGlobalConfig, saveGlobalConfig } from '../global-config.js';
import {
  DEFAULT_SETTINGS,
  isValidColor,
  isValidSettingKey,
  isValidTheme,
  type ResolvedSetting,
  type SettingKey,
} from './types.js';

/**
 * Session-level setting overrides (cleared on exit)
 */
const sessionOverrides: Partial<Record<SettingKey, unknown>> = {};

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    if (current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) {
    current[lastPart] = value;
  }
}

/**
 * Delete a nested value from an object using dot notation
 */
function deleteNestedValue(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    if (current[part] === undefined || typeof current[part] !== 'object') {
      return; // Path doesn't exist
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) {
    delete current[lastPart];
  }
}

/**
 * Load settings from persistent config
 */
function loadPersistedSettings(): GlobalSettingsConfig {
  const config = loadGlobalConfig();
  return config.settings ?? {};
}

/**
 * Save settings to persistent config
 */
function savePersistedSettings(settings: GlobalSettingsConfig): void {
  const config = loadGlobalConfig();
  config.settings = settings;
  saveGlobalConfig(config);
}

/**
 * Get a setting value with source tracking
 *
 * Resolution order:
 * 1. Session overrides (highest priority)
 * 2. Persistent config
 * 3. Built-in defaults
 */
export function getSetting(key: SettingKey): ResolvedSetting {
  // Check session first
  if (key in sessionOverrides) {
    return {
      key,
      value: sessionOverrides[key],
      source: 'session',
    };
  }

  // Check persistent config
  const persisted = loadPersistedSettings();
  const persistedValue = getNestedValue(persisted as unknown as Record<string, unknown>, key);
  if (persistedValue !== undefined) {
    return {
      key,
      value: persistedValue,
      source: 'config',
    };
  }

  // Fall back to defaults
  const defaultValue = getNestedValue(DEFAULT_SETTINGS as unknown as Record<string, unknown>, key);
  return {
    key,
    value: defaultValue,
    source: 'built-in',
  };
}

/**
 * Get all settings with their sources
 */
export function getAllSettings(): ResolvedSetting[] {
  const keys: SettingKey[] = [
    'theme',
    // Event colors
    'colors.event.command',
    'colors.event.result',
    'colors.event.error',
    'colors.event.notice',
    'colors.event.meta',
    // Status colors
    'colors.status.2xx',
    'colors.status.3xx',
    'colors.status.4xx',
    'colors.status.5xx',
    // UI colors
    'colors.ui.border',
    'colors.ui.prompt',
    'colors.ui.scrollbar',
    'colors.ui.muted',
    // Syntax
    'syntax.json',
    'syntax.headers',
    'externalColors',
  ];

  return keys.map((key) => getSetting(key));
}

/**
 * Validate a setting value for a given key
 */
function validateSettingValue(key: SettingKey, value: unknown): { valid: boolean; error?: string } {
  switch (key) {
    case 'theme':
      if (typeof value !== 'string' || !isValidTheme(value)) {
        return { valid: false, error: 'Must be: dark, light, or auto' };
      }
      return { valid: true };

    // Event colors
    case 'colors.event.command':
    case 'colors.event.result':
    case 'colors.event.error':
    case 'colors.event.notice':
    case 'colors.event.meta':
    // Status colors
    case 'colors.status.2xx':
    case 'colors.status.3xx':
    case 'colors.status.4xx':
    case 'colors.status.5xx':
    // UI colors
    case 'colors.ui.border':
    case 'colors.ui.prompt':
    case 'colors.ui.scrollbar':
    case 'colors.ui.muted':
      if (typeof value !== 'string' || !isValidColor(value)) {
        return { valid: false, error: 'Must be a color name (cyan, red, etc.) or hex (#fff)' };
      }
      return { valid: true };

    case 'syntax.json':
    case 'syntax.headers':
    case 'externalColors':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return { valid: false, error: 'Must be: true or false' };
      }
      return { valid: true };

    default:
      return { valid: false, error: 'Unknown setting key' };
  }
}

/**
 * Convert string value to appropriate type
 */
function coerceValue(key: SettingKey, value: string): unknown {
  // Boolean settings
  if (key === 'syntax.json' || key === 'syntax.headers' || key === 'externalColors') {
    return value === 'true';
  }
  // Everything else is a string
  return value;
}

/**
 * Set a setting value (persists to config)
 *
 * @returns Error message if invalid, undefined if successful
 */
export function setSetting(key: string, value: string): string | undefined {
  if (!isValidSettingKey(key)) {
    return `Unknown setting: ${key}`;
  }

  const coercedValue = coerceValue(key, value);
  const validation = validateSettingValue(key, coercedValue);

  if (!validation.valid) {
    return validation.error;
  }

  // Save to persistent config
  const persisted = loadPersistedSettings();
  setNestedValue(persisted as unknown as Record<string, unknown>, key, coercedValue);
  savePersistedSettings(persisted);

  // Clear any session override
  delete sessionOverrides[key];

  return undefined;
}

/**
 * Set a session-only override (not persisted)
 */
export function setSessionSetting(key: string, value: string): string | undefined {
  if (!isValidSettingKey(key)) {
    return `Unknown setting: ${key}`;
  }

  const coercedValue = coerceValue(key, value);
  const validation = validateSettingValue(key, coercedValue);

  if (!validation.valid) {
    return validation.error;
  }

  sessionOverrides[key] = coercedValue;
  return undefined;
}

/**
 * Reset a specific setting to default (removes from config and session)
 */
export function resetSetting(key: string): string | undefined {
  if (!isValidSettingKey(key)) {
    return `Unknown setting: ${key}`;
  }

  // Clear session override
  delete sessionOverrides[key];

  // Remove from persistent config
  const persisted = loadPersistedSettings();
  deleteNestedValue(persisted as unknown as Record<string, unknown>, key);
  savePersistedSettings(persisted);

  return undefined;
}

/**
 * Reset all settings to defaults
 */
export function resetAllSettings(): void {
  // Clear all session overrides
  for (const key of Object.keys(sessionOverrides)) {
    delete sessionOverrides[key as SettingKey];
  }

  // Clear persistent settings
  savePersistedSettings({});
}

/**
 * Clear session overrides only (keep persistent settings)
 */
export function clearSessionSettings(): void {
  for (const key of Object.keys(sessionOverrides)) {
    delete sessionOverrides[key as SettingKey];
  }
}

/**
 * Get the current theme (resolved value)
 */
export function getTheme(): 'dark' | 'light' {
  const setting = getSetting('theme');
  const value = setting.value as string;

  if (value === 'auto') {
    // Detect system preference (default to dark for terminals)
    return 'dark';
  }

  return value as 'dark' | 'light';
}

/**
 * Check if external command colors should be preserved
 */
export function shouldPreserveExternalColors(): boolean {
  const setting = getSetting('externalColors');
  return setting.value as boolean;
}
