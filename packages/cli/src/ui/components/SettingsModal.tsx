/**
 * Settings Modal Component
 *
 * Interactive modal for viewing and editing UI settings.
 * Supports theme, colors, syntax highlighting, and external command options.
 *
 * Changes are accumulated locally and only committed on save (Ctrl+S).
 * Similar pattern to ProfileConfigModal for consistency.
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllSettings, getSetting, setSetting } from '../../workspace/settings/store.js';
import { COLOR_NAMES, type SettingKey, THEME_VALUES } from '../../workspace/settings/types.js';
import { useSettingsColors } from '../hooks/useSettingsColors.js';
import { Modal } from './Modal.js';

/**
 * Props for SettingsModal component
 */
export interface SettingsModalProps {
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when settings are saved (to trigger UI refresh) */
  onSettingsSaved?: () => void;
}

/**
 * Setting item definition for display
 */
interface SettingItem {
  key: SettingKey;
  label: string;
  type: 'select' | 'toggle' | 'color';
  options?: readonly string[];
  group: string;
}

/**
 * Pending changes to be committed
 */
type PendingSettings = Partial<Record<SettingKey, string | boolean>>;

/**
 * All settings grouped for display
 */
const SETTING_ITEMS: SettingItem[] = [
  // Theme
  { key: 'theme', label: 'Mode', type: 'select', options: THEME_VALUES, group: 'Theme' },

  // Event Colors
  { key: 'colors.event.command', label: 'Command', type: 'color', options: COLOR_NAMES, group: 'Event Colors' },
  { key: 'colors.event.result', label: 'Result', type: 'color', options: COLOR_NAMES, group: 'Event Colors' },
  { key: 'colors.event.error', label: 'Error', type: 'color', options: COLOR_NAMES, group: 'Event Colors' },
  { key: 'colors.event.notice', label: 'Notice', type: 'color', options: COLOR_NAMES, group: 'Event Colors' },
  { key: 'colors.event.meta', label: 'Meta', type: 'color', options: COLOR_NAMES, group: 'Event Colors' },

  // Status Colors
  { key: 'colors.status.2xx', label: '2xx (OK)', type: 'color', options: COLOR_NAMES, group: 'HTTP Status' },
  { key: 'colors.status.3xx', label: '3xx (Redirect)', type: 'color', options: COLOR_NAMES, group: 'HTTP Status' },
  { key: 'colors.status.4xx', label: '4xx (Client)', type: 'color', options: COLOR_NAMES, group: 'HTTP Status' },
  { key: 'colors.status.5xx', label: '5xx (Server)', type: 'color', options: COLOR_NAMES, group: 'HTTP Status' },

  // UI Colors
  { key: 'colors.ui.border', label: 'Border', type: 'color', options: COLOR_NAMES, group: 'UI Elements' },
  { key: 'colors.ui.prompt', label: 'Prompt', type: 'color', options: COLOR_NAMES, group: 'UI Elements' },
  { key: 'colors.ui.scrollbar', label: 'Scrollbar', type: 'color', options: COLOR_NAMES, group: 'UI Elements' },
  { key: 'colors.ui.muted', label: 'Muted', type: 'color', options: COLOR_NAMES, group: 'UI Elements' },

  // Syntax
  { key: 'syntax.json', label: 'JSON', type: 'toggle', group: 'Syntax Highlighting' },
  { key: 'syntax.headers', label: 'Headers', type: 'toggle', group: 'Syntax Highlighting' },

  // External
  { key: 'externalColors', label: 'Colors', type: 'toggle', group: 'External Commands' },
];

/**
 * Get unique groups from setting items
 */
function getGroups(): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const item of SETTING_ITEMS) {
    if (!seen.has(item.group)) {
      seen.add(item.group);
      groups.push(item.group);
    }
  }
  return groups;
}

/**
 * Get source badge color
 */
function getSourceColor(source: string): string {
  switch (source) {
    case 'session':
      return 'yellow';
    case 'config':
      return 'green';
    default:
      return 'gray';
  }
}

/**
 * Load current settings as baseline
 */
function loadBaseline(): Record<SettingKey, string | boolean> {
  const baseline: Record<string, string | boolean> = {};
  for (const item of SETTING_ITEMS) {
    const setting = getSetting(item.key);
    baseline[item.key] = setting.value as string | boolean;
  }
  return baseline as Record<SettingKey, string | boolean>;
}

/**
 * Settings Modal
 *
 * Interactive settings editor with keyboard navigation.
 * Changes are accumulated locally and committed with Ctrl+S.
 *
 * Features:
 * - Navigate with up/down arrows (or j/k)
 * - Change values with left/right arrows (or h/l)
 * - Toggle booleans with space/enter
 * - Ctrl+S to save changes
 * - Escape to discard changes and close
 *
 * @example
 * ```tsx
 * <SettingsModal onClose={() => setShowSettings(false)} />
 * ```
 */
export function SettingsModal({ onClose, onSettingsSaved }: SettingsModalProps): ReactNode {
  const colors = useSettingsColors();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  // Baseline: the committed state we compare against
  const [baseline, setBaseline] = useState<Record<SettingKey, string | boolean>>(() => loadBaseline());

  // Pending changes (only modified keys are present)
  const [pending, setPending] = useState<PendingSettings>({});

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return Object.keys(pending).length > 0;
  }, [pending]);

  // Track previous hasChanges to detect when user starts editing after save
  const prevHasChangesRef = useRef(hasChanges);
  useEffect(() => {
    // Clear "just saved" indicator when user makes a NEW change
    if (justSaved && hasChanges && !prevHasChangesRef.current) {
      setJustSaved(false);
    }
    prevHasChangesRef.current = hasChanges;
  }, [justSaved, hasChanges]);

  // Get effective value for a setting (pending or baseline)
  const getEffectiveValue = useCallback(
    (key: SettingKey): string | boolean => {
      if (key in pending) {
        return pending[key] as string | boolean;
      }
      return baseline[key];
    },
    [pending, baseline],
  );

  // Check if a setting is modified
  const isModified = useCallback(
    (key: SettingKey): boolean => {
      return key in pending;
    },
    [pending],
  );

  // Commit all pending changes
  const commitChanges = useCallback(() => {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(pending)) {
      const error = setSetting(key as SettingKey, String(value));
      if (error) {
        errors.push(`${key}: ${error}`);
      }
    }

    // If all succeeded, update baseline
    if (errors.length === 0) {
      const newBaseline = { ...baseline };
      for (const [key, value] of Object.entries(pending)) {
        newBaseline[key as SettingKey] = value as string | boolean;
      }
      setBaseline(newBaseline);

      // Clear pending and show saved indicator
      setPending({});
      setJustSaved(true);

      // Notify parent to refresh colors in UI
      onSettingsSaved?.();
    }
    // Note: errors are silently ignored in UI for now
    // but at least we don't show "Saved" if there were errors
  }, [pending, baseline, onSettingsSaved]);

  // Cycle through options (updates pending, not store)
  const cycleOption = useCallback(
    (item: SettingItem, direction: 1 | -1) => {
      if (!item.options) return;

      const currentValue = String(getEffectiveValue(item.key));
      const options = item.options as readonly string[];
      const currentIndex = options.indexOf(currentValue);
      const newIndex = (currentIndex + direction + options.length) % options.length;
      const newValue = options[newIndex];

      if (newValue !== undefined) {
        // If new value equals baseline, remove from pending (no change)
        if (newValue === baseline[item.key]) {
          setPending((prev) => {
            const next = { ...prev };
            delete next[item.key];
            return next;
          });
        } else {
          setPending((prev) => ({ ...prev, [item.key]: newValue }));
        }
      }
    },
    [getEffectiveValue, baseline],
  );

  // Toggle boolean setting (updates pending, not store)
  const toggleSetting = useCallback(
    (item: SettingItem) => {
      const currentValue = getEffectiveValue(item.key) as boolean;
      const newValue = !currentValue;

      // If new value equals baseline, remove from pending (no change)
      if (newValue === baseline[item.key]) {
        setPending((prev) => {
          const next = { ...prev };
          delete next[item.key];
          return next;
        });
      } else {
        setPending((prev) => ({ ...prev, [item.key]: newValue }));
      }
    },
    [getEffectiveValue, baseline],
  );

  // Handle keyboard input
  useInput(
    useCallback(
      (input, key) => {
        // Ctrl+S - save changes
        if (key.ctrl && input === 's') {
          if (hasChanges) {
            commitChanges();
          } else {
            onClose();
          }
          return;
        }

        // Escape - discard changes and close
        if (key.escape) {
          onClose();
          return;
        }

        // Navigation
        if (key.upArrow || input === 'k') {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.downArrow || input === 'j') {
          setSelectedIndex((prev) => Math.min(SETTING_ITEMS.length - 1, prev + 1));
          return;
        }

        // Value changes
        const currentItem = SETTING_ITEMS[selectedIndex];
        if (!currentItem) return;

        if (currentItem.type === 'toggle') {
          if (input === ' ' || key.return) {
            toggleSetting(currentItem);
          }
        } else if (currentItem.type === 'select' || currentItem.type === 'color') {
          if (key.leftArrow || input === 'h') {
            cycleOption(currentItem, -1);
          } else if (key.rightArrow || input === 'l') {
            cycleOption(currentItem, 1);
          }
        }

        // Q to quit (discard changes)
        if (input === 'q' || input === 'Q') {
          onClose();
        }
      },
      [onClose, selectedIndex, cycleOption, toggleSetting, hasChanges, commitChanges],
    ),
  );

  // Get settings map for source display
  const settingsMap = useMemo(() => {
    const settings = getAllSettings();
    return new Map(settings.map((s) => [s.key, s]));
  }, []);

  // Get groups
  const groups = getGroups();

  // Build help text based on state
  let helpText: string;
  if (hasChanges) {
    helpText = '↑↓ navigate · ←→ change · Ctrl+S save · Esc discard';
  } else {
    helpText = '↑↓ navigate · ←→ change · space toggle · Esc close';
  }

  // Build title with status
  const titleElement = (
    <Box>
      <Text bold color="cyan">
        ⚙ Settings
      </Text>
      {justSaved && !hasChanges && (
        <Text color="green" bold>
          {' '}
          ✓ Saved
        </Text>
      )}
      {hasChanges && (
        <Text color="yellow" bold>
          {' '}
          (modified)
        </Text>
      )}
    </Box>
  );

  // Track item index for selection
  let itemIndex = 0;

  // Live preview: use pending border color if being edited, otherwise use saved color
  const effectiveBorderColor = (pending['colors.ui.border'] as string) ?? colors.ui.border;

  return (
    <Modal title={titleElement} borderColor={effectiveBorderColor} footer={helpText} minWidth={58}>
      <Box flexDirection="column">
        {/* Settings by group */}
        {groups.map((group) => {
          const groupItems = SETTING_ITEMS.filter((item) => item.group === group);

          return (
            <Box key={group} flexDirection="column" marginBottom={1}>
              {/* Group header */}
              <Text bold dimColor>
                {group}
              </Text>

              {/* Group items */}
              {groupItems.map((item, indexInGroup) => {
                const currentIndex = itemIndex++;
                const isSelected = currentIndex === selectedIndex;
                const setting = settingsMap.get(item.key);
                const effectiveValue = getEffectiveValue(item.key);
                const source = setting?.source ?? 'built-in';
                const isLastInGroup = indexInGroup === groupItems.length - 1;
                const modified = isModified(item.key);

                return (
                  <Box key={item.key} gap={1}>
                    {/* Tree indicator */}
                    <Text dimColor>{isLastInGroup ? '└──' : '├──'}</Text>

                    {/* Modified indicator */}
                    {modified ? (
                      <Text color="yellow" bold>
                        *
                      </Text>
                    ) : (
                      <Text> </Text>
                    )}

                    {/* Label */}
                    <Box width={12}>
                      <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                        {item.label}
                      </Text>
                    </Box>

                    {/* Value */}
                    <Box width={14}>
                      {item.type === 'toggle' ? (
                        <Text color={effectiveValue ? 'green' : 'gray'}>[{effectiveValue ? '✓' : ' '}]</Text>
                      ) : (
                        <Text color={isSelected ? 'cyan' : undefined}>[{String(effectiveValue)}]</Text>
                      )}
                    </Box>

                    {/* Source indicator (only if not modified) */}
                    {!modified && (
                      <Text color={getSourceColor(source)} dimColor={source === 'built-in'}>
                        {source === 'built-in' ? '' : `(${source})`}
                      </Text>
                    )}

                    {/* Selection indicator */}
                    {isSelected && (
                      <Text dimColor>{item.type === 'toggle' ? '← space to toggle' : '← → to change'}</Text>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Modal>
  );
}
