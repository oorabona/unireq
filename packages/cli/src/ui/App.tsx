/**
 * Ink-based Terminal UI - Root Application Component
 *
 * Provides a Claude Code-like UX with:
 * - Persistent status header
 * - Scrollable transcript
 * - Keyboard shortcuts for inspection
 * - OpenAPI-aware autocomplete
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import type { ReplState } from '../repl/state.js';
import { StatusLine } from './components/StatusLine.js';

export interface AppProps {
  initialState: ReplState;
}

/**
 * Root Ink application component
 *
 * Currently a shell component that will be expanded with:
 * - StatusLine (done)
 * - Transcript (TODO)
 * - CommandLine (TODO)
 * - InspectorModal (TODO)
 */
export function App({ initialState }: AppProps): ReactNode {
  return (
    <Box flexDirection="column" padding={1}>
      <StatusLine
        workspace={initialState.workspace}
        currentPath={initialState.currentPath}
        activeProfile={initialState.activeProfile}
      />
      <Box marginTop={1}>
        <Text color="green">Ink UI initialized</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
