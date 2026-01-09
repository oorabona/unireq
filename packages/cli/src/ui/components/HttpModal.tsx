/**
 * HTTP Defaults Modal Component
 *
 * Interactive modal for viewing and editing HTTP output defaults.
 * Has 3 tabs for different save scopes:
 * - Session: ephemeral, stored in REPL state
 * - Profile: saved to workspace.yaml profiles.<name>.defaults
 * - Workspace: saved to workspace.yaml defaults
 *
 * Changes are accumulated locally and only committed on save (Ctrl+S).
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HttpOutputDefaults } from '../../workspace/config/types.js';
import { BUILT_IN_DEFAULTS, resolveDefaultsWithSource } from '../../workspace/http/index.js';
import { HTTP_OUTPUT_DEFAULT_KEYS, type HttpOutputDefaultKey, OUTPUT_MODE_VALUES } from '../../workspace/http/types.js';
import { calculateModalWidth, Modal } from './Modal.js';

/**
 * Props for HttpModal component
 */
export interface HttpModalProps {
  /** Callback when modal should close */
  onClose: () => void;
  /** Current session defaults (from REPL state) */
  sessionDefaults?: HttpOutputDefaults;
  /** Workspace defaults from config */
  workspaceDefaults?: HttpOutputDefaults;
  /** Active profile defaults from config */
  profileDefaults?: HttpOutputDefaults;
  /** Active profile name */
  activeProfile?: string;
  /** Callback when session defaults change */
  onSessionChange?: (defaults: HttpOutputDefaults | undefined) => void;
  /** Callback when profile defaults should be saved */
  onProfileSave?: (defaults: HttpOutputDefaults) => void;
  /** Callback when workspace defaults should be saved */
  onWorkspaceSave?: (defaults: HttpOutputDefaults) => void;
}

/**
 * Tab type
 */
type TabType = 'session' | 'profile' | 'workspace';

/**
 * Pending changes for a specific scope
 */
type PendingDefaults = Partial<HttpOutputDefaults>;

/**
 * HTTP Defaults Modal
 *
 * Interactive modal for editing HTTP output defaults.
 * Has 3 tabs for different save scopes (Session/Profile/Workspace).
 *
 * Navigation:
 * - Tab/Shift+Tab to switch between tabs
 * - Up/Down arrows to navigate settings
 * - Left/Right arrows or Space to change values
 * - Ctrl+S to save, Escape to close
 */
export function HttpModal({
  onClose,
  sessionDefaults,
  workspaceDefaults,
  profileDefaults,
  activeProfile,
  onSessionChange,
  onProfileSave,
  onWorkspaceSave,
}: HttpModalProps): ReactNode {
  const [activeTab, setActiveTab] = useState<TabType>('session');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  // Pending changes per tab
  const [pendingSession, setPendingSession] = useState<PendingDefaults>({});
  const [pendingProfile, setPendingProfile] = useState<PendingDefaults>({});
  const [pendingWorkspace, setPendingWorkspace] = useState<PendingDefaults>({});

  // Get current pending state for active tab
  const currentPending = useMemo(() => {
    switch (activeTab) {
      case 'session':
        return pendingSession;
      case 'profile':
        return pendingProfile;
      case 'workspace':
        return pendingWorkspace;
    }
  }, [activeTab, pendingSession, pendingProfile, pendingWorkspace]);

  // Get the setter for current tab
  const setCurrentPending = useCallback(
    (updater: (prev: PendingDefaults) => PendingDefaults) => {
      switch (activeTab) {
        case 'session':
          setPendingSession(updater);
          break;
        case 'profile':
          setPendingProfile(updater);
          break;
        case 'workspace':
          setPendingWorkspace(updater);
          break;
      }
    },
    [activeTab],
  );

  // Get the baseline for current tab (what's currently saved)
  const currentBaseline = useMemo((): HttpOutputDefaults => {
    switch (activeTab) {
      case 'session':
        return sessionDefaults ?? {};
      case 'profile':
        return profileDefaults ?? {};
      case 'workspace':
        return workspaceDefaults ?? {};
    }
  }, [activeTab, sessionDefaults, profileDefaults, workspaceDefaults]);

  // Get effective value for a key (pending or baseline)
  const getEffectiveValue = useCallback(
    (key: HttpOutputDefaultKey): boolean | string => {
      if (key in currentPending) {
        return currentPending[key] as boolean | string;
      }
      if (key in currentBaseline) {
        return currentBaseline[key] as boolean | string;
      }
      return BUILT_IN_DEFAULTS[key];
    },
    [currentPending, currentBaseline],
  );

  // Check if a key is modified in current tab
  const isModified = useCallback(
    (key: HttpOutputDefaultKey): boolean => {
      return key in currentPending;
    },
    [currentPending],
  );

  // Check if any changes pending in current tab
  const hasChanges = useMemo(() => {
    return Object.keys(currentPending).length > 0;
  }, [currentPending]);

  // Track previous hasChanges to clear justSaved
  const prevHasChangesRef = useRef(hasChanges);
  useEffect(() => {
    if (justSaved && hasChanges && !prevHasChangesRef.current) {
      setJustSaved(false);
    }
    prevHasChangesRef.current = hasChanges;
  }, [justSaved, hasChanges]);

  // Resolve effective values with source tracking for display
  const resolvedDefaults = useMemo(() => {
    return resolveDefaultsWithSource(undefined, workspaceDefaults, profileDefaults, activeProfile, sessionDefaults);
  }, [workspaceDefaults, profileDefaults, activeProfile, sessionDefaults]);

  // Cycle through options for a key
  const cycleOption = useCallback(
    (key: HttpOutputDefaultKey, direction: 1 | -1) => {
      if (key === 'outputMode') {
        const currentValue = String(getEffectiveValue(key));
        const options = OUTPUT_MODE_VALUES;
        const currentIndex = options.indexOf(currentValue as (typeof options)[number]);
        const newIndex = (currentIndex + direction + options.length) % options.length;
        const newValue = options[newIndex];

        if (newValue !== undefined) {
          // If new value equals baseline, remove from pending
          if (
            newValue === currentBaseline.outputMode ||
            (newValue === 'pretty' && currentBaseline.outputMode === undefined)
          ) {
            setCurrentPending((prev) => {
              const next = { ...prev };
              delete next.outputMode;
              return next;
            });
          } else {
            setCurrentPending((prev) => ({ ...prev, outputMode: newValue }));
          }
        }
      } else {
        // Toggle boolean
        const currentValue = getEffectiveValue(key) as boolean;
        const newValue = !currentValue;

        // If new value equals baseline or built-in, remove from pending
        const baselineValue = currentBaseline[key] ?? BUILT_IN_DEFAULTS[key];
        if (newValue === baselineValue) {
          setCurrentPending((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        } else {
          setCurrentPending((prev) => ({ ...prev, [key]: newValue }));
        }
      }
    },
    [getEffectiveValue, currentBaseline, setCurrentPending],
  );

  // Commit changes for current tab
  const commitChanges = useCallback(() => {
    if (!hasChanges) {
      onClose();
      return;
    }

    // Build the new defaults by merging pending with baseline
    const newDefaults: HttpOutputDefaults = { ...currentBaseline };
    for (const [key, value] of Object.entries(currentPending)) {
      (newDefaults as Record<string, unknown>)[key] = value;
    }

    switch (activeTab) {
      case 'session':
        // For session, merge with existing or create new
        onSessionChange?.(Object.keys(newDefaults).length > 0 ? newDefaults : undefined);
        break;
      case 'profile':
        onProfileSave?.(newDefaults);
        break;
      case 'workspace':
        onWorkspaceSave?.(newDefaults);
        break;
    }

    // Clear pending and show saved indicator
    setCurrentPending(() => ({}));
    setJustSaved(true);
  }, [
    hasChanges,
    activeTab,
    currentBaseline,
    currentPending,
    onClose,
    onSessionChange,
    onProfileSave,
    onWorkspaceSave,
    setCurrentPending,
  ]);

  // Switch tabs
  const switchTab = useCallback((direction: 1 | -1) => {
    const tabs: TabType[] = ['session', 'profile', 'workspace'];
    setActiveTab((current) => {
      const currentIndex = tabs.indexOf(current);
      const newIndex = (currentIndex + direction + tabs.length) % tabs.length;
      return tabs[newIndex] ?? 'session';
    });
    setJustSaved(false);
  }, []);

  // Handle keyboard input
  useInput(
    useCallback(
      (input, key) => {
        // Ctrl+S - save changes
        if (key.ctrl && input === 's') {
          commitChanges();
          return;
        }

        // Escape - close
        if (key.escape) {
          onClose();
          return;
        }

        // Tab / Shift+Tab - switch tabs
        if (key.tab) {
          switchTab(key.shift ? -1 : 1);
          return;
        }

        // Navigation
        if (key.upArrow || input === 'k') {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.downArrow || input === 'j') {
          setSelectedIndex((prev) => Math.min(HTTP_OUTPUT_DEFAULT_KEYS.length - 1, prev + 1));
          return;
        }

        // Value changes
        const currentKey = HTTP_OUTPUT_DEFAULT_KEYS[selectedIndex];
        if (!currentKey) return;

        if (key.leftArrow || input === 'h') {
          cycleOption(currentKey, -1);
        } else if (key.rightArrow || input === 'l' || input === ' ' || key.return) {
          cycleOption(currentKey, 1);
        }

        // Q to quit
        if (input === 'q' || input === 'Q') {
          onClose();
        }
      },
      [onClose, selectedIndex, cycleOption, commitChanges, switchTab],
    ),
  );

  // Render tab bar
  const renderTabBar = () => {
    // Truncate profile name if too long to prevent overflow
    const profileLabel = activeProfile
      ? `Profile:${activeProfile.length > 15 ? `${activeProfile.slice(0, 12)}...` : activeProfile}`
      : 'Profile';
    const tabs: { key: TabType; label: string; available: boolean }[] = [
      { key: 'session', label: 'Session', available: true },
      { key: 'profile', label: profileLabel, available: !!activeProfile },
      { key: 'workspace', label: 'Workspace', available: true },
    ];

    return (
      <Box marginBottom={1}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.key;
          const hasTabChanges =
            tab.key === 'session'
              ? Object.keys(pendingSession).length > 0
              : tab.key === 'profile'
                ? Object.keys(pendingProfile).length > 0
                : Object.keys(pendingWorkspace).length > 0;

          return (
            <Box key={tab.key}>
              {index > 0 && <Text dimColor> │ </Text>}
              <Text
                color={isActive ? 'cyan' : tab.available ? undefined : 'gray'}
                bold={isActive}
                dimColor={!tab.available}
              >
                {tab.label}
              </Text>
              {hasTabChanges && (
                <Text color="yellow" bold>
                  *
                </Text>
              )}
            </Box>
          );
        })}
      </Box>
    );
  };

  // Render settings list
  const renderSettings = () => {
    return (
      <Box flexDirection="column">
        {HTTP_OUTPUT_DEFAULT_KEYS.map((key, index) => {
          const isSelected = index === selectedIndex;
          const modified = isModified(key);
          const effectiveValue = getEffectiveValue(key);
          const resolved = resolvedDefaults[key];

          // Determine if this tab is overriding something
          const isOverride = (() => {
            switch (activeTab) {
              case 'session':
                return sessionDefaults?.[key] !== undefined || modified;
              case 'profile':
                return profileDefaults?.[key] !== undefined || modified;
              case 'workspace':
                return workspaceDefaults?.[key] !== undefined || modified;
            }
          })();

          return (
            <Box key={key} gap={1}>
              {/* Selection indicator */}
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {isSelected ? '▸' : ' '}
              </Text>

              {/* Modified indicator */}
              {modified ? (
                <Text color="yellow" bold>
                  *
                </Text>
              ) : (
                <Text> </Text>
              )}

              {/* Key label */}
              <Box width={16}>
                <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                  {key}
                </Text>
              </Box>

              {/* Value */}
              <Box width={10}>
                {key === 'outputMode' ? (
                  // Pad outputMode value to 6 chars (longest is "pretty") for consistent width
                  <Text color={isSelected ? 'cyan' : undefined}>[{String(effectiveValue).padEnd(6)}]</Text>
                ) : (
                  <Text color={effectiveValue ? 'green' : 'gray'}>[{effectiveValue ? '✓' : ' '}]</Text>
                )}
              </Box>

              {/* Source indicator (only show if not editing this tab's override) */}
              {!modified && <Text dimColor>{isOverride ? `(${activeTab})` : `(${resolved.source})`}</Text>}

              {/* Hint for selected item */}
              {isSelected && <Text dimColor>{key === 'outputMode' ? '← → to change' : '← → or space to toggle'}</Text>}
            </Box>
          );
        })}
      </Box>
    );
  };

  // Build help text - both versions same length (64 chars) for consistent width
  const HELP_WITH_CHANGES = 'Tab: switch · ↑↓: navigate · ←→: change · ^S: save · Esc: cancel';
  const HELP_NO_CHANGES = 'Tab: switch · ↑↓: navigate · ←→: change · Esc: close            ';
  const helpText = hasChanges ? HELP_WITH_CHANGES : HELP_NO_CHANGES;

  // Build title with status - reserve fixed space for status to prevent width changes
  // Status options: " ✓ Saved" (8 chars) or " (modified)" (11 chars) - use 11 chars
  const STATUS_WIDTH = 11;
  const statusText = justSaved && !hasChanges ? '✓ Saved' : hasChanges ? '(modified)' : '';
  const paddedStatus = statusText.padStart(STATUS_WIDTH);

  const titleElement = (
    <Box>
      <Text bold color="cyan">
        🌐 HTTP Defaults
      </Text>
      <Text color={justSaved && !hasChanges ? 'green' : hasChanges ? 'yellow' : undefined} bold={!!statusText}>
        {paddedStatus}
      </Text>
    </Box>
  );

  // Calculate minWidth using the DRY utility
  // Content lines represent the widest possible settings row:
  // "▸ * includeHeaders  [✓]     (workspace)  ← → or space to toggle"
  const longestSettingLine = '▸ * includeHeaders  [✓]     (workspace)  ← → or space to toggle';
  const titleText = `🌐 HTTP Defaults${paddedStatus}`;
  const modalMinWidth = calculateModalWidth({
    footer: helpText,
    title: titleText,
    contentLines: [longestSettingLine],
  });

  return (
    <Modal title={titleElement} borderColor="cyan" footer={helpText} minWidth={modalMinWidth}>
      <Box flexDirection="column">
        {renderTabBar()}
        {renderSettings()}
      </Box>
    </Modal>
  );
}
