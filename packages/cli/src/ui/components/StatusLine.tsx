/**
 * StatusLine Component
 *
 * Persistent header showing workspace, path, auth status, and last response.
 * Implements US-1: Persistent Status Header
 *
 * Layout: workspace · cwd · auth · lastStatus · lastTime
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface StatusLineProps {
  /** Workspace name or path */
  workspace?: string;
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
 * Get display name from workspace path
 */
function getWorkspaceName(workspace?: string): string {
  if (!workspace) return 'no workspace';
  // Extract directory name from path
  const parts = workspace.split('/');
  return parts[parts.length - 1] ?? workspace;
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
  workspace,
  currentPath,
  activeProfile,
  authStatus,
  lastResponse,
}: StatusLineProps): ReactNode {
  const workspaceName = getWorkspaceName(workspace);

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      {/* Brand */}
      <Text color="cyan" bold>
        unireq
      </Text>

      {/* Separator */}
      <Text dimColor> · </Text>

      {/* Workspace */}
      <Text color={workspace ? 'white' : 'gray'}>{workspaceName}</Text>

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
