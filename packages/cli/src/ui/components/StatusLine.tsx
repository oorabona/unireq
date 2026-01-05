/**
 * StatusLine Component
 *
 * Persistent header showing workspace, path, auth status, and last response.
 * Implements US-1: Persistent Status Header
 *
 * Layout: workspace · cwd · auth · lastStatus · lastTime
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface StatusLineProps {
  /** Workspace name (for display) */
  workspaceName?: string;
  /** Current navigation path */
  currentPath: string;
  /** Active profile name */
  activeProfile?: string;
  /** Whether authentication is configured/active */
  authStatus?: 'authenticated' | 'unauthenticated' | 'none';
  /** Last response details */
  lastResponse?: {
    status: number;
    statusText: string;
    timing: number;
  };
}

/**
 * Format workspace name for display
 * Returns undefined if no workspace (don't show anything)
 */
function formatWorkspaceName(name?: string): string | undefined {
  if (!name || name === '(local)') return undefined;
  return name;
}

/**
 * Get color for HTTP status code
 */
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'green';
  if (status >= 300 && status < 400) return 'yellow';
  if (status >= 400 && status < 500) return 'red';
  if (status >= 500) return 'magenta';
  return 'gray';
}

/**
 * Get auth status indicator
 */
function getAuthIndicator(status?: 'authenticated' | 'unauthenticated' | 'none', profile?: string): ReactNode {
  if (!status || status === 'none') return null;

  if (status === 'authenticated') {
    return (
      <>
        <Text dimColor> · </Text>
        <Text color="green">{profile ?? 'auth'} ✓</Text>
      </>
    );
  }

  return (
    <>
      <Text dimColor> · </Text>
      <Text color="yellow">no auth</Text>
    </>
  );
}

export function StatusLine({
  workspaceName,
  currentPath,
  activeProfile,
  authStatus,
  lastResponse,
}: StatusLineProps): ReactNode {
  const displayName = formatWorkspaceName(workspaceName);

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      {/* Brand */}
      <Text color="cyan" bold>
        unireq
      </Text>

      {/* Workspace (only if defined) */}
      {displayName && (
        <>
          <Text dimColor> · </Text>
          <Text color="white">{displayName}</Text>
        </>
      )}

      {/* Separator */}
      <Text dimColor> · </Text>

      {/* Current path */}
      <Text color="blue">{currentPath}</Text>

      {/* Auth indicator */}
      {getAuthIndicator(authStatus, activeProfile)}

      {/* Last response */}
      {lastResponse && (
        <>
          <Text dimColor> · </Text>
          <Text color={getStatusColor(lastResponse.status)}>
            {lastResponse.status} {lastResponse.statusText}
          </Text>
          <Text dimColor> · </Text>
          <Text color="gray">{lastResponse.timing}ms</Text>
        </>
      )}
    </Box>
  );
}
