/**
 * Transcript Component
 *
 * Renders the scrollable list of transcript events.
 * Implements S-2: Commands appear in transcript.
 */

import { Box } from 'ink';
import type { ReactNode } from 'react';
import type { TranscriptEvent as TranscriptEventType } from '../state/types.js';
import { TranscriptEvent } from './TranscriptEvent.js';

export interface TranscriptProps {
  /** List of transcript events to display */
  events: TranscriptEventType[];
  /** Maximum height in lines (for scrolling) */
  maxHeight?: number;
}

/**
 * Transcript component
 *
 * Displays a vertical list of events with spacing between them.
 * Events are rendered in chronological order (oldest first).
 */
export function Transcript({ events, maxHeight }: TranscriptProps): ReactNode {
  if (events.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" gap={1} overflow="hidden" height={maxHeight}>
      {events.map((event) => (
        <TranscriptEvent key={event.id} event={event} />
      ))}
    </Box>
  );
}
