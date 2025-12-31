/**
 * Platform-specific path resolution for global workspace
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { APP_NAME } from './constants.js';

/**
 * Get the global workspace path based on the current platform.
 *
 * Platform-specific paths:
 * - Linux: $XDG_CONFIG_HOME/unireq or ~/.config/unireq
 * - macOS: ~/Library/Application Support/unireq
 * - Windows: %APPDATA%\unireq
 *
 * @returns Absolute path to the global workspace directory, or null if HOME is not set
 */
export function getGlobalWorkspacePath(): string | null {
  const home = homedir();

  // homedir() returns empty string if HOME is not set
  if (!home) {
    return null;
  }

  const platform = process.platform;

  switch (platform) {
    case 'win32': {
      // Windows: use APPDATA environment variable
      const appData = process.env['APPDATA'];
      if (appData) {
        return join(appData, APP_NAME);
      }
      // Fallback to home directory
      return join(home, 'AppData', 'Roaming', APP_NAME);
    }

    case 'darwin': {
      // macOS: use ~/Library/Application Support
      return join(home, 'Library', 'Application Support', APP_NAME);
    }

    default: {
      // Linux and other Unix-like systems: use XDG_CONFIG_HOME or ~/.config
      const xdgConfig = process.env['XDG_CONFIG_HOME'];
      if (xdgConfig) {
        return join(xdgConfig, APP_NAME);
      }
      return join(home, '.config', APP_NAME);
    }
  }
}
