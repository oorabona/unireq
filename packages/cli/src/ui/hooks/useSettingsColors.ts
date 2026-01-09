/**
 * Hook for accessing settings colors
 *
 * Provides a reactive way to get current color settings for UI components.
 * Uses an exhaustive, element-based color system.
 *
 * Components using this hook will automatically re-render when settings
 * are changed via the SettingsModal.
 */

// No React imports needed - we use useSettingsContext from our own module
import { getSetting } from '../../workspace/settings/store.js';
import type { ColorSettings } from '../../workspace/settings/types.js';
import { useSettingsContext } from '../contexts/SettingsContext.js';

/**
 * Get current color settings as a typed object (non-reactive)
 *
 * Use this for non-React code or when you need a one-time read.
 * For React components, prefer useSettingsColors() for reactivity.
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
 * Hook to get current color settings (reactive)
 *
 * This hook uses React Context to provide reactive updates.
 * When settings are saved via SettingsModal, all components
 * using this hook will automatically re-render with new colors.
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
  // Use context for reactive updates
  const { colors } = useSettingsContext();
  return colors;
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
