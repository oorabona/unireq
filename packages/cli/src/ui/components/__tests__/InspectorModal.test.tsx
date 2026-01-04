/**
 * Tests for Inspector Modal Component
 */

import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import type { InspectorResponse } from '../InspectorModal.js';
import { InspectorModal } from '../InspectorModal.js';

const mockResponse: InspectorResponse = {
  status: 200,
  statusText: 'OK',
  headers: {
    'Content-Type': 'application/json',
    'X-Request-Id': 'abc-123',
  },
  body: '{\n  "id": 1,\n  "name": "Alice"\n}',
  duration: 142,
  method: 'GET',
  url: '/users/1',
};

describe('InspectorModal', () => {
  describe('Rendering', () => {
    it('should render status and status text', () => {
      const { lastFrame } = render(<InspectorModal response={mockResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('200');
      expect(lastFrame()).toContain('OK');
    });

    it('should render duration', () => {
      const { lastFrame } = render(<InspectorModal response={mockResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('142ms');
    });

    it('should render method and URL', () => {
      const { lastFrame } = render(<InspectorModal response={mockResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('GET');
      expect(lastFrame()).toContain('/users/1');
    });

    it('should render Inspector title', () => {
      const { lastFrame } = render(<InspectorModal response={mockResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('Inspector');
    });

    it('should render close hint', () => {
      const { lastFrame } = render(<InspectorModal response={mockResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('[Esc] Close');
    });

    it('should render tab bar', () => {
      const { lastFrame } = render(<InspectorModal response={mockResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('[H] Headers');
      expect(lastFrame()).toContain('[B] Body');
    });
  });

  describe('Body tab (default)', () => {
    it('should show body content by default', () => {
      const { lastFrame } = render(<InspectorModal response={mockResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('"id": 1');
      expect(lastFrame()).toContain('"name": "Alice"');
    });

    it('should handle empty body gracefully', () => {
      const emptyResponse = { ...mockResponse, body: '' };
      const { lastFrame } = render(<InspectorModal response={emptyResponse} onClose={() => {}} />);

      // Should not crash and should render
      expect(lastFrame()).toContain('Inspector');
      expect(lastFrame()).toContain('200');
    });
  });

  describe('Close handling', () => {
    it('should call onClose when Escape is pressed', async () => {
      const onClose = vi.fn();
      const { stdin } = render(<InspectorModal response={mockResponse} onClose={onClose} />);

      await stdin.write('\x1B'); // Escape

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error response styling', () => {
    it('should handle 404 response', () => {
      const notFoundResponse: InspectorResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        body: '{"error": "User not found"}',
      };

      const { lastFrame } = render(<InspectorModal response={notFoundResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('404');
      expect(lastFrame()).toContain('Not Found');
    });

    it('should handle 500 response', () => {
      const serverErrorResponse: InspectorResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        body: '{"error": "Something went wrong"}',
      };

      const { lastFrame } = render(<InspectorModal response={serverErrorResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('500');
      expect(lastFrame()).toContain('Internal Server Error');
    });

    it('should handle 301 redirect response', () => {
      const redirectResponse: InspectorResponse = {
        status: 301,
        statusText: 'Moved Permanently',
        headers: { Location: 'https://example.com/new' },
        body: '',
      };

      const { lastFrame } = render(<InspectorModal response={redirectResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('301');
      expect(lastFrame()).toContain('Moved Permanently');
    });
  });

  describe('Scrolling', () => {
    const longBodyResponse: InspectorResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n'),
    };

    it('should show scroll indicator for long content', () => {
      const { lastFrame } = render(<InspectorModal response={longBodyResponse} onClose={() => {}} maxHeight={15} />);

      expect(lastFrame()).toContain('of 50');
    });

    it('should show scroll hint for long content', () => {
      const { lastFrame } = render(<InspectorModal response={longBodyResponse} onClose={() => {}} maxHeight={15} />);

      expect(lastFrame()).toContain('↑↓/jk scroll');
    });

    it('should show first lines of content', () => {
      const { lastFrame } = render(<InspectorModal response={longBodyResponse} onClose={() => {}} maxHeight={15} />);

      expect(lastFrame()).toContain('Line 1');
    });
  });

  describe('Without optional fields', () => {
    it('should render without method and URL', () => {
      const minimalResponse: InspectorResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: 'OK',
      };

      const { lastFrame } = render(<InspectorModal response={minimalResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('200');
      expect(lastFrame()).not.toContain('GET');
      expect(lastFrame()).not.toContain('undefined');
    });

    it('should render without duration', () => {
      const noDurationResponse: InspectorResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: 'OK',
      };

      const { lastFrame } = render(<InspectorModal response={noDurationResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('200');
      expect(lastFrame()).not.toContain('ms');
    });
  });

  describe('Headers display', () => {
    it('should have headers tab available', () => {
      const { lastFrame } = render(<InspectorModal response={mockResponse} onClose={() => {}} />);

      expect(lastFrame()).toContain('[H] Headers');
    });
  });
});
