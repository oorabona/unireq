/**
 * StatusLine Component
 *
 * Persistent header showing workspace, profile, full URL, auth status, and last response.
 * Implements US-1: Persistent Status Header
 *
 * Layout with workspace: [workspace:profile] fullUrl · auth · lastStatus · lastTime
 * Layout without workspace: unireq /path
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { buildDisplayUrl } from '../../repl/url-resolver.js';
import { getStatusColor, useSettingsColors } from '../hooks/useSettingsColors.js';

export interface StatusLineProps {
  /** Workspace name (for display) */
  workspaceName?: string;
  /** Active profile name */
  activeProfile?: string;
  /** Base URL from active profile */
  baseUrl?: string;
  /** Current navigation path */
  currentPath: string;
  /** Whether authentication is configured/active */
  authStatus?: 'authenticated' | 'unauthenticated' | 'none';
  /** Last response details */
  lastResponse?: {
    status: number;
    statusText: string;
    timing: number;
  };
  /** URL of the last request (to check if it matches baseUrl context) */
  lastRequestUrl?: string;
}

/**
 * Get auth status indicator
 */
function getAuthIndicator(
  status: 'authenticated' | 'unauthenticated' | 'none' | undefined,
  colors: { status2xx: string; status3xx: string },
): ReactNode {
  if (!status || status === 'none') return null;

  if (status === 'authenticated') {
    return (
      <>
        <Text dimColor> · </Text>
        <Text color={colors.status2xx}>auth ✓</Text>
      </>
    );
  }

  return (
    <>
      <Text dimColor> · </Text>
      <Text color={colors.status3xx}>no auth</Text>
    </>
  );
}

/**
 * Format workspace:profile badge
 */
function formatContextBadge(workspace?: string, profile?: string): string | undefined {
  if (!workspace) return undefined;

  // Skip "(local)" pseudo-workspace
  if (workspace === '(local)') return undefined;

  if (profile) {
    return `${workspace}:${profile}`;
  }
  return workspace;
}

/**
 * Check if the last request URL belongs to the current workspace context
 * Returns true if lastRequestUrl starts with baseUrl (same host/origin)
 */
function isRequestInContext(lastRequestUrl?: string, baseUrl?: string): boolean {
  if (!lastRequestUrl || !baseUrl) return false;

  try {
    const requestOrigin = new URL(lastRequestUrl).origin;
    const baseOrigin = new URL(baseUrl).origin;
    return requestOrigin === baseOrigin;
  } catch {
    // If URL parsing fails, fall back to simple prefix check
    return lastRequestUrl.startsWith(baseUrl);
  }
}

export function StatusLine({
  workspaceName,
  activeProfile,
  baseUrl,
  currentPath,
  authStatus,
  lastResponse,
  lastRequestUrl,
}: StatusLineProps): ReactNode {
  const colors = useSettingsColors();
  const contextBadge = formatContextBadge(workspaceName, activeProfile);
  const fullUrl = buildDisplayUrl({ baseUrl, currentPath });

  // Only show lastResponse if the request was to the same origin as baseUrl
  const showLastResponse = lastResponse && isRequestInContext(lastRequestUrl, baseUrl);

  // Map colors for helper function
  const authColors = { status2xx: colors.status['2xx'], status3xx: colors.status['3xx'] };

  // When we have a workspace context with baseUrl
  if (contextBadge && fullUrl) {
    return (
      <Box borderStyle="single" borderColor={colors.ui.border} paddingX={1}>
        {/* Context badge [workspace:profile] */}
        <Text color="magenta">[</Text>
        <Text color={colors.ui.prompt} bold>
          {contextBadge}
        </Text>
        <Text color="magenta">]</Text>

        {/* Full URL */}
        <Text> </Text>
        <Text color="blue">{fullUrl}</Text>

        {/* Auth indicator */}
        {getAuthIndicator(authStatus, authColors)}

        {/* Last response (only if request was to this workspace's base URL) */}
        {showLastResponse && (
          <>
            <Text dimColor> · </Text>
            <Text color={getStatusColor(lastResponse.status, colors)}>
              {lastResponse.status} {lastResponse.statusText}
            </Text>
            <Text dimColor> · </Text>
            <Text color={colors.ui.muted}>{lastResponse.timing}ms</Text>
          </>
        )}
      </Box>
    );
  }

  // Without workspace context - minimal display
  return (
    <Box borderStyle="single" borderColor={colors.ui.border} paddingX={1}>
      {/* Brand */}
      <Text color={colors.ui.prompt} bold>
        unireq
      </Text>

      {/* Current path only */}
      <Text> </Text>
      <Text color="blue">{currentPath}</Text>

      {/* Auth indicator (still show if configured) */}
      {getAuthIndicator(authStatus, authColors)}

      {/* Last response */}
      {lastResponse && (
        <>
          <Text dimColor> · </Text>
          <Text color={getStatusColor(lastResponse.status, colors)}>
            {lastResponse.status} {lastResponse.statusText}
          </Text>
          <Text dimColor> · </Text>
          <Text color={colors.ui.muted}>{lastResponse.timing}ms</Text>
        </>
      )}
    </Box>
  );
}
