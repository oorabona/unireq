/**
 * Tests for StatusLine Component
 *
 * Implements S-1: Status line shows current context
 */

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { StatusLine } from '../StatusLine.js';

describe('StatusLine', () => {
  describe('S-1: Status line displays context', () => {
    it('should show workspace and path when provided', () => {
      // Given workspace "my-api" is active and current path is "/users"
      // When the UI renders
      const { lastFrame } = render(<StatusLine workspaceName="my-api" currentPath="/users" />);

      // Then status line shows workspace and path
      const frame = lastFrame();
      expect(frame).toContain('my-api');
      expect(frame).toContain('/users');
    });

    it('should not show workspace when workspaceName is undefined', () => {
      // Given no workspace is active
      const { lastFrame } = render(<StatusLine currentPath="/" />);

      // Then status line does NOT show workspace section (no "no workspace" text)
      const frame = lastFrame();
      expect(frame).toContain('unireq');
      expect(frame).toContain('/');
      // Should not contain any workspace-related text
      expect(frame).not.toContain('no workspace');
    });

    it('should show last request status and timing', () => {
      // Given last request returned 200 in 142ms
      const { lastFrame } = render(
        <StatusLine
          workspaceName="my-api"
          currentPath="/users"
          lastResponse={{ status: 200, statusText: 'OK', timing: 142 }}
        />,
      );

      // Then status line shows "200 OK · 142ms"
      const frame = lastFrame();
      expect(frame).toContain('200');
      expect(frame).toContain('OK');
      expect(frame).toContain('142ms');
    });

    it('should show full context together', () => {
      // Given all context is present
      const { lastFrame } = render(
        <StatusLine
          workspaceName="my-api"
          currentPath="/users"
          authStatus="authenticated"
          activeProfile="Bearer"
          lastResponse={{ status: 200, statusText: 'OK', timing: 142 }}
        />,
      );

      // Then all elements are visible
      const frame = lastFrame();
      expect(frame).toContain('my-api');
      expect(frame).toContain('/users');
      expect(frame).toContain('Bearer');
      expect(frame).toContain('200');
      expect(frame).toContain('142ms');
    });
  });

  describe('Auth status indicator', () => {
    it('should show auth checkmark when authenticated', () => {
      const { lastFrame } = render(<StatusLine currentPath="/" authStatus="authenticated" activeProfile="oauth" />);

      expect(lastFrame()).toContain('oauth');
      expect(lastFrame()).toContain('✓');
    });

    it('should show "no auth" when unauthenticated', () => {
      const { lastFrame } = render(<StatusLine currentPath="/" authStatus="unauthenticated" />);

      expect(lastFrame()).toContain('no auth');
    });

    it('should not show auth indicator when status is none', () => {
      const { lastFrame } = render(<StatusLine currentPath="/" authStatus="none" />);

      const frame = lastFrame();
      expect(frame).not.toContain('auth');
      expect(frame).not.toContain('✓');
    });
  });

  describe('HTTP status colors', () => {
    it('should render 2xx status (success)', () => {
      const { lastFrame } = render(
        <StatusLine currentPath="/" lastResponse={{ status: 201, statusText: 'Created', timing: 50 }} />,
      );

      expect(lastFrame()).toContain('201');
      expect(lastFrame()).toContain('Created');
    });

    it('should render 4xx status (client error)', () => {
      const { lastFrame } = render(
        <StatusLine currentPath="/" lastResponse={{ status: 404, statusText: 'Not Found', timing: 30 }} />,
      );

      expect(lastFrame()).toContain('404');
      expect(lastFrame()).toContain('Not Found');
    });

    it('should render 5xx status (server error)', () => {
      const { lastFrame } = render(
        <StatusLine currentPath="/" lastResponse={{ status: 500, statusText: 'Internal Server Error', timing: 100 }} />,
      );

      expect(lastFrame()).toContain('500');
      expect(lastFrame()).toContain('Internal Server Error');
    });
  });

  describe('Brand display', () => {
    it('should always show unireq brand', () => {
      const { lastFrame } = render(<StatusLine currentPath="/" />);

      expect(lastFrame()).toContain('unireq');
    });
  });
});
