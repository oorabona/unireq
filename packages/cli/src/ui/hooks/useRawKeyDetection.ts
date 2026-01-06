/**
 * Raw Key Detection Hook
 *
 * Distinguishes Backspace from Delete key in terminals.
 * Ink's useInput reports both as key.delete=true, so we need
 * to check raw stdin data to tell them apart.
 *
 * - Backspace sends: \x7f (single byte, charCode 127)
 * - Delete sends: \x1b[3~ (4-byte escape sequence starting with 0x1b)
 */

import { useStdin } from 'ink';
import { useEffect, useRef } from 'react';

/**
 * Key detection result
 */
export interface KeyDetection {
  /** True if the last key was Backspace */
  isBackspace: boolean;
  /** True if the last key was Delete */
  isDelete: boolean;
}

/**
 * Hook return type
 */
export interface UseRawKeyDetectionResult {
  /**
   * Detect if the last key press was Backspace or Delete
   * Call this inside useInput handler when key.backspace || key.delete is true
   */
  detectKey: () => KeyDetection;
}

/**
 * Hook for detecting raw key codes from stdin
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { detectKey } = useRawKeyDetection();
 *
 *   useInput((char, key) => {
 *     if (key.backspace || key.delete) {
 *       const { isBackspace, isDelete } = detectKey();
 *       if (isBackspace) {
 *         // Delete char before cursor
 *       } else if (isDelete) {
 *         // Delete char at cursor
 *       }
 *     }
 *   });
 * }
 * ```
 */
export function useRawKeyDetection(): UseRawKeyDetectionResult {
  const lastRawKeyRef = useRef<string | null>(null);
  const { stdin } = useStdin();

  useEffect(() => {
    if (!stdin) return;

    const handleData = (data: string | Buffer) => {
      lastRawKeyRef.current = typeof data === 'string' ? data : data.toString();
    };

    stdin.on('data', handleData);
    return () => {
      stdin.off('data', handleData);
    };
  }, [stdin]);

  const detectKey = (): KeyDetection => {
    const rawKey = lastRawKeyRef.current;
    const firstCharCode = rawKey ? rawKey.charCodeAt(0) : 0;

    // Backspace: single byte \x7f (127)
    const isBackspace = rawKey !== null && rawKey.length === 1 && firstCharCode === 0x7f;

    // Delete: escape sequence \x1b[3~ (starts with 0x1b, length 4)
    const isDelete = rawKey !== null && rawKey.length === 4 && firstCharCode === 0x1b;

    return { isBackspace, isDelete };
  };

  return { detectKey };
}
