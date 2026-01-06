/**
 * Tests for Ink UI App component
 *
 * Uses UNIREQ_HOME environment variable to isolate tests from the real config.
 */

import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render } from 'ink-testing-library';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReplState } from '../../repl/state.js';
import { UNIREQ_HOME_ENV } from '../../workspace/paths.js';
import { App } from '../App.js';

// Store original UNIREQ_HOME to restore after tests
let originalUnireqHome: string | undefined;
let testHomeDir: string;

// Setup isolated UNIREQ_HOME for all tests in this file
beforeAll(() => {
  // Save original UNIREQ_HOME value
  originalUnireqHome = process.env[UNIREQ_HOME_ENV];

  // Create temp directory and set UNIREQ_HOME to isolate tests
  testHomeDir = join(tmpdir(), `unireq-app-test-${Date.now()}`);
  mkdirSync(testHomeDir, { recursive: true });
  process.env[UNIREQ_HOME_ENV] = testHomeDir;
});

afterAll(() => {
  // Restore original UNIREQ_HOME value
  if (originalUnireqHome === undefined) {
    delete process.env[UNIREQ_HOME_ENV];
  } else {
    process.env[UNIREQ_HOME_ENV] = originalUnireqHome;
  }

  // Clean up temp directory
  try {
    rmSync(testHomeDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

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

    it('should not show workspace when workspace is undefined', () => {
      // Given no workspace is active
      const state = createMockState({
        workspace: undefined,
        currentPath: '/',
      });

      // When the UI renders
      const { lastFrame } = render(<App initialState={state} />);

      // Then status line does NOT show workspace (just brand + path)
      const frame = lastFrame();
      expect(frame).toContain('unireq');
      expect(frame).toContain('/');
      expect(frame).not.toContain('no workspace');
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
    it('should render command prompt with bordered input', () => {
      const state = createMockState();
      const { lastFrame } = render(<App initialState={state} />);
      const frame = lastFrame() ?? '';

      // Claude Code style: simple ">" prompt in a bordered box
      expect(frame).toContain('>');
      // Should have round border characters
      expect(frame).toMatch(/[╭╮╰╯]/);
    });

    it('should show keyboard shortcuts hint bar', () => {
      const state = createMockState();
      const { lastFrame } = render(<App initialState={state} />);

      // Hint bar shows keyboard shortcuts (Claude Code style with ^ notation)
      expect(lastFrame()).toContain('^C quit');
    });
  });
});
