/**
 * Tests for Transcript Component
 */

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type { TranscriptEvent as TranscriptEventType } from '../../state/types.js';
import { Transcript } from '../Transcript.js';

describe('Transcript', () => {
  const createCommandEvent = (id: string, content: string): TranscriptEventType => ({
    id,
    timestamp: new Date(),
    type: 'command',
    content,
  });

  const createResultEvent = (id: string, status: number): TranscriptEventType => ({
    id,
    timestamp: new Date(),
    type: 'result',
    content: {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      timing: 100,
      size: 256,
      bodyPreview: '{"data": []}',
      bodyFull: '{"data": []}',
    },
  });

  describe('Event list rendering', () => {
    it('should render multiple events in order', () => {
      // Given multiple events
      const events: TranscriptEventType[] = [
        createCommandEvent('1', 'get /users'),
        createResultEvent('2', 200),
        createCommandEvent('3', 'get /products'),
        createResultEvent('4', 200),
      ];

      // When rendered with enough height for all events
      const { lastFrame } = render(<Transcript events={events} maxHeight={50} />);
      const frame = lastFrame();

      // Then all events are visible
      expect(frame).toContain('get /users');
      expect(frame).toContain('get /products');
      expect(frame).toContain('200');
    });

    it('should render nothing when events array is empty', () => {
      const { lastFrame } = render(<Transcript events={[]} />);

      // Empty transcript returns null, so frame should be empty or minimal
      expect(lastFrame()).toBe('');
    });

    it('should render single event', () => {
      const events = [createCommandEvent('1', 'help')];

      const { lastFrame } = render(<Transcript events={events} />);

      expect(lastFrame()).toContain('help');
    });
  });

  describe('Mixed event types', () => {
    it('should render command and result together', () => {
      const events: TranscriptEventType[] = [
        createCommandEvent('1', 'post /users'),
        {
          id: '2',
          timestamp: new Date(),
          type: 'result',
          content: {
            status: 201,
            statusText: 'Created',
            timing: 89,
            size: 156,
            bodyPreview: '{"id": 3, "name": "Alice"}',
            bodyFull: '{"id": 3, "name": "Alice"}',
          },
        },
      ];

      const { lastFrame } = render(<Transcript events={events} />);
      const frame = lastFrame();

      expect(frame).toContain('post /users');
      expect(frame).toContain('201');
      expect(frame).toContain('Created');
      expect(frame).toContain('89ms');
    });

    it('should render error events', () => {
      const events: TranscriptEventType[] = [
        createCommandEvent('1', 'get /broken'),
        {
          id: '2',
          timestamp: new Date(),
          type: 'error',
          content: 'ECONNREFUSED: Connection refused',
        },
      ];

      const { lastFrame } = render(<Transcript events={events} />);
      const frame = lastFrame();

      expect(frame).toContain('get /broken');
      expect(frame).toContain('Connection refused');
    });

    it('should render notice events', () => {
      const events: TranscriptEventType[] = [
        createCommandEvent('1', 'get /api'),
        {
          id: '2',
          timestamp: new Date(),
          type: 'notice',
          content: 'Rate limit: 80/100 requests',
        },
      ];

      const { lastFrame } = render(<Transcript events={events} />);
      const frame = lastFrame();

      expect(frame).toContain('get /api');
      expect(frame).toContain('Rate limit');
    });
  });
});
