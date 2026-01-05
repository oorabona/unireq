/**
 * Transcript Component
 *
 * Renders a scrollable list of transcript events using ink-scroll-view.
 * Implements S-2: Commands appear in transcript.
 */

import { Box, Text, useInput } from 'ink';
import { ScrollView, type ScrollViewRef } from 'ink-scroll-view';
import type { ReactNode } from 'react';
import React, { useCallback, useRef } from 'react';
import type { TranscriptEvent as TranscriptEventType } from '../state/types.js';
import { TranscriptEvent } from './TranscriptEvent.js';

// React is needed for JSX transformation with tsx
void React;

export interface TranscriptProps {
  /** List of transcript events to display */
  events: TranscriptEventType[];
  /** Maximum height in lines (for scrolling) */
  maxHeight?: number;
  /** Whether scroll input is active (disable when modal is open) */
  scrollActive?: boolean;
}

/**
 * Render a single event as text
 */
function renderEventContent(event: TranscriptEventType): ReactNode {
  if (event.type === 'command') {
    const content = event.content as string;
    return (
      <Text color="cyan" bold>
        {'> '}
        {content}
      </Text>
    );
  }

  if (event.type === 'error') {
    const content = event.content as string;
    return (
      <Text color="red">
        {'✗ '}
        {content}
      </Text>
    );
  }

  if (event.type === 'notice') {
    const content = event.content as string;
    return (
      <Text color="yellow">
        {'⚠ '}
        {content}
      </Text>
    );
  }

  if (event.type === 'meta') {
    const content = event.content as string;
    return <Text dimColor>{content}</Text>;
  }

  if (event.type === 'result') {
    return <TranscriptEvent event={event} />;
  }

  return <Text>{String(event.content)}</Text>;
}

/**
 * Transcript component
 *
 * Displays a scrollable vertical list of events using ink-scroll-view.
 * Use Page Up/Down or Shift+Up/Down to scroll.
 * Auto-scrolls to bottom when new events are added.
 */
export function Transcript({ events, maxHeight = 15, scrollActive = true }: TranscriptProps): ReactNode {
  const scrollRef = useRef<ScrollViewRef>(null);
  const prevEventCountRef = useRef(events.length);
  const prevContentHeightRef = useRef(0);

  // Auto-scroll to bottom when content height increases (new events added)
  const handleContentHeightChange = useCallback(
    (height: number, previousHeight: number) => {
      // If content grew and we have new events, scroll to bottom
      if (height > previousHeight && events.length >= prevEventCountRef.current) {
        scrollRef.current?.scrollToBottom();
      }
      prevContentHeightRef.current = height;
      prevEventCountRef.current = events.length;
    },
    [events.length],
  );

  // Handle scroll input
  useInput(
    (input, key) => {
      if (!scrollActive) return;

      if (key.pageUp || (key.shift && key.upArrow)) {
        // Scroll up by half page
        scrollRef.current?.scrollBy(-Math.floor(maxHeight / 2));
      } else if (key.pageDown || (key.shift && key.downArrow)) {
        // Scroll down by half page
        scrollRef.current?.scrollBy(Math.floor(maxHeight / 2));
      } else if (input === 'g' && key.shift) {
        // Shift+G = go to bottom
        scrollRef.current?.scrollToBottom();
      } else if (input === 'g') {
        // g = go to top
        scrollRef.current?.scrollToTop();
      }
    },
    { isActive: scrollActive },
  );

  if (events.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" height={maxHeight}>
      <ScrollView ref={scrollRef} flexGrow={1} onContentHeightChange={handleContentHeightChange}>
        {events.map((event, index) => (
          <Box key={event.id || `event-${index}`} flexDirection="column" marginBottom={1}>
            {renderEventContent(event)}
          </Box>
        ))}
      </ScrollView>
    </Box>
  );
}
