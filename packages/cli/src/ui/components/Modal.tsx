/**
 * Modal Component
 *
 * Reusable modal with styled borders, header/footer separators, and shadow effect.
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, type DOMElement, measureElement, Text } from 'ink';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * Calculate the visual width of a string, accounting for:
 * - Regular ASCII characters (width 1)
 * - Emojis (width 2 in most terminals)
 * - ANSI escape codes (width 0)
 *
 * This is a simplified version - for full Unicode support,
 * consider using a library like `string-width`.
 */
export function getVisualWidth(str: string): number {
  // Remove ANSI escape codes (ESC [ ... m sequences)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes require control char matching
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');

  let width = 0;
  for (const char of stripped) {
    const code = char.codePointAt(0) ?? 0;
    // Emoji ranges (simplified - covers most common emojis)
    if (
      (code >= 0x1f300 && code <= 0x1f9ff) || // Misc Symbols, Emoticons, etc.
      (code >= 0x2600 && code <= 0x26ff) || // Misc Symbols
      (code >= 0x2700 && code <= 0x27bf) || // Dingbats
      (code >= 0x1f600 && code <= 0x1f64f) || // Emoticons
      (code >= 0x1f680 && code <= 0x1f6ff) // Transport/Map
    ) {
      width += 2;
    } else if (code > 0xffff) {
      // Other surrogate pairs (likely emojis)
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Options for calculating modal width
 */
export interface ModalWidthOptions {
  /** Footer text */
  footer?: string;
  /** Title text (if string) */
  title?: string;
  /** Array of content line strings (widest line determines width) */
  contentLines?: string[];
  /** Base minimum width */
  baseWidth?: number;
  /** Padding to add (default: 2 for paddingX={1} on each side) */
  padding?: number;
}

/**
 * Calculate the minimum width needed for a modal based on its content.
 *
 * This is the DRY solution for modal width calculation.
 * Use this to pre-calculate width before rendering to avoid
 * separator misalignment issues.
 *
 * @example
 * ```tsx
 * const width = calculateModalWidth({
 *   footer: 'Tab: switch · ↑↓: navigate · Esc: close',
 *   title: '🌐 HTTP Defaults (modified)',
 *   contentLines: ['includeHeaders  [✓]  (session)'],
 * });
 *
 * <Modal minWidth={width} footer={footer} title={title}>
 *   ...
 * </Modal>
 * ```
 */
export function calculateModalWidth(options: ModalWidthOptions): number {
  const { footer, title, contentLines = [], baseWidth = 50, padding = 2 } = options;

  const widths: number[] = [baseWidth];

  if (footer) {
    widths.push(getVisualWidth(footer) + padding);
  }

  if (title) {
    widths.push(getVisualWidth(title) + padding);
  }

  for (const line of contentLines) {
    widths.push(getVisualWidth(line) + padding);
  }

  return Math.max(...widths);
}

/**
 * Props for Modal component
 */
export interface ModalProps {
  /** Modal title (string or ReactNode for complex titles) */
  title: ReactNode;
  /** Title color (only used if title is string) */
  titleColor?: string;
  /** Border color */
  borderColor?: string;
  /** Modal content */
  children: ReactNode;
  /** Footer/help text */
  footer?: string;
  /**
   * Minimum width for the modal.
   *
   * Best practice: Use `calculateModalWidth()` to compute this value
   * based on your title, footer, and content lines to ensure
   * separators always align correctly.
   *
   * If footer is provided and longer than minWidth, the modal will
   * automatically expand to fit it.
   */
  minWidth?: number;
  /** Show shadow effect */
  showShadow?: boolean;
}

/**
 * Styled Modal Component
 *
 * Features:
 * - Double-line border style
 * - Header separated from body by simple line
 * - Footer separated from body by simple line
 * - Optional shadow effect
 */
export function Modal({
  title,
  titleColor = 'cyan',
  borderColor = 'blue',
  children,
  footer,
  minWidth = 50,
  showShadow = true,
}: ModalProps): ReactNode {
  const contentRef = useRef<DOMElement>(null);
  const [shadowHeight, setShadowHeight] = useState(0);

  // Calculate effective minWidth: ensure footer fits (using visual width for emoji support)
  // This is the DRY solution: Modal auto-calculates width from footer
  const effectiveMinWidth = footer ? Math.max(minWidth, getVisualWidth(footer) + 2) : minWidth;

  const [measuredWidth, setMeasuredWidth] = useState(effectiveMinWidth);

  // Measure the modal content dimensions for dynamic shadow and separators
  // Use short polling interval to catch dimension changes after Ink layout updates
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const measure = () => {
      if (contentRef.current) {
        const { height, width } = measureElement(contentRef.current);
        if (showShadow) {
          setShadowHeight((prev) => (prev !== height ? height : prev));
        }
        // Width includes the 2 border chars, so inner width = width - 2
        const innerW = Math.max(effectiveMinWidth, width - 2);
        setMeasuredWidth((prev) => (prev !== innerW ? innerW : prev));
      }
    };

    measure();
    // Poll briefly to catch layout changes (Ink updates async)
    intervalId = setInterval(measure, 16);

    // Stop polling after 100ms - layout should be stable by then
    timeoutId = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
    }, 100);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showShadow, effectiveMinWidth]);

  // Use measured width for separators, fallback to effectiveMinWidth
  const innerWidth = measuredWidth;
  // Total visual width = inner + 2 (borders)
  const totalWidth = innerWidth + 2;

  // Generate shadow lines based on measured height
  // -1 because marginTop=1 shifts shadow down by 1 line
  const shadowLines = shadowHeight > 0 ? Array.from({ length: shadowHeight - 1 }, (_, i) => i) : [];

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" paddingY={1}>
      <Box flexDirection="row">
        {/* Main modal column */}
        <Box flexDirection="column" ref={contentRef}>
          {/* Header section with top border */}
          <Box
            flexDirection="column"
            borderStyle="double"
            borderColor={borderColor}
            borderBottom={false}
            minWidth={effectiveMinWidth}
          >
            <Box justifyContent="center" paddingX={1}>
              {typeof title === 'string' ? (
                <Text bold color={titleColor}>
                  {title}
                </Text>
              ) : (
                title
              )}
            </Box>
          </Box>

          {/* Header-body separator */}
          <Box>
            <Text color={borderColor}>╟{'─'.repeat(innerWidth)}╢</Text>
          </Box>

          {/* Body section */}
          <Box
            flexDirection="column"
            borderStyle="double"
            borderColor={borderColor}
            borderTop={false}
            borderBottom={false}
            minWidth={effectiveMinWidth}
            paddingX={1}
          >
            {children}
          </Box>

          {/* Body-footer separator + footer */}
          {footer && (
            <>
              <Box>
                <Text color={borderColor}>╟{'─'.repeat(innerWidth)}╢</Text>
              </Box>
              <Box
                flexDirection="column"
                borderStyle="double"
                borderColor={borderColor}
                borderTop={false}
                minWidth={effectiveMinWidth}
              >
                <Box justifyContent="center" paddingX={1}>
                  <Text dimColor>{footer}</Text>
                </Box>
              </Box>
            </>
          )}

          {/* Bottom border if no footer */}
          {!footer && (
            <Box>
              <Text color={borderColor}>╚{'═'.repeat(innerWidth)}╝</Text>
            </Box>
          )}
        </Box>

        {/* Shadow effect (right side) - dynamically sized */}
        {showShadow && shadowLines.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {shadowLines.map((i) => (
              <Text key={i} color="gray">
                {'░░'}
              </Text>
            ))}
          </Box>
        )}
      </Box>

      {/* Bottom shadow */}
      {showShadow && (
        <Box marginLeft={2}>
          <Text color="gray">{'░'.repeat(totalWidth)}</Text>
        </Box>
      )}
    </Box>
  );
}
