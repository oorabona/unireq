/**
 * Tests for StatusLine Component
 *
 * Covers BDD scenarios:
 * - S-1: Header displays full URL with workspace and profile
 * - S-2: Header displays minimal info without workspace
 */

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { StatusLine } from '../StatusLine.js';

describe('StatusLine', () => {
  describe('S-1: Header displays full URL with workspace and profile', () => {
    it('should show [workspace:profile] fullUrl format', () => {
      // Given a workspace "my-api" with profile "prod" is active
      // And the profile has baseUrl "https://api.example.com"
      // And currentPath is "/users"
      const { lastFrame } = render(
        <StatusLine
          workspaceName="my-api"
          activeProfile="prod"
          baseUrl="https://api.example.com"
          currentPath="/users"
        />,
      );

      // Then it displays "[my-api:prod] https://api.example.com/users"
      const frame = lastFrame();
      expect(frame).toContain('[');
      expect(frame).toContain('my-api:prod');
      expect(frame).toContain(']');
      expect(frame).toContain('https://api.example.com/users');
    });

    it('should show workspace without profile if no profile active', () => {
      const { lastFrame } = render(
        <StatusLine workspaceName="my-api" baseUrl="https://api.example.com" currentPath="/users" />,
      );

      const frame = lastFrame();
      expect(frame).toContain('[');
      expect(frame).toContain('my-api');
      expect(frame).toContain(']');
      expect(frame).not.toContain(':prod');
    });

    it('should show last response with full URL context', () => {
      const { lastFrame } = render(
        <StatusLine
          workspaceName="my-api"
          activeProfile="prod"
          baseUrl="https://api.example.com"
          currentPath="/users"
          lastResponse={{ status: 200, statusText: 'OK', timing: 142 }}
        />,
      );

      const frame = lastFrame();
      expect(frame).toContain('my-api:prod');
      expect(frame).toContain('https://api.example.com/users');
      expect(frame).toContain('200');
      expect(frame).toContain('OK');
      expect(frame).toContain('142ms');
    });

    it('should show auth status with full context', () => {
      const { lastFrame } = render(
        <StatusLine
          workspaceName="my-api"
          activeProfile="prod"
          baseUrl="https://api.example.com"
          currentPath="/users"
          authStatus="authenticated"
        />,
      );

      const frame = lastFrame();
      expect(frame).toContain('my-api:prod');
      expect(frame).toContain('auth ✓');
    });
  });

  describe('S-2: Header displays minimal info without workspace', () => {
    it('should show "unireq /path" when no workspace', () => {
      // Given no workspace is active
      // And currentPath is "/users"
      const { lastFrame } = render(<StatusLine currentPath="/users" />);

      // Then it displays "unireq /users"
      const frame = lastFrame();
      expect(frame).toContain('unireq');
      expect(frame).toContain('/users');
      // No baseUrl shown
      expect(frame).not.toContain('https://');
      // No workspace badge shown
      expect(frame).not.toContain('my-api');
    });

    it('should show "unireq /" for root path', () => {
      const { lastFrame } = render(<StatusLine currentPath="/" />);

      const frame = lastFrame();
      expect(frame).toContain('unireq');
      expect(frame).toContain('/');
    });

    it('should show last response even without workspace', () => {
      const { lastFrame } = render(
        <StatusLine currentPath="/users" lastResponse={{ status: 404, statusText: 'Not Found', timing: 30 }} />,
      );

      const frame = lastFrame();
      expect(frame).toContain('unireq');
      expect(frame).toContain('404');
      expect(frame).toContain('Not Found');
    });

    it('should skip (local) pseudo-workspace', () => {
      const { lastFrame } = render(<StatusLine workspaceName="(local)" currentPath="/users" />);

      const frame = lastFrame();
      expect(frame).toContain('unireq');
      expect(frame).not.toContain('(local)');
      // Should show minimal format, not workspace format
    });
  });

  describe('Auth status indicator', () => {
    it('should show auth checkmark when authenticated', () => {
      const { lastFrame } = render(<StatusLine currentPath="/" authStatus="authenticated" />);

      expect(lastFrame()).toContain('auth ✓');
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

  describe('Edge cases', () => {
    it('should handle workspace with baseUrl but no profile', () => {
      const { lastFrame } = render(
        <StatusLine workspaceName="my-api" baseUrl="https://api.example.com" currentPath="/users" />,
      );

      const frame = lastFrame();
      // Workspace badge shown (brackets may be colored separately)
      expect(frame).toContain('my-api');
      expect(frame).toContain('https://api.example.com/users');
    });

    it('should handle workspace without baseUrl (fallback to minimal)', () => {
      const { lastFrame } = render(<StatusLine workspaceName="my-api" activeProfile="prod" currentPath="/users" />);

      // Without baseUrl, should fall back to minimal display
      const frame = lastFrame();
      expect(frame).toContain('unireq');
      expect(frame).toContain('/users');
    });
  });
});
