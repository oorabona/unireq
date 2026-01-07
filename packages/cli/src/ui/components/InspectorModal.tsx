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
import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

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
type InspectorTab = 'headers' | 'body' | 'timing';

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
  maxHeight = 20,
  historyPosition,
  onNavigatePrev,
  onNavigateNext,
}: InspectorModalProps): ReactNode {
  const [activeTab, setActiveTab] = useState<InspectorTab>('body');
  const [scrollOffset, setScrollOffset] = useState(0);

  // Get content lines based on active tab
  const contentLines =
    activeTab === 'headers'
      ? formatHeaders(response.headers)
      : activeTab === 'timing'
        ? response.timing
          ? formatTiming(response.timing)
          : ['No timing data available']
        : response.body.split('\n');

  const maxScroll = Math.max(0, contentLines.length - maxHeight + 4);

  // Handle keyboard input
  useInput(
    useCallback(
      (input, key) => {
        if (key.escape) {
          onClose();
          return;
        }

        // Tab switching
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
          setScrollOffset((prev) => Math.max(0, prev - (maxHeight - 4)));
          return;
        }
        if (key.pageDown) {
          setScrollOffset((prev) => Math.min(maxScroll, prev + (maxHeight - 4)));
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
      [onClose, maxScroll, maxHeight, onNavigatePrev, onNavigateNext],
    ),
  );

  // Slice content for scrolling
  const visibleLines = contentLines.slice(scrollOffset, scrollOffset + maxHeight - 4);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width="100%" height={maxHeight}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
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

      {/* Request info */}
      {response.method && response.url && (
        <Box marginBottom={1}>
          <Text color="yellow">{response.method}</Text>
          <Text> </Text>
          <Text>{response.url}</Text>
        </Box>
      )}

      {/* Tab bar */}
      <Box gap={2} marginBottom={1}>
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
        <Box flexGrow={1} />
        {contentLines.length > maxHeight - 4 && (
          <Text dimColor>
            {scrollOffset + 1}-{Math.min(scrollOffset + maxHeight - 4, contentLines.length)} of {contentLines.length}
          </Text>
        )}
      </Box>

      {/* Content */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {visibleLines.length > 0 ? (
          visibleLines.map((line, index) => (
            <Text key={`${scrollOffset}-${index}`} wrap="truncate">
              {line}
            </Text>
          ))
        ) : (
          <Text dimColor>{activeTab === 'headers' ? 'No headers' : 'Empty body'}</Text>
        )}
      </Box>

      {/* Scroll hint */}
      {maxScroll > 0 && (
        <Box marginTop={1}>
          <Text dimColor>↑↓/jk scroll · PgUp/PgDn page</Text>
        </Box>
      )}
    </Box>
  );
}
