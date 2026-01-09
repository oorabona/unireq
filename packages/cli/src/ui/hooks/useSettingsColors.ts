/**
 * Hook for accessing settings colors
 *
 * Provides a reactive way to get current color settings for UI components.
 * Uses an exhaustive, element-based color system.
 */

import { useMemo } from 'react';
import { getSetting } from '../../workspace/settings/store.js';
import type { ColorSettings } from '../../workspace/settings/types.js';

/**
 * Get current color settings as a typed object
 *
 * @returns Current color settings from store
 */
export function getColors(): ColorSettings {
  return {
    event: {
      command: getSetting('colors.event.command').value as string,
      result: getSetting('colors.event.result').value as string,
      error: getSetting('colors.event.error').value as string,
      notice: getSetting('colors.event.notice').value as string,
      meta: getSetting('colors.event.meta').value as string,
    },
    status: {
      '2xx': getSetting('colors.status.2xx').value as string,
      '3xx': getSetting('colors.status.3xx').value as string,
      '4xx': getSetting('colors.status.4xx').value as string,
      '5xx': getSetting('colors.status.5xx').value as string,
    },
    ui: {
      border: getSetting('colors.ui.border').value as string,
      prompt: getSetting('colors.ui.prompt').value as string,
      scrollbar: getSetting('colors.ui.scrollbar').value as string,
      muted: getSetting('colors.ui.muted').value as string,
    },
  };
}

/**
 * Hook to get current color settings
 *
 * Note: This hook returns current values but doesn't trigger re-renders
 * when settings change. Components that need dynamic updates should
 * pass colors as props from a parent that tracks settings state.
 *
 * @returns Current color settings
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const colors = useSettingsColors();
 *   return <Text color={colors.event.command}>Hello</Text>;
 * }
 * ```
 */
export function useSettingsColors(): ColorSettings {
  // Memoize to avoid recalculating on every render
  // Note: This won't update when settings change mid-session
  // For dynamic updates, pass colors as props from App level
  return useMemo(() => getColors(), []);
}

/**
 * Get color for HTTP status code using settings colors
 *
 * @param status HTTP status code
 * @param colors Color settings
 * @returns Appropriate color for the status
 */
export function getStatusColor(status: number, colors: ColorSettings): string {
  if (status >= 200 && status < 300) return colors.status['2xx'];
  if (status >= 300 && status < 400) return colors.status['3xx'];
  if (status >= 400 && status < 500) return colors.status['4xx'];
  if (status >= 500) return colors.status['5xx'];
  return colors.ui.muted;
}
