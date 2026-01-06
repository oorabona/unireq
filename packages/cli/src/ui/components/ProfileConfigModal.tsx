/**
 * Profile Configuration Modal Component
 *
 * Interactive modal for editing profile settings.
 * Arrow key navigation with inline editing.
 * Sub-modals for headers and variables management.
 *
 * Changes are accumulated locally and only committed on save (Ctrl+S).
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCursor } from '../hooks/useCursor.js';
import { useRawKeyDetection } from '../hooks/useRawKeyDetection.js';
import type { CursorSettings } from '../state/types.js';
import { KeyValueListModal } from './KeyValueListModal.js';
import { Modal } from './Modal.js';

/**
 * Profile configuration data
 */
export interface ProfileConfigData {
  /** Profile name */
  name: string;
  /** Base URL */
  baseUrl: string;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** TLS verification */
  verifyTls: boolean;
  /** Headers */
  headers: Record<string, string>;
  /** Variables */
  vars: Record<string, string>;
}

/**
 * Pending changes to be committed
 */
interface PendingChanges {
  baseUrl?: string;
  timeoutMs?: number;
  verifyTls?: boolean;
  headers: Record<string, string>; // merged with original
  vars: Record<string, string>; // merged with original
  deletedHeaders: Set<string>;
  deletedVars: Set<string>;
}

/**
 * Props for ProfileConfigModal component
 */
export interface ProfileConfigModalProps {
  /** Profile configuration to edit */
  profile: ProfileConfigData;
  /** Callback when modal should close (without saving) */
  onClose: () => void;
  /** Callback when a value is saved */
  onSave: (key: string, value: string) => void;
  /** Callback when an item is deleted */
  onDelete?: (key: string) => void;
  /** Cursor display settings */
  cursorSettings?: CursorSettings;
}

/**
 * Menu item types
 */
interface MenuItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Current value (for display) */
  value: string;
  /** Item type */
  type: 'editable' | 'toggle' | 'submenu';
  /** Whether value has been modified */
  isModified: boolean;
}

/**
 * Which sub-modal is open
 */
type SubModal = 'headers' | 'variables' | null;

/**
 * Create initial pending changes state
 */
function createInitialPendingChanges(profile: ProfileConfigData): PendingChanges {
  return {
    headers: { ...profile.headers },
    vars: { ...profile.vars },
    deletedHeaders: new Set(),
    deletedVars: new Set(),
  };
}

/**
 * Profile Configuration Modal
 *
 * Interactive modal for editing profile settings.
 * Changes are accumulated locally and committed with Ctrl+S.
 */
export function ProfileConfigModal({
  profile,
  onClose,
  onSave,
  onDelete,
  cursorSettings,
}: ProfileConfigModalProps): ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [subModal, setSubModal] = useState<SubModal>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Local state for pending changes
  const [pending, setPending] = useState<PendingChanges>(() => createInitialPendingChanges(profile));

  // Track the "baseline" after a save - what we consider as "committed"
  const [baseline, setBaseline] = useState<ProfileConfigData>(profile);

  // Flag to ignore next Esc (set when closing sub-modal)
  const [ignoreNextEsc, setIgnoreNextEsc] = useState(false);

  // Use shared hook for Backspace/Delete detection
  const { detectKey } = useRawKeyDetection();

  // Use cursor hook with settings (blinking cursor when editing)
  const { visible: cursorVisible } = useCursor({
    blink: cursorSettings?.blink ?? true,
    blinkInterval: cursorSettings?.blinkInterval ?? 530,
    active: editingIndex !== null && subModal === null,
    style: cursorSettings?.style ?? 'block',
  });

  // Get effective values (original + pending changes)
  const effectiveBaseUrl = pending.baseUrl ?? profile.baseUrl;
  const effectiveTimeoutMs = pending.timeoutMs ?? profile.timeoutMs;
  const effectiveVerifyTls = pending.verifyTls ?? profile.verifyTls;

  // Check if there are unsaved changes (compare against baseline, not original profile)
  const hasChanges = useMemo(() => {
    return (
      pending.baseUrl !== undefined ||
      pending.timeoutMs !== undefined ||
      pending.verifyTls !== undefined ||
      pending.deletedHeaders.size > 0 ||
      pending.deletedVars.size > 0 ||
      Object.keys(pending.headers).length !== Object.keys(baseline.headers).length ||
      Object.entries(pending.headers).some(([k, v]) => baseline.headers[k] !== v) ||
      Object.keys(pending.vars).length !== Object.keys(baseline.vars).length ||
      Object.entries(pending.vars).some(([k, v]) => baseline.vars[k] !== v)
    );
  }, [pending, baseline]);

  // Track previous hasChanges to detect when user starts editing after save
  const prevHasChangesRef = useRef(hasChanges);
  useEffect(() => {
    // Clear "just saved" indicator when user makes a NEW change (hasChanges goes true)
    if (justSaved && hasChanges && !prevHasChangesRef.current) {
      setJustSaved(false);
    }
    prevHasChangesRef.current = hasChanges;
  }, [justSaved, hasChanges]);

  // Build menu items array with modification indicators
  const menuItems = useMemo((): MenuItem[] => {
    const headerCount = Object.keys(pending.headers).length;
    const varCount = Object.keys(pending.vars).length;

    const headersModified =
      pending.deletedHeaders.size > 0 ||
      Object.keys(pending.headers).length !== Object.keys(baseline.headers).length ||
      Object.entries(pending.headers).some(([k, v]) => baseline.headers[k] !== v);

    const varsModified =
      pending.deletedVars.size > 0 ||
      Object.keys(pending.vars).length !== Object.keys(baseline.vars).length ||
      Object.entries(pending.vars).some(([k, v]) => baseline.vars[k] !== v);

    return [
      {
        id: 'base-url',
        label: 'Base URL',
        value: effectiveBaseUrl || '(not set)',
        type: 'editable',
        isModified: pending.baseUrl !== undefined,
      },
      {
        id: 'timeout',
        label: 'Timeout',
        value: `${effectiveTimeoutMs}ms`,
        type: 'editable',
        isModified: pending.timeoutMs !== undefined,
      },
      {
        id: 'verify-tls',
        label: 'Verify TLS',
        value: effectiveVerifyTls ? 'true' : 'false',
        type: 'toggle',
        isModified: pending.verifyTls !== undefined,
      },
      {
        id: 'headers',
        label: 'Headers',
        value: headerCount > 0 ? `${headerCount} configured` : 'none',
        type: 'submenu',
        isModified: headersModified,
      },
      {
        id: 'variables',
        label: 'Variables',
        value: varCount > 0 ? `${varCount} configured` : 'none',
        type: 'submenu',
        isModified: varsModified,
      },
    ];
  }, [pending, baseline, effectiveBaseUrl, effectiveTimeoutMs, effectiveVerifyTls]);

  // Commit all pending changes
  const commitChanges = useCallback(() => {
    // Commit base URL
    if (pending.baseUrl !== undefined) {
      onSave('base-url', pending.baseUrl);
    }

    // Commit timeout
    if (pending.timeoutMs !== undefined) {
      onSave('timeout', String(pending.timeoutMs));
    }

    // Commit verify TLS
    if (pending.verifyTls !== undefined) {
      onSave('verify-tls', String(pending.verifyTls));
    }

    // Commit deleted headers
    for (const key of pending.deletedHeaders) {
      onDelete?.(`header:${key}`);
    }

    // Commit deleted vars
    for (const key of pending.deletedVars) {
      onDelete?.(`var:${key}`);
    }

    // Commit new/modified headers
    for (const [key, value] of Object.entries(pending.headers)) {
      if (baseline.headers[key] !== value) {
        onSave(`header:${key}`, value);
      }
    }

    // Commit new/modified vars
    for (const [key, value] of Object.entries(pending.vars)) {
      if (baseline.vars[key] !== value) {
        onSave(`var:${key}`, value);
      }
    }

    // Create new baseline with committed values
    const newBaseline: ProfileConfigData = {
      name: profile.name,
      baseUrl: effectiveBaseUrl,
      timeoutMs: effectiveTimeoutMs,
      verifyTls: effectiveVerifyTls,
      headers: { ...pending.headers },
      vars: { ...pending.vars },
    };

    // Reset state - pending now has "no changes" relative to new baseline
    setBaseline(newBaseline);
    setPending({
      headers: { ...pending.headers },
      vars: { ...pending.vars },
      deletedHeaders: new Set(),
      deletedVars: new Set(),
    });
    setJustSaved(true);
  }, [pending, baseline, profile.name, effectiveBaseUrl, effectiveTimeoutMs, effectiveVerifyTls, onSave, onDelete]);

  // Start editing an item
  const startEditing = useCallback(
    (index: number) => {
      const item = menuItems[index];
      if (!item) return;

      if (item.type === 'toggle') {
        // Toggle locally
        setPending((prev) => ({
          ...prev,
          verifyTls: !effectiveVerifyTls,
        }));
        return;
      }

      if (item.type === 'submenu') {
        if (item.id === 'headers') {
          setSubModal('headers');
        } else if (item.id === 'variables') {
          setSubModal('variables');
        }
        return;
      }

      // Pre-fill with current effective value
      let currentValue = '';
      if (item.id === 'base-url') {
        currentValue = effectiveBaseUrl;
      } else if (item.id === 'timeout') {
        currentValue = String(effectiveTimeoutMs);
      }
      setEditValue(currentValue);
      setCursorPos(currentValue.length);
      setEditingIndex(index);
    },
    [menuItems, effectiveBaseUrl, effectiveTimeoutMs, effectiveVerifyTls],
  );

  // Save the current edit to local state
  const saveEdit = useCallback(() => {
    if (editingIndex === null) return;

    const item = menuItems[editingIndex];
    if (!item) return;

    const trimmedValue = editValue.trim();

    if (item.id === 'base-url') {
      setPending((prev) => ({ ...prev, baseUrl: trimmedValue }));
    } else if (item.id === 'timeout') {
      const timeoutNum = Number.parseInt(trimmedValue, 10);
      if (!Number.isNaN(timeoutNum) && timeoutNum > 0) {
        setPending((prev) => ({ ...prev, timeoutMs: timeoutNum }));
      }
    }

    setEditingIndex(null);
    setEditValue('');
    setCursorPos(0);
  }, [editingIndex, menuItems, editValue]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditValue('');
    setCursorPos(0);
  }, []);

  // Handle header save from sub-modal (updates local state)
  const handleHeaderSave = useCallback((key: string, value: string) => {
    setPending((prev) => {
      const newHeaders = { ...prev.headers, [key]: value };
      const newDeletedHeaders = new Set(prev.deletedHeaders);
      newDeletedHeaders.delete(key); // Undelete if was deleted
      return { ...prev, headers: newHeaders, deletedHeaders: newDeletedHeaders };
    });
  }, []);

  // Handle header delete from sub-modal (updates local state)
  const handleHeaderDelete = useCallback(
    (key: string) => {
      setPending((prev) => {
        const newHeaders = { ...prev.headers };
        delete newHeaders[key];
        const newDeletedHeaders = new Set(prev.deletedHeaders);
        // Only add to deletedHeaders if it existed in baseline
        if (baseline.headers[key] !== undefined) {
          newDeletedHeaders.add(key);
        }
        return { ...prev, headers: newHeaders, deletedHeaders: newDeletedHeaders };
      });
    },
    [baseline.headers],
  );

  // Handle variable save from sub-modal (updates local state)
  const handleVariableSave = useCallback((key: string, value: string) => {
    setPending((prev) => {
      const newVars = { ...prev.vars, [key]: value };
      const newDeletedVars = new Set(prev.deletedVars);
      newDeletedVars.delete(key); // Undelete if was deleted
      return { ...prev, vars: newVars, deletedVars: newDeletedVars };
    });
  }, []);

  // Handle variable delete from sub-modal (updates local state)
  const handleVariableDelete = useCallback(
    (key: string) => {
      setPending((prev) => {
        const newVars = { ...prev.vars };
        delete newVars[key];
        const newDeletedVars = new Set(prev.deletedVars);
        // Only add to deletedVars if it existed in baseline
        if (baseline.vars[key] !== undefined) {
          newDeletedVars.add(key);
        }
        return { ...prev, vars: newVars, deletedVars: newDeletedVars };
      });
    },
    [baseline.vars],
  );

  // Handle keyboard input (only when no sub-modal is open)
  useInput(
    useCallback(
      (char, key) => {
        const isEditing = editingIndex !== null;

        // Ctrl+S - save and close
        if (key.ctrl && char === 's') {
          if (hasChanges) {
            commitChanges();
          } else {
            onClose();
          }
          return;
        }

        // Escape - cancel edit or close modal (discard changes)
        if (key.escape) {
          // Skip if we just closed a sub-modal (flag is set by closeSubModal)
          if (ignoreNextEsc) {
            setIgnoreNextEsc(false);
            return;
          }
          if (isEditing) {
            cancelEdit();
          } else {
            onClose();
          }
          return;
        }

        // When editing
        if (isEditing) {
          // Enter - save to local state
          if (key.return) {
            saveEdit();
            return;
          }

          // Backspace/Delete detection using shared hook
          if (key.backspace || key.delete) {
            const { isBackspace, isDelete } = detectKey();

            if (isBackspace && cursorPos > 0) {
              const newValue = editValue.slice(0, cursorPos - 1) + editValue.slice(cursorPos);
              setEditValue(newValue);
              setCursorPos(cursorPos - 1);
              return;
            }

            if (isDelete && cursorPos < editValue.length) {
              const newValue = editValue.slice(0, cursorPos) + editValue.slice(cursorPos + 1);
              setEditValue(newValue);
              return;
            }
          }

          // Ctrl+H as alternative backspace, Ctrl+D as alternative delete
          if (key.ctrl && char === 'h' && cursorPos > 0) {
            const newValue = editValue.slice(0, cursorPos - 1) + editValue.slice(cursorPos);
            setEditValue(newValue);
            setCursorPos(cursorPos - 1);
            return;
          }
          if (key.ctrl && char === 'd' && cursorPos < editValue.length) {
            const newValue = editValue.slice(0, cursorPos) + editValue.slice(cursorPos + 1);
            setEditValue(newValue);
            return;
          }

          // Left arrow
          if (key.leftArrow) {
            setCursorPos(Math.max(0, cursorPos - 1));
            return;
          }

          // Right arrow
          if (key.rightArrow) {
            setCursorPos(Math.min(editValue.length, cursorPos + 1));
            return;
          }

          // Regular character input (exclude control characters)
          const isPrintable =
            char && char.charCodeAt(0) >= 32 && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow;
          if (isPrintable) {
            const newValue = editValue.slice(0, cursorPos) + char + editValue.slice(cursorPos);
            setEditValue(newValue);
            setCursorPos(cursorPos + char.length);
          }
          return;
        }

        // When navigating

        // Up arrow
        if (key.upArrow) {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
          return;
        }

        // Down arrow
        if (key.downArrow) {
          setSelectedIndex((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
          return;
        }

        // Enter - start editing selected item
        if (key.return) {
          startEditing(selectedIndex);
          return;
        }

        // Q to quit (discard changes)
        if (char === 'q' || char === 'Q') {
          onClose();
        }
      },
      [
        editingIndex,
        editValue,
        cursorPos,
        selectedIndex,
        menuItems.length,
        hasChanges,
        cancelEdit,
        saveEdit,
        startEditing,
        commitChanges,
        onClose,
        detectKey,
        ignoreNextEsc,
      ],
    ),
    { isActive: subModal === null },
  );

  // Render a menu item row
  const renderMenuItem = (item: MenuItem, index: number) => {
    const isSelected = index === selectedIndex;
    const isEditing = index === editingIndex;

    const indicator = isSelected ? '>' : ' ';
    const indicatorColor = isSelected ? 'magenta' : undefined;

    // Modified indicator
    const modifiedMark = item.isModified ? (
      <Text color="yellow" bold>
        *{' '}
      </Text>
    ) : null;

    let valueDisplay: ReactNode;

    if (isEditing) {
      const beforeCursor = editValue.slice(0, cursorPos);
      const atCursor = editValue[cursorPos] || ' ';
      const afterCursor = editValue.slice(cursorPos + 1);

      if (!editValue) {
        valueDisplay = (
          <Text>
            <Text color="cyan">[</Text>
            {cursorVisible ? <Text inverse> </Text> : <Text> </Text>}
            <Text dimColor>Enter value...</Text>
            <Text color="cyan">]</Text>
          </Text>
        );
      } else {
        valueDisplay = (
          <Text>
            <Text color="cyan">[</Text>
            {beforeCursor}
            {cursorVisible ? <Text inverse>{atCursor}</Text> : <Text>{atCursor}</Text>}
            {afterCursor}
            <Text color="cyan">]</Text>
          </Text>
        );
      }
    } else if (item.type === 'toggle') {
      valueDisplay = (
        <Text>
          <Text color={effectiveVerifyTls ? 'green' : 'yellow'}>{item.value}</Text>
          <Text dimColor> (toggle)</Text>
        </Text>
      );
    } else if (item.type === 'submenu') {
      valueDisplay = (
        <Text>
          <Text dimColor>{item.value}</Text>
          <Text color="cyan"> →</Text>
        </Text>
      );
    } else {
      valueDisplay = <Text dimColor>{item.value}</Text>;
    }

    return (
      <Box key={item.id}>
        <Text color={indicatorColor} bold={isSelected}>
          {indicator}{' '}
        </Text>
        {modifiedMark}
        <Text bold={isSelected}>{item.label}: </Text>
        {valueDisplay}
      </Box>
    );
  };

  // Close sub-modal handler (sets flag to prevent next Esc from closing parent)
  const closeSubModal = useCallback(() => {
    setIgnoreNextEsc(true);
    setSubModal(null);
  }, []);

  // Render sub-modal for headers
  if (subModal === 'headers') {
    return (
      <KeyValueListModal
        title="📋 Headers"
        items={pending.headers}
        keyPlaceholder="Header-Name"
        valuePlaceholder="header value"
        separator=": "
        onClose={closeSubModal}
        onSave={handleHeaderSave}
        onDelete={handleHeaderDelete}
        cursorSettings={cursorSettings}
      />
    );
  }

  // Render sub-modal for variables
  if (subModal === 'variables') {
    return (
      <KeyValueListModal
        title="📦 Variables"
        items={pending.vars}
        keyPlaceholder="variable_name"
        valuePlaceholder="value"
        separator=" = "
        onClose={closeSubModal}
        onSave={handleVariableSave}
        onDelete={handleVariableDelete}
        cursorSettings={cursorSettings}
      />
    );
  }

  // Build help text based on state
  let helpText: string;
  if (editingIndex !== null) {
    helpText = 'Enter to apply · Escape to cancel';
  } else if (hasChanges) {
    helpText = '↑↓ navigate · Enter edit · Ctrl+S save · Esc discard';
  } else {
    helpText = '↑↓ navigate · Enter to edit · Esc to close';
  }

  // Build title with status
  const titleElement = (
    <Box>
      <Text bold color="magenta">
        ⚙ Configure profile:{' '}
      </Text>
      <Text bold color="cyan">
        {profile.name}
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

  // Main profile modal
  return (
    <Modal title={titleElement} borderColor="magenta" footer={helpText} minWidth={52}>
      <Box flexDirection="column">{menuItems.map((item, index) => renderMenuItem(item, index))}</Box>
    </Modal>
  );
}
