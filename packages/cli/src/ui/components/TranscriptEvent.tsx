/**
 * TranscriptEvent Component
 *
 * Renders a single event in the transcript (command, result, error, notice).
 * Implements S-2, S-3, S-9.
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import type { ResultContent, TranscriptEvent as TranscriptEventType } from '../state/types.js';

/** Maximum lines to show in body preview before truncation */
const MAX_PREVIEW_LINES = 20;

/** Maximum characters per line before truncation */
const MAX_LINE_LENGTH = 120;

export interface TranscriptEventProps {
  event: TranscriptEventType;
}

/**
 * Get color for HTTP status code
 */
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'green';
  if (status >= 300 && status < 400) return 'yellow';
  if (status >= 400 && status < 500) return 'red';
  if (status >= 500) return 'magenta';
  return 'gray';
}

/**
 * Truncate body to preview size
 */
function truncateBody(body: string, maxLines: number = MAX_PREVIEW_LINES): { preview: string; truncated: boolean } {
  const lines = body.split('\n');
  const truncated = lines.length > maxLines;
  const previewLines = lines.slice(0, maxLines).map((line) => {
    if (line.length > MAX_LINE_LENGTH) {
      return `${line.slice(0, MAX_LINE_LENGTH)}...`;
    }
    return line;
  });

  return {
    preview: previewLines.join('\n'),
    truncated,
  };
}

/**
 * Format file size in human-readable form
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Render a command event
 */
function CommandEvent({ content }: { content: string }): ReactNode {
  return (
    <Box>
      <Text color="cyan" bold>
        {'> '}
      </Text>
      <Text>{content}</Text>
    </Box>
  );
}

/**
 * Render a result event (HTTP response)
 */
function ResultEvent({ content }: { content: ResultContent }): ReactNode {
  const statusColor = getStatusColor(content.status);
  const isError = content.status >= 400;
  const { preview, truncated } = truncateBody(content.bodyPreview);

  return (
    <Box flexDirection="column">
      {/* Status line */}
      <Box borderStyle="round" borderColor={statusColor} paddingX={1} flexDirection="row" gap={1}>
        <Text color={statusColor} bold>
          {content.status} {content.statusText}
        </Text>
        <Text dimColor>·</Text>
        <Text color="gray">{content.timing}ms</Text>
        <Text dimColor>·</Text>
        <Text color="gray">{formatSize(content.size)}</Text>
      </Box>

      {/* Body preview */}
      {preview && (
        <Box paddingLeft={1} marginTop={0}>
          <Text color={isError ? 'red' : 'white'}>{preview}</Text>
        </Box>
      )}

      {/* Truncation notice */}
      {truncated && (
        <Box paddingLeft={1}>
          <Text dimColor italic>
            ... (truncated, press i to view full)
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Render an error event (non-HTTP error)
 */
function ErrorEvent({ content }: { content: string }): ReactNode {
  return (
    <Box>
      <Text color="red" bold>
        ✗{' '}
      </Text>
      <Text color="red">{content}</Text>
    </Box>
  );
}

/**
 * Render a notice event (warnings, rate limits, etc.)
 */
function NoticeEvent({ content }: { content: string }): ReactNode {
  return (
    <Box>
      <Text color="yellow">⚠ </Text>
      <Text color="yellow">{content}</Text>
    </Box>
  );
}

/**
 * Render a meta event (system messages)
 */
function MetaEvent({ content }: { content: string }): ReactNode {
  return (
    <Box>
      <Text dimColor italic>
        {content}
      </Text>
    </Box>
  );
}

/**
 * TranscriptEvent component
 *
 * Renders different event types with appropriate styling.
 */
export function TranscriptEvent({ event }: TranscriptEventProps): ReactNode {
  switch (event.type) {
    case 'command':
      return <CommandEvent content={event.content as string} />;

    case 'result':
      return <ResultEvent content={event.content as ResultContent} />;

    case 'error':
      return <ErrorEvent content={event.content as string} />;

    case 'notice':
      return <NoticeEvent content={event.content as string} />;

    case 'meta':
      return <MetaEvent content={event.content as string} />;

    default:
      return null;
  }
}
