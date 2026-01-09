/**
 * Types for UI settings and preferences
 */

/**
 * Theme options
 */
export type ThemeMode = 'dark' | 'light' | 'auto';

/**
 * Event type colors - for transcript events
 */
export interface EventColors {
  /** Command input ("> GET /users") */
  command: string;
  /** Successful response display */
  result: string;
  /** Error messages ("✗ Connection failed") */
  error: string;
  /** Notice/warning messages ("⚠ Rate limited") */
  notice: string;
  /** Meta output (help, workspace info) */
  meta: string;
}

/**
 * HTTP status code colors
 */
export interface StatusColors {
  /** 2xx success responses */
  '2xx': string;
  /** 3xx redirect responses */
  '3xx': string;
  /** 4xx client error responses */
  '4xx': string;
  /** 5xx server error responses */
  '5xx': string;
}

/**
 * UI element colors
 */
export interface UiColors {
  /** Modal and box borders */
  border: string;
  /** Command prompt symbol */
  prompt: string;
  /** Scrollbar and accents */
  scrollbar: string;
  /** Muted/secondary text */
  muted: string;
}

/**
 * Complete color configuration - exhaustive, element-based
 */
export interface ColorSettings {
  /** Event type colors */
  event: EventColors;
  /** HTTP status colors */
  status: StatusColors;
  /** UI element colors */
  ui: UiColors;
}

/**
 * Syntax highlighting settings
 */
export interface SyntaxSettings {
  /** Syntax highlight JSON responses */
  json: boolean;
  /** Colorize HTTP headers */
  headers: boolean;
}

/**
 * Complete settings configuration
 */
export interface SettingsConfig {
  /** Color theme */
  theme: ThemeMode;
  /** Color palette */
  colors: ColorSettings;
  /** Syntax highlighting options */
  syntax: SyntaxSettings;
  /** Preserve ANSI colors from external commands */
  externalColors: boolean;
}

/**
 * Source of a setting value
 */
export type SettingSource = 'built-in' | 'config' | 'session';

/**
 * A resolved setting value with its source
 */
export interface ResolvedSetting<T = unknown> {
  key: string;
  value: T;
  source: SettingSource;
}

/**
 * Built-in default settings
 */
export const DEFAULT_SETTINGS: SettingsConfig = {
  theme: 'auto',
  colors: {
    event: {
      command: 'cyan',
      result: 'green',
      error: 'red',
      notice: 'yellow',
      meta: 'white',
    },
    status: {
      '2xx': 'green',
      '3xx': 'yellow',
      '4xx': 'red',
      '5xx': 'magenta',
    },
    ui: {
      border: 'cyan',
      prompt: 'cyan',
      scrollbar: 'cyan',
      muted: 'gray',
    },
  },
  syntax: {
    json: true,
    headers: true,
  },
  externalColors: true,
};

/**
 * All valid setting keys (dot notation)
 */
export const SETTING_KEYS = [
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
] as const;

/**
 * Type for setting key
 */
export type SettingKey = (typeof SETTING_KEYS)[number];

/**
 * Check if a string is a valid setting key
 */
export function isValidSettingKey(key: string): key is SettingKey {
  return SETTING_KEYS.includes(key as SettingKey);
}

/**
 * Valid theme values
 */
export const THEME_VALUES = ['dark', 'light', 'auto'] as const;

/**
 * Check if a string is a valid theme value
 */
export function isValidTheme(value: string): value is ThemeMode {
  return THEME_VALUES.includes(value as ThemeMode);
}

/**
 * Common color names accepted
 */
export const COLOR_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  'grey',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const;

/**
 * Check if a string is a valid color name
 */
export function isValidColorName(value: string): boolean {
  return COLOR_NAMES.includes(value as (typeof COLOR_NAMES)[number]);
}

/**
 * Check if a string is a valid hex color
 */
export function isValidHexColor(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

/**
 * Check if a string is a valid color (name or hex)
 */
export function isValidColor(value: string): boolean {
  return isValidColorName(value) || isValidHexColor(value);
}
