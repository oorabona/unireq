/**
 * Cursor Hook for Ink UI Input Fields
 *
 * Provides a reusable cursor with optional blinking support.
 * Can be configured with different styles and blink intervals.
 */

import { useEffect, useState } from 'react';

/**
 * Cursor style options
 */
export type CursorStyle = 'block' | 'underline' | 'bar';

/**
 * Configuration for the cursor hook
 */
export interface UseCursorConfig {
  /** Whether the cursor should blink (default: true) */
  blink?: boolean;
  /** Blink interval in milliseconds (default: 530ms, standard terminal blink rate) */
  blinkInterval?: number;
  /** Whether the cursor is active/focused (default: true) */
  active?: boolean;
  /** Cursor style (default: 'block') */
  style?: CursorStyle;
}

/**
 * State returned by the useCursor hook
 */
export interface UseCursorState {
  /** Whether the cursor is currently visible (for blinking) */
  visible: boolean;
  /** The cursor style being used */
  style: CursorStyle;
  /** Whether blinking is enabled */
  blinking: boolean;
}

/**
 * Default blink interval (530ms matches standard terminal cursor blink)
 */
const DEFAULT_BLINK_INTERVAL = 530;

/**
 * Hook for managing cursor visibility with optional blinking
 *
 * @example
 * ```tsx
 * const { visible, style } = useCursor({ blink: true, active: isFocused });
 *
 * return visible ? (
 *   <Text inverse>{charAtCursor}</Text>
 * ) : (
 *   <Text>{charAtCursor}</Text>
 * );
 * ```
 */
export function useCursor(config: UseCursorConfig = {}): UseCursorState {
  const { blink = true, blinkInterval = DEFAULT_BLINK_INTERVAL, active = true, style = 'block' } = config;

  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // If not active, always hide cursor
    if (!active) {
      setVisible(false);
      return;
    }

    // If not blinking, always show cursor
    if (!blink) {
      setVisible(true);
      return;
    }

    // Reset to visible when becoming active
    setVisible(true);

    // Set up blink interval
    const interval = setInterval(() => {
      setVisible((prev) => !prev);
    }, blinkInterval);

    return () => {
      clearInterval(interval);
    };
  }, [blink, blinkInterval, active]);

  return {
    visible,
    style,
    blinking: blink && active,
  };
}
