/**
 * Tests for TranscriptEvent Component
 *
 * Implements tests for S-2, S-3, S-9.
 */

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type { ResultContent, TranscriptEvent as TranscriptEventType } from '../../state/types.js';
import { TranscriptEvent } from '../TranscriptEvent.js';

describe('TranscriptEvent', () => {
  const createEvent = (type: TranscriptEventType['type'], content: string | ResultContent): TranscriptEventType => ({
    id: 'test-1',
    timestamp: new Date(),
    type,
    content,
  });

  describe('S-2: Commands appear in transcript', () => {
    it('should render command event with prompt', () => {
      // Given a command event
      const event = createEvent('command', 'get /users');

      // When rendered
      const { lastFrame } = render(<TranscriptEvent event={event} />);

      // Then shows command with prompt
      const frame = lastFrame();
      expect(frame).toContain('>');
      expect(frame).toContain('get /users');
    });
  });

  describe('S-3: Errors display distinctly', () => {
    it('should render 4xx result with error styling', () => {
      // Given a 404 result
      const event = createEvent('result', {
        status: 404,
        statusText: 'Not Found',
        timing: 50,
        size: 128,
        bodyPreview: '{"error": "Not found"}',
        bodyFull: '{"error": "Not found"}',
      });

      // When rendered
      const { lastFrame } = render(<TranscriptEvent event={event} />);

      // Then shows error status
      const frame = lastFrame();
      expect(frame).toContain('404');
      expect(frame).toContain('Not Found');
    });

    it('should render 5xx result with error styling', () => {
      // Given a 500 result
      const event = createEvent('result', {
        status: 500,
        statusText: 'Internal Server Error',
        timing: 100,
        size: 256,
        bodyPreview: '{"error": "Server error"}',
        bodyFull: '{"error": "Server error"}',
      });

      // When rendered
      const { lastFrame } = render(<TranscriptEvent event={event} />);

      // Then shows error status
      const frame = lastFrame();
      expect(frame).toContain('500');
      expect(frame).toContain('Internal Server Error');
    });

    it('should render error event with error indicator', () => {
      // Given an error event
      const event = createEvent('error', 'Connection refused');

      // When rendered
      const { lastFrame } = render(<TranscriptEvent event={event} />);

      // Then shows error with indicator
      const frame = lastFrame();
      expect(frame).toContain('✗');
      expect(frame).toContain('Connection refused');
    });
  });

  describe('S-9: Transcript truncation', () => {
    it('should truncate large response body', () => {
      // Given a large response body (> 20 lines)
      const longBody = Array.from({ length: 50 }, (_, i) => `  "line${i}": "value${i}",`).join('\n');
      const event = createEvent('result', {
        status: 200,
        statusText: 'OK',
        timing: 200,
        size: longBody.length,
        bodyPreview: longBody,
        bodyFull: longBody,
      });

      // When rendered
      const { lastFrame } = render(<TranscriptEvent event={event} />);

      // Then shows truncation notice
      const frame = lastFrame();
      expect(frame).toContain('truncated');
      expect(frame).toContain('press i to view full');
    });

    it('should not show truncation notice for small body', () => {
      // Given a small response body
      const event = createEvent('result', {
        status: 200,
        statusText: 'OK',
        timing: 50,
        size: 20,
        bodyPreview: '{"ok": true}',
        bodyFull: '{"ok": true}',
      });

      // When rendered
      const { lastFrame } = render(<TranscriptEvent event={event} />);

      // Then no truncation notice
      expect(lastFrame()).not.toContain('truncated');
    });
  });

  describe('Result event formatting', () => {
    it('should show status, timing, and size', () => {
      const event = createEvent('result', {
        status: 200,
        statusText: 'OK',
        timing: 142,
        size: 1024,
        bodyPreview: '{"data": []}',
        bodyFull: '{"data": []}',
      });

      const { lastFrame } = render(<TranscriptEvent event={event} />);
      const frame = lastFrame();

      expect(frame).toContain('200');
      expect(frame).toContain('OK');
      expect(frame).toContain('142ms');
      expect(frame).toContain('1.0KB');
    });

    it('should format large sizes correctly', () => {
      const event = createEvent('result', {
        status: 200,
        statusText: 'OK',
        timing: 500,
        size: 1024 * 1024 * 2.5, // 2.5MB
        bodyPreview: '...',
        bodyFull: '...',
      });

      const { lastFrame } = render(<TranscriptEvent event={event} />);
      expect(lastFrame()).toContain('2.5MB');
    });
  });

  describe('Notice event', () => {
    it('should render notice with warning indicator', () => {
      const event = createEvent('notice', 'Rate limit approaching (80/100)');

      const { lastFrame } = render(<TranscriptEvent event={event} />);
      const frame = lastFrame();

      expect(frame).toContain('⚠');
      expect(frame).toContain('Rate limit approaching');
    });
  });

  describe('Meta event', () => {
    it('should render meta event dimmed', () => {
      const event = createEvent('meta', 'Workspace loaded: my-api');

      const { lastFrame } = render(<TranscriptEvent event={event} />);

      expect(lastFrame()).toContain('Workspace loaded: my-api');
    });
  });
});
