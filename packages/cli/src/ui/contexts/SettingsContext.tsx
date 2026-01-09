/**
 * Settings Context
 *
 * Provides reactive access to settings across the UI.
 * Components using useSettingsColors() will automatically
 * re-render when settings are saved.
 */

import React from 'react';
import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { getSetting } from '../../workspace/settings/store.js';
import type { ColorSettings } from '../../workspace/settings/types.js';

// React is needed for JSX transformation with tsx
void React;

/**
 * Settings context value
 */
interface SettingsContextValue {
  /** Current color settings */
  colors: ColorSettings;
  /** Version number - changes when settings are saved, can be used in key props */
  version: number;
  /** Notify that settings have changed (triggers re-render of all consumers) */
  notifySettingsChanged: () => void;
}

/**
 * Get current color settings from store
 */
function getColorsFromStore(): ColorSettings {
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
 * Default context value (used when no provider is present)
 */
const SettingsContext = createContext<SettingsContextValue>({
  colors: getColorsFromStore(),
  version: 0,
  notifySettingsChanged: () => {},
});

/**
 * Props for SettingsProvider
 */
export interface SettingsProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages settings state
 *
 * Wrap your app with this provider to enable reactive settings updates.
 * The colors are stored in React state and updated when notifySettingsChanged is called.
 *
 * @example
 * ```tsx
 * <SettingsProvider>
 *   <App />
 * </SettingsProvider>
 * ```
 */
export function SettingsProvider({ children }: SettingsProviderProps): ReactNode {
  // Store colors in state - this ensures React tracks changes properly
  const [colors, setColors] = useState<ColorSettings>(() => getColorsFromStore());

  // Version counter for components that need to force re-render via key prop
  const [version, setVersion] = useState(0);

  // Callback to notify settings changed - re-reads colors from store
  const notifySettingsChanged = useCallback(() => {
    // Re-read colors from store and update state
    setColors(getColorsFromStore());
    // Also increment version for components using key-based re-render
    setVersion((v) => v + 1);
  }, []);

  // Context value - creates new object reference when colors or version change
  const value: SettingsContextValue = {
    colors,
    version,
    notifySettingsChanged,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/**
 * Hook to access settings context
 *
 * @returns Settings context value with colors, version, and notifySettingsChanged
 */
export function useSettingsContext(): SettingsContextValue {
  return useContext(SettingsContext);
}

/**
 * Hook to get current color settings (reactive)
 *
 * This hook will cause the component to re-render when settings change.
 *
 * @returns Current color settings
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const colors = useColors();
 *   return <Text color={colors.ui.border}>Hello</Text>;
 * }
 * ```
 */
export function useColors(): ColorSettings {
  const { colors } = useContext(SettingsContext);
  return colors;
}
