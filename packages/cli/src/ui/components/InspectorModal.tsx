/**
 * Inspector Modal Component
 *
 * Full-screen modal for inspecting the last HTTP response.
 * Shows headers, body, and timing information with scrolling.
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import type { TimingInfo } from '@unireq/http';
import { Box, Text, useInput, useStdout } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

/**
 * HTTP response data to display
 */
export interface InspectorResponse {
  /** HTTP status code */
  status: number;
  /** Status text (e.g., "OK", "Not Found") */
  statusText: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body (formatted/pretty-printed if JSON) */
  body: string;
  /** Request duration in ms (total time) */
  duration?: number;
  /** Detailed timing information (TTFB, download, etc.) */
  timing?: TimingInfo;
  /** Request method */
  method?: string;
  /** Request URL */
  url?: string;
  /** Request headers that were sent */
  requestHeaders?: Record<string, string>;
  /** Request body that was sent (if any) */
  requestBody?: string;
}

/**
 * History navigation position
 */
export interface HistoryPosition {
  /** Current position (1-based) */
  current: number;
  /** Total number of responses in history */
  total: number;
}

/**
 * Props for InspectorModal component
 */
export interface InspectorModalProps {
  /** Response data to inspect */
  response: InspectorResponse;
  /** Callback when modal should close */
  onClose: () => void;
  /** Maximum height for scrollable content */
  maxHeight?: number;
  /** History position for navigation indicator */
  historyPosition?: HistoryPosition;
  /** Callback to navigate to previous (older) response */
  onNavigatePrev?: () => void;
  /** Callback to navigate to next (newer) response */
  onNavigateNext?: () => void;
}

/**
 * Tab types for inspector sections
 */
type InspectorTab = 'request' | 'headers' | 'body' | 'timing';

/**
 * Scrollbar characters for visual representation
 */
const SCROLLBAR_CHARS = {
  track: '│',
  thumb: '█',
  top: '▲',
  bottom: '▼',
};

/**
 * Calculate scrollbar characters for inline rendering
 */
function getScrollbarChars(
  viewportHeight: number,
  contentHeight: number,
  scrollTop: number,
): { chars: string[]; canScrollUp: boolean; canScrollDown: boolean } | null {
  // Don't show scrollbar if content fits in viewport
  if (contentHeight <= viewportHeight) {
    return null;
  }

  // Reserve 2 lines for arrows (top and bottom)
  const trackHeight = Math.max(1, viewportHeight - 2);

  // Calculate thumb size (minimum 1 character)
  const thumbRatio = trackHeight / contentHeight;
  const thumbSize = Math.max(1, Math.round(trackHeight * thumbRatio));

  // Calculate thumb position
  const scrollableHeight = contentHeight - viewportHeight;
  const clampedScrollTop = Math.max(0, Math.min(scrollTop, scrollableHeight));
  const scrollRatio = scrollableHeight > 0 ? clampedScrollTop / scrollableHeight : 0;
  const thumbPosition = Math.round((trackHeight - thumbSize) * scrollRatio);

  // Determine if we can scroll in each direction
  const canScrollUp = clampedScrollTop > 0;
  const canScrollDown = clampedScrollTop < scrollableHeight;

  // Build scrollbar chars array: [top arrow, ...track chars, bottom arrow]
  const chars: string[] = [SCROLLBAR_CHARS.top];
  for (let i = 0; i < trackHeight; i++) {
    if (i >= thumbPosition && i < thumbPosition + thumbSize) {
      chars.push(SCROLLBAR_CHARS.thumb);
    } else {
      chars.push(SCROLLBAR_CHARS.track);
    }
  }
  chars.push(SCROLLBAR_CHARS.bottom);

  return { chars, canScrollUp, canScrollDown };
}

/**
 * Check if content looks like HTML
 */
function isHtml(str: string): boolean {
  const trimmed = str.trim();
  return trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.includes('</html>');
}

/**
 * Check if content looks like XML
 */
function isXml(str: string): boolean {
  const trimmed = str.trim();
  return trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && trimmed.includes('</') && !isHtml(trimmed));
}

/**
 * Check if content looks like JSON
 */
function isJson(str: string): boolean {
  const trimmed = str.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

/**
 * Format HTML/XML with line breaks for readability
 */
function formatMarkup(str: string): string {
  return str
    .replace(/></g, '>\n<')  // Add newline between adjacent tags
    .replace(/(<script[^>]*>)/gi, '\n$1\n')  // Script tags on own lines
    .replace(/(<\/script>)/gi, '\n$1\n')
    .replace(/(<style[^>]*>)/gi, '\n$1\n')  // Style tags on own lines
    .replace(/(<\/style>)/gi, '\n$1\n')
    .replace(/\n\n+/g, '\n')  // Remove multiple blank lines
    .trim();
}

/**
 * Pretty-print JSON with indentation
 */
function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str.trim()), null, 2);
  } catch {
    return str;
  }
}

/**
 * Format content for display
 * When prettyPrint is ON: format JSON, HTML, and XML
 * When prettyPrint is OFF: return raw content
 */
function formatContent(str: string, prettyPrint: boolean): string {
  if (!prettyPrint) {
    return str;
  }

  const trimmed = str.trim();

  if (isJson(trimmed)) {
    return formatJson(trimmed);
  }

  if (isHtml(trimmed) || isXml(trimmed)) {
    return formatMarkup(trimmed);
  }

  return str;
}


/**
 * Get status color based on status code
 */
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'green';
  if (status >= 300 && status < 400) return 'yellow';
  if (status >= 400 && status < 500) return 'red';
  if (status >= 500) return 'magenta';
  return 'white';
}

/**
 * Format headers for display
 */
function formatHeaders(headers: Record<string, string>): string[] {
  return Object.entries(headers).map(([key, value]) => `${key}: ${value}`);
}

/**
 * Format a duration in milliseconds for display
 */
function formatDuration(ms: number): string {
  if (ms < 1) {
    return '<1ms';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Create a timing bar visualization
 */
function createTimingBar(value: number, total: number, width: number): string {
  if (total === 0) {
    return '─'.repeat(width);
  }
  const filledWidth = Math.round((value / total) * width);
  const filled = '█'.repeat(Math.min(filledWidth, width));
  const empty = '─'.repeat(width - filled.length);
  return filled + empty;
}

/**
 * Format timing information for display as lines
 */
function formatTiming(timing: TimingInfo): string[] {
  const lines: string[] = [];
  const barWidth = 20;

  // TTFB (Time to First Byte)
  const ttfbBar = createTimingBar(timing.ttfb, timing.total, barWidth);
  lines.push(`TTFB:     ${ttfbBar} ${formatDuration(timing.ttfb)}`);

  // Download
  const downloadBar = createTimingBar(timing.download, timing.total, barWidth);
  lines.push(`Download: ${downloadBar} ${formatDuration(timing.download)}`);

  // Separator
  lines.push(`${'─'.repeat(barWidth + 15)}`);

  // Total
  lines.push(`Total:    ${' '.repeat(barWidth)} ${formatDuration(timing.total)}`);

  // Optional DNS/TCP/TLS breakdown if available
  if (timing.dns !== undefined || timing.tcp !== undefined || timing.tls !== undefined) {
    lines.push('');
    lines.push('Connection breakdown:');
    if (timing.dns !== undefined) {
      lines.push(`  DNS:  ${formatDuration(timing.dns)}`);
    }
    if (timing.tcp !== undefined) {
      lines.push(`  TCP:  ${formatDuration(timing.tcp)}`);
    }
    if (timing.tls !== undefined) {
      lines.push(`  TLS:  ${formatDuration(timing.tls)}`);
    }
  }

  return lines;
}

/**
 * Inspector Modal
 *
 * Full-screen modal showing complete response details.
 * Features:
 * - Tab switching between headers and body
 * - Scrollable content
 * - Escape to close
 *
 * @example
 * ```tsx
 * <InspectorModal
 *   response={{
 *     status: 200,
 *     statusText: 'OK',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: '{"id": 1, "name": "Alice"}',
 *     duration: 142,
 *   }}
 *   onClose={() => setShowInspector(false)}
 * />
 * ```
 */
export function InspectorModal({
  response,
  onClose,
  maxHeight,
  historyPosition,
  onNavigatePrev,
  onNavigateNext,
}: InspectorModalProps): ReactNode {
  const { stdout } = useStdout();
  const [activeTab, setActiveTab] = useState<InspectorTab>('body');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [prettyPrint, setPrettyPrint] = useState(true);

  // Calculate effective height: 2/3 of terminal height, or maxHeight if provided
  const effectiveHeight = useMemo(() => {
    if (maxHeight) return maxHeight;
    const terminalHeight = stdout?.rows ?? 24;
    return Math.max(15, Math.floor(terminalHeight * 2 / 3));
  }, [maxHeight, stdout?.rows]);

  // Calculate content width: terminal width minus borders, padding, and scrollbar
  // Border: 2 (left + right), Padding: 2 (paddingX={1}), Scrollbar: 3 (margin + char)
  const contentWidth = useMemo(() => {
    const terminalWidth = stdout?.columns ?? 100;
    return Math.max(40, terminalWidth - 7);
  }, [stdout?.columns]);

  // Format request content (headers + body combined)
  const formatRequestContent = (): string[] => {
    const lines: string[] = [];

    // Request headers section
    if (response.requestHeaders && Object.keys(response.requestHeaders).length > 0) {
      lines.push('─── Request Headers ───');
      lines.push(...formatHeaders(response.requestHeaders));
    } else {
      lines.push('─── Request Headers ───');
      lines.push('(no headers)');
    }

    lines.push('');

    // Request body section
    lines.push('─── Request Body ───');
    if (response.requestBody) {
      const bodyContent = formatContent(response.requestBody, prettyPrint);
      lines.push(...bodyContent.split('\n'));
    } else {
      lines.push('(no body)');
    }

    return lines;
  };

  // Get content lines based on active tab
  const getContentLines = (): string[] => {
    switch (activeTab) {
      case 'request':
        return formatRequestContent();
      case 'headers':
        return formatHeaders(response.headers);
      case 'timing':
        return response.timing ? formatTiming(response.timing) : ['No timing data available'];
      case 'body': {
        const bodyContent = formatContent(response.body, prettyPrint);
        return bodyContent.split('\n');
      }
    }
  };

  const contentLines = getContentLines();

  const maxScroll = Math.max(0, contentLines.length - effectiveHeight + 4);

  // Handle keyboard input
  useInput(
    useCallback(
      (input, key) => {
        if (key.escape) {
          onClose();
          return;
        }

        // Tab switching
        if (input === 'r' || input === 'R') {
          setActiveTab('request');
          setScrollOffset(0);
          return;
        }
        if (input === 'h' || input === 'H') {
          setActiveTab('headers');
          setScrollOffset(0);
          return;
        }
        if (input === 'b' || input === 'B') {
          setActiveTab('body');
          setScrollOffset(0);
          return;
        }
        if (input === 't' || input === 'T') {
          setActiveTab('timing');
          setScrollOffset(0);
          return;
        }

        // Pretty-print toggle (only for body/request tabs with JSON content)
        if (input === 'p' || input === 'P') {
          if (activeTab === 'body' || activeTab === 'request') {
            setPrettyPrint((prev) => !prev);
            setScrollOffset(0);
          }
          return;
        }

        // Scrolling
        if (key.upArrow || input === 'k') {
          setScrollOffset((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.downArrow || input === 'j') {
          setScrollOffset((prev) => Math.min(maxScroll, prev + 1));
          return;
        }
        if (key.pageUp) {
          setScrollOffset((prev) => Math.max(0, prev - (effectiveHeight - 4)));
          return;
        }
        if (key.pageDown) {
          setScrollOffset((prev) => Math.min(maxScroll, prev + (effectiveHeight - 4)));
          return;
        }

        // History navigation
        if (key.leftArrow && onNavigatePrev) {
          onNavigatePrev();
          setScrollOffset(0); // Reset scroll when navigating
          return;
        }
        if (key.rightArrow && onNavigateNext) {
          onNavigateNext();
          setScrollOffset(0); // Reset scroll when navigating
          return;
        }
      },
      [onClose, maxScroll, effectiveHeight, onNavigatePrev, onNavigateNext, activeTab],
    ),
  );

  // Slice content for scrolling
  const visibleLines = contentLines.slice(scrollOffset, scrollOffset + effectiveHeight - 4);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width="100%" height={effectiveHeight}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1} flexShrink={0}>
        <Box gap={1}>
          <Text bold color="cyan">
            Inspector
          </Text>
          {historyPosition && historyPosition.total > 1 && (
            <Text dimColor>
              ({historyPosition.current}/{historyPosition.total})
            </Text>
          )}
          <Text dimColor>|</Text>
          {response.method && response.url && (
            <>
              <Text color="yellow">{response.method}</Text>
              <Text dimColor>{response.url}</Text>
              <Text dimColor>|</Text>
            </>
          )}
          <Text color={getStatusColor(response.status)} bold>
            {response.status} {response.statusText}
          </Text>
          {response.duration && <Text dimColor>· {response.duration}ms</Text>}
        </Box>
        <Box gap={1}>
          {historyPosition && historyPosition.total > 1 && <Text dimColor>←→ history ·</Text>}
          <Text dimColor>[Esc] Close</Text>
        </Box>
      </Box>

      {/* Tab bar */}
      <Box gap={2} flexShrink={0}>
        <Text
          color={activeTab === 'request' ? 'cyan' : undefined}
          bold={activeTab === 'request'}
          underline={activeTab === 'request'}
        >
          [R] Request
        </Text>
        <Text
          color={activeTab === 'headers' ? 'cyan' : undefined}
          bold={activeTab === 'headers'}
          underline={activeTab === 'headers'}
        >
          [H] Headers
        </Text>
        <Text
          color={activeTab === 'body' ? 'cyan' : undefined}
          bold={activeTab === 'body'}
          underline={activeTab === 'body'}
        >
          [B] Body
        </Text>
        <Text
          color={activeTab === 'timing' ? 'cyan' : undefined}
          bold={activeTab === 'timing'}
          underline={activeTab === 'timing'}
        >
          [T] Timing
        </Text>
        {/* Pretty-print toggle - always rendered for consistent layout */}
        <Text
          color={
            (activeTab === 'body' || activeTab === 'request') && prettyPrint ? 'green' : undefined
          }
          dimColor={activeTab !== 'body' && activeTab !== 'request'}
        >
          {activeTab === 'body' || activeTab === 'request'
            ? `[P] Pretty ${prettyPrint ? '✓' : '○'}`
            : '             '}
        </Text>
        <Box flexGrow={1} />
        {contentLines.length > effectiveHeight - 4 && (
          <Text dimColor>
            {scrollOffset + 1}-{Math.min(scrollOffset + effectiveHeight - 4, contentLines.length)} of {contentLines.length}
          </Text>
        )}
      </Box>

      {/* Separator */}
      <Text dimColor>{'─'.repeat(80)}</Text>

      {/* Content with inline scrollbar */}
      <Box flexDirection="column" flexGrow={1}>
        {(() => {
          const viewportHeight = effectiveHeight - 4;
          const scrollbar = getScrollbarChars(viewportHeight, contentLines.length, scrollOffset);

          // Pad visible lines to fill viewport height
          const paddedLines = [...visibleLines];
          while (paddedLines.length < viewportHeight) {
            paddedLines.push('');
          }

          return paddedLines.map((line, index) => {
            // Truncate line to content width
            const displayLine = line.length > contentWidth
              ? line.slice(0, contentWidth - 1) + '…'
              : line.padEnd(contentWidth);

            return (
              <Box key={`${scrollOffset}-${index}`} flexDirection="row">
                <Text>
                  {displayLine || (index === 0 && visibleLines.length === 0
                    ? (activeTab === 'headers' ? 'No headers' : 'Empty body').padEnd(contentWidth)
                    : ' '.repeat(contentWidth))}
                </Text>
                {scrollbar && (
                  <Text
                    color={
                      (index === 0 && scrollbar.canScrollUp) ||
                      (index === viewportHeight - 1 && scrollbar.canScrollDown)
                        ? 'cyan'
                        : undefined
                    }
                    dimColor={
                      !(index === 0 && scrollbar.canScrollUp) &&
                      !(index === viewportHeight - 1 && scrollbar.canScrollDown)
                    }
                  >
                    {scrollbar.chars[index] || ' '}
                  </Text>
                )}
              </Box>
            );
          });
        })()}
      </Box>

      {/* Scroll hint */}
      {maxScroll > 0 && (
        <Box flexShrink={0}>
          <Text dimColor>↑↓/jk scroll · PgUp/PgDn page</Text>
        </Box>
      )}
    </Box>
  );
}
