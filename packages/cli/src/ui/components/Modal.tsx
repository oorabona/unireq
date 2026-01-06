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
  /** Minimum width */
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
  // Total width = minWidth + 2 (padding) + 2 (borders) = minWidth + 4
  const totalWidth = minWidth + 4;
  // Separator inner width = totalWidth - 2 (for ╟ and ╢)
  const innerWidth = totalWidth - 2;
  const contentRef = useRef<DOMElement>(null);
  const [shadowHeight, setShadowHeight] = useState(0);

  // Measure the modal content height for dynamic shadow
  // Use short polling interval to catch height changes after Ink layout updates
  useEffect(() => {
    if (!showShadow) return;

    const measure = () => {
      if (contentRef.current) {
        const { height } = measureElement(contentRef.current);
        setShadowHeight((prev) => (prev !== height ? height : prev));
      }
    };

    measure();
    // Poll briefly to catch layout changes (Ink updates async)
    const intervalId = setInterval(measure, 16);

    // Stop polling after 100ms - layout should be stable by then
    const timeoutId = setTimeout(() => clearInterval(intervalId), 100);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  });

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
            minWidth={minWidth}
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
            minWidth={minWidth}
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
                minWidth={minWidth}
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
