/**
 * Tests for Ink UI App component
 */

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type { ReplState } from '../../repl/state.js';
import { App } from '../App.js';

describe('App', () => {
  const createMockState = (overrides: Partial<ReplState> = {}): ReplState => ({
    currentPath: '/',
    running: true,
    workspace: undefined,
    workspaceConfig: undefined,
    activeProfile: undefined,
    spec: undefined,
    navigationTree: undefined,
    vault: undefined,
    lastRequest: undefined,
    lastResponseBody: undefined,
    extractedVars: undefined,
    historyWriter: undefined,
    isReplMode: true,
    sessionDefaults: undefined,
    ...overrides,
  });

  describe('S-1: Status line displays context', () => {
    it('should render workspace name when provided', () => {
      // Given workspace "my-api" is active
      const state = createMockState({
        workspace: '/path/to/my-api',
        currentPath: '/users',
      });

      // When the UI renders
      const { lastFrame } = render(<App initialState={state} />);

      // Then status line shows workspace info
      const frame = lastFrame();
      expect(frame).toContain('unireq');
      expect(frame).toContain('/users');
    });

    it('should show "no workspace" when workspace is undefined', () => {
      // Given no workspace is active
      const state = createMockState({
        workspace: undefined,
        currentPath: '/',
      });

      // When the UI renders
      const { lastFrame } = render(<App initialState={state} />);

      // Then status line shows "no workspace"
      expect(lastFrame()).toContain('no workspace');
    });

    it('should render current path', () => {
      // Given current path is "/products"
      const state = createMockState({
        currentPath: '/products',
      });

      // When the UI renders
      const { lastFrame } = render(<App initialState={state} />);

      // Then status line shows the path
      expect(lastFrame()).toContain('/products');
    });
  });

  describe('Basic rendering', () => {
    it('should render Ink UI initialized message', () => {
      const state = createMockState();
      const { lastFrame } = render(<App initialState={state} />);

      expect(lastFrame()).toContain('Ink UI initialized');
    });

    it('should show exit hint', () => {
      const state = createMockState();
      const { lastFrame } = render(<App initialState={state} />);

      expect(lastFrame()).toContain('Press Ctrl+C to exit');
    });
  });
});
