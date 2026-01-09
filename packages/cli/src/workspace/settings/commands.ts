/**
 * Settings command handlers for REPL
 * View, get, set, and reset UI settings
 */

import { consola } from 'consola';
import type { Command, CommandHandler } from '../../repl/types.js';
import { getAllSettings, getSetting, resetAllSettings, resetSetting, setSetting } from './store.js';
import { isValidSettingKey, SETTING_KEYS, type SettingKey } from './types.js';

/**
 * Find the closest matching key for a typo
 */
function findSimilarKey(input: string): SettingKey | undefined {
  const lower = input.toLowerCase();
  for (const key of SETTING_KEYS) {
    // Check if input is a substring or prefix
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return key;
    }
    // Check first few characters match (at least 3)
    const prefix = lower.slice(0, Math.min(3, lower.length));
    if (key.toLowerCase().startsWith(prefix)) {
      return key;
    }
  }
  return undefined;
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

/**
 * Show all settings with source tracking
 */
function showAllSettings(): void {
  consola.info('UI Settings:');
  consola.log('');

  const settings = getAllSettings();

  // Group by category
  const categories: Record<string, typeof settings> = {
    Theme: settings.filter((s) => s.key === 'theme'),
    Colors: settings.filter((s) => s.key.startsWith('colors.')),
    'Syntax Highlighting': settings.filter((s) => s.key.startsWith('syntax.')),
    'External Commands': settings.filter((s) => s.key === 'externalColors'),
  };

  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue;

    consola.log(`  ${category}:`);
    for (const item of items) {
      const keyDisplay = item.key.includes('.') ? item.key.split('.')[1] : item.key;
      const sourceIndicator = item.source !== 'built-in' ? ` (${item.source})` : '';
      consola.log(`    ${keyDisplay}: ${formatValue(item.value)}${sourceIndicator}`);
    }
    consola.log('');
  }

  const customCount = settings.filter((s) => s.source !== 'built-in').length;
  if (customCount > 0) {
    consola.info(`Customized: ${customCount} setting${customCount === 1 ? '' : 's'}`);
  }
}

/**
 * Show single setting with detailed info
 */
function showSingleSetting(key: SettingKey): void {
  const setting = getSetting(key);
  consola.log(`${key} = ${formatValue(setting.value)}`);
  consola.log(`  Source: ${setting.source}`);
}

/**
 * Main settings command handler
 */
export const settingsHandler: CommandHandler = async (args, state) => {
  const subcommand = args[0]?.toLowerCase();

  // No subcommand: show all
  if (!subcommand) {
    showAllSettings();
    return;
  }

  // Handle subcommands
  switch (subcommand) {
    case 'configure':
    case 'config': {
      // Set flag to trigger settings modal in Ink UI
      state.pendingModal = 'settingsConfig';
      return;
    }

    case 'get': {
      const key = args[1];
      if (!key) {
        consola.warn('Usage: settings get <key>');
        consola.info(`Valid keys: ${SETTING_KEYS.join(', ')}`);
        return;
      }

      if (!isValidSettingKey(key)) {
        const similar = findSimilarKey(key);
        consola.error(`Unknown setting: ${key}`);
        if (similar) {
          consola.info(`Did you mean: ${similar}?`);
        } else {
          consola.info(`Valid keys: ${SETTING_KEYS.join(', ')}`);
        }
        return;
      }

      showSingleSetting(key);
      return;
    }

    case 'set': {
      const key = args[1];
      const value = args[2];

      if (!key || value === undefined) {
        consola.warn('Usage: settings set <key> <value>');
        consola.info(`Valid keys: ${SETTING_KEYS.join(', ')}`);
        return;
      }

      if (!isValidSettingKey(key)) {
        const similar = findSimilarKey(key);
        consola.error(`Unknown setting: ${key}`);
        if (similar) {
          consola.info(`Did you mean: ${similar}?`);
        }
        return;
      }

      const error = setSetting(key, value);
      if (error) {
        consola.error(`Invalid value for ${key}: ${error}`);
        return;
      }

      consola.success(`Set ${key} = ${value} (saved to config)`);
      return;
    }

    case 'reset': {
      const key = args[1];

      if (!key) {
        // Reset all settings
        resetAllSettings();
        consola.success('Reset all settings to defaults');
        return;
      }

      // Reset single key
      if (!isValidSettingKey(key)) {
        const similar = findSimilarKey(key);
        consola.error(`Unknown setting: ${key}`);
        if (similar) {
          consola.info(`Did you mean: ${similar}?`);
        }
        return;
      }

      const error = resetSetting(key);
      if (error) {
        consola.error(error);
        return;
      }

      const newValue = getSetting(key);
      consola.success(`Reset ${key} (now: ${formatValue(newValue.value)} from ${newValue.source})`);
      return;
    }

    default: {
      // Treat as key name for get (shorthand)
      const originalArg = args[0];
      if (originalArg && isValidSettingKey(originalArg)) {
        showSingleSetting(originalArg);
        return;
      }

      const similar = findSimilarKey(subcommand);
      consola.error(`Unknown subcommand or key: ${subcommand}`);
      if (similar) {
        consola.info(`Did you mean: settings get ${similar}?`);
      } else {
        consola.info('Usage: settings [get|set|reset|configure] [<key>] [<value>]');
      }
    }
  }
};

/**
 * Create settings command
 */
export function createSettingsCommand(): Command {
  return {
    name: 'settings',
    description: 'View and manage UI settings',
    handler: settingsHandler,
    helpText: `Usage: settings [get|set|reset|configure] [<key>] [<value>]

Subcommands:
  settings              Show all settings
  settings get <key>    Show single setting
  settings set <key> <value>  Set setting (saved to config)
  settings reset [<key>]      Reset to default
  settings configure    Open interactive settings modal (Ctrl+K)

Settings:
  theme           Color theme: dark, light, auto
  colors.primary  Primary accent color
  colors.success  Success status color
  colors.error    Error status color
  colors.warning  Warning color
  colors.muted    Muted/secondary text
  syntax.json     Syntax highlight JSON responses
  syntax.headers  Colorize HTTP headers
  externalColors  Preserve colors from external commands (jq, etc.)

Color Values:
  Color names: cyan, red, green, yellow, blue, magenta, white, gray, etc.
  Hex colors: #fff, #ff0000, etc.

Examples:
  settings                    Show all settings
  settings get theme          Get current theme
  settings set theme dark     Set dark theme
  settings set colors.primary blue  Change primary color
  settings set externalColors false  Disable external colors
  settings reset theme        Reset theme to default
  settings reset              Reset all to defaults`,
  };
}
