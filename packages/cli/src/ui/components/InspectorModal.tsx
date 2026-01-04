/**
 * Inspector Modal Component
 *
 * Full-screen modal for inspecting the last HTTP response.
 * Shows headers, body, and timing information with scrolling.
 */

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
  /** Request duration in ms */
  duration?: number;
  /** Request method */
  method?: string;
  /** Request URL */
  url?: string;
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
}

/**
 * Tab types for inspector sections
 */
type InspectorTab = 'headers' | 'body';

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
export function InspectorModal({ response, onClose, maxHeight = 20 }: InspectorModalProps): ReactNode {
  const [activeTab, setActiveTab] = useState<InspectorTab>('body');
  const [scrollOffset, setScrollOffset] = useState(0);

  // Get content lines based on active tab
  const contentLines = activeTab === 'headers' ? formatHeaders(response.headers) : response.body.split('\n');

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
      },
      [onClose, maxScroll, maxHeight],
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
          <Text dimColor>|</Text>
          <Text color={getStatusColor(response.status)} bold>
            {response.status} {response.statusText}
          </Text>
          {response.duration && <Text dimColor>· {response.duration}ms</Text>}
        </Box>
        <Text dimColor>[Esc] Close</Text>
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
