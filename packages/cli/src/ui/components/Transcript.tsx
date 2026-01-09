/**
 * Transcript Component
 *
 * Renders a scrollable list of transcript events using ink-scroll-view.
 * Implements S-2: Commands appear in transcript.
 */

import { Box, Text, useInput } from 'ink';
import { ScrollView, type ScrollViewRef } from 'ink-scroll-view';
import type { ReactNode } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import type { TranscriptEvent as TranscriptEventType } from '../state/types.js';
import { TranscriptEvent } from './TranscriptEvent.js';

// React is needed for JSX transformation with tsx
void React;

/**
 * Scrollbar characters for visual representation
 */
const SCROLLBAR_CHARS = {
  track: '│',
  thumb: '█',
  top: '▲',
  bottom: '▼',
};

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

interface ScrollbarProps {
  height: number;
  contentHeight: number;
  scrollTop: number;
}

/**
 * Render a vertical scrollbar with arrows at top/bottom
 * Memoized to prevent unnecessary re-renders
 */
const Scrollbar = React.memo(function Scrollbar({ height, contentHeight, scrollTop }: ScrollbarProps): ReactNode {
  // Don't show scrollbar if content fits in viewport
  if (contentHeight <= height) {
    return null;
  }

  // Reserve 2 lines for arrows (top and bottom)
  const trackHeight = Math.max(1, height - 2);

  // Calculate thumb size (minimum 1 character)
  const thumbRatio = trackHeight / contentHeight;
  const thumbSize = Math.max(1, Math.round(trackHeight * thumbRatio));

  // Calculate thumb position - clamp scrollTop to valid range
  const scrollableHeight = contentHeight - height;
  const clampedScrollTop = Math.max(0, Math.min(scrollTop, scrollableHeight));
  const scrollRatio = scrollableHeight > 0 ? clampedScrollTop / scrollableHeight : 0;
  const thumbPosition = Math.round((trackHeight - thumbSize) * scrollRatio);

  // Determine if we can scroll in each direction
  const canScrollUp = clampedScrollTop > 0;
  const canScrollDown = clampedScrollTop < scrollableHeight;

  // Build scrollbar as a single string (reduces re-renders)
  const trackChars: string[] = [];
  for (let i = 0; i < trackHeight; i++) {
    if (i >= thumbPosition && i < thumbPosition + thumbSize) {
      trackChars.push(SCROLLBAR_CHARS.thumb);
    } else {
      trackChars.push(SCROLLBAR_CHARS.track);
    }
  }

  return (
    <Box flexDirection="column" marginLeft={1}>
      {/* Top arrow */}
      <Text color={canScrollUp ? 'cyan' : undefined} dimColor={!canScrollUp}>
        {SCROLLBAR_CHARS.top}
      </Text>
      {/* Track with thumb - single Text element to reduce flickering */}
      <Text dimColor>{trackChars.join('\n')}</Text>
      {/* Bottom arrow */}
      <Text color={canScrollDown ? 'cyan' : undefined} dimColor={!canScrollDown}>
        {SCROLLBAR_CHARS.bottom}
      </Text>
    </Box>
  );
});

/**
 * Transcript component
 *
 * Displays a scrollable vertical list of events using ink-scroll-view.
 * Use Page Up/Down or Shift+Up/Down to scroll.
 * Auto-scrolls to bottom when new events are added.
 * Shows a scrollbar when content exceeds viewport.
 *
 * Memoized to prevent re-renders from cursor blinking in sibling components.
 */
export const Transcript = React.memo(function Transcript({
  events,
  maxHeight = 15,
  scrollActive = true,
}: TranscriptProps): ReactNode {
  const scrollRef = useRef<ScrollViewRef>(null);
  const prevEventCountRef = useRef(events.length);

  // Track scroll state for scrollbar rendering
  const [scrollTop, setScrollTop] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  // Handle scroll position changes
  const handleScroll = useCallback((top: number) => {
    setScrollTop(top);
  }, []);

  // Auto-scroll to bottom when content height increases (new events added)
  const handleContentHeightChange = useCallback(
    (height: number, previousHeight: number) => {
      // Update content height for scrollbar
      setContentHeight(height);

      // If content grew and we have new events, scroll to bottom
      if (height > previousHeight && events.length >= prevEventCountRef.current) {
        scrollRef.current?.scrollToBottom();
      }
      prevEventCountRef.current = events.length;
    },
    [events.length],
  );

  // Handle scroll input with bounds checking
  useInput(
    (input, key) => {
      if (!scrollActive) return;

      // Calculate max scroll position
      const maxScrollTop = Math.max(0, contentHeight - maxHeight);

      if (key.pageUp || (key.shift && key.upArrow)) {
        // Scroll up by half page (clamped to 0)
        const newScrollTop = Math.max(0, scrollTop - Math.floor(maxHeight / 2));
        scrollRef.current?.scrollTo(newScrollTop);
      } else if (key.pageDown || (key.shift && key.downArrow)) {
        // Scroll down by half page (clamped to max)
        const newScrollTop = Math.min(maxScrollTop, scrollTop + Math.floor(maxHeight / 2));
        scrollRef.current?.scrollTo(newScrollTop);
      } else if (input === 'g' && key.shift) {
        // Shift+G = go to bottom (clamped)
        scrollRef.current?.scrollTo(maxScrollTop);
      } else if (input === 'g') {
        // g = go to top
        scrollRef.current?.scrollTo(0);
      }
    },
    { isActive: scrollActive },
  );

  if (events.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="row" height={maxHeight}>
      <Box flexDirection="column" flexGrow={1}>
        <ScrollView
          ref={scrollRef}
          flexGrow={1}
          onContentHeightChange={handleContentHeightChange}
          onScroll={handleScroll}
        >
          {events.map((event, index) => (
            <Box key={event.id || `event-${index}`} flexDirection="column" marginBottom={1}>
              {renderEventContent(event)}
            </Box>
          ))}
        </ScrollView>
      </Box>
      <Scrollbar height={maxHeight} contentHeight={contentHeight} scrollTop={scrollTop} />
    </Box>
  );
});
