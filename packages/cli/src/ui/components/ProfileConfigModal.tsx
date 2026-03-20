/**
 * Profile Configuration Modal Component
 *
 * Tabbed interface for editing profile settings:
 * - Connection: Base URL, Timeout, Verify TLS
 * - Headers: Key-value pairs for HTTP headers
 * - Variables: Key-value pairs for template variables
 *
 * Changes are accumulated locally and only committed on save (Ctrl+S).
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCursor } from '../hooks/useCursor.js';
import { usePendingChanges } from '../hooks/usePendingChanges.js';
import { useProfileEditing } from '../hooks/useProfileEditing.js';
import { useRawKeyDetection } from '../hooks/useRawKeyDetection.js';
import { useSettingsColors } from '../hooks/useSettingsColors.js';
import { ConnectionTab } from './ConnectionTab.js';
import { KeyValueTab } from './KeyValueTab.js';
import { calculateModalWidth, Modal } from './Modal.js';
import type { KeyValueItem, ProfileConfigData, ProfileConfigModalProps } from './ProfileConfigTypes.js';
import { TABS } from './ProfileConfigTypes.js';

export type { ProfileConfigData, ProfileConfigModalProps } from './ProfileConfigTypes.js';

/**
 * Profile Configuration Modal
 *
 * Tabbed interface for editing profile settings.
 * Tab/Shift+Tab to switch tabs, ↑↓ to navigate within tab.
 * Changes are accumulated locally and committed with Ctrl+S.
 */
export function ProfileConfigModal({
  profile,
  onClose,
  onSave,
  onDelete,
  cursorSettings,
}: ProfileConfigModalProps): ReactNode {
  const colors = useSettingsColors();

  // Tab state
  const [activeTab, setActiveTab] = useState<number>(0);

  // Selection state (row within current tab)
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);

  // For key-value tabs: adding new item
  const [addingKey, setAddingKey] = useState(false);
  const [newKey, setNewKey] = useState('');

  // Save indicator
  const [justSaved, setJustSaved] = useState(false);

  // Pending changes hook
  const { pending, setPending, baseline, hasChanges, resetBaseline } = usePendingChanges(profile);

  // Hooks
  const { detectKey } = useRawKeyDetection();
  const { visible: cursorVisible } = useCursor({
    blink: cursorSettings?.blink ?? true,
    blinkInterval: cursorSettings?.blinkInterval ?? 530,
    active: editingField !== null || addingKey,
    style: cursorSettings?.style ?? 'block',
  });

  // Effective values (pending overrides profile)
  const effectiveBaseUrl = pending.baseUrl ?? profile.baseUrl;
  const effectiveTimeoutMs = pending.timeoutMs ?? profile.timeoutMs;
  const effectiveVerifyTls = pending.verifyTls ?? profile.verifyTls;

  // Clear "just saved" indicator when new changes appear
  const prevHasChangesRef = useRef(hasChanges);
  useEffect(() => {
    if (justSaved && hasChanges && !prevHasChangesRef.current) {
      setJustSaved(false);
    }
    prevHasChangesRef.current = hasChanges;
  }, [justSaved, hasChanges]);

  // Build key-value items for headers/variables tabs
  const headerItems = useMemo((): KeyValueItem[] => {
    const items: KeyValueItem[] = Object.entries(pending.headers).map(([key, value]) => ({
      key,
      value,
      isAddNew: false,
    }));
    items.push({ key: '', value: '', isAddNew: true });
    return items;
  }, [pending.headers]);

  const varItems = useMemo((): KeyValueItem[] => {
    const items: KeyValueItem[] = Object.entries(pending.vars).map(([key, value]) => ({
      key,
      value,
      isAddNew: false,
    }));
    items.push({ key: '', value: '', isAddNew: true });
    return items;
  }, [pending.vars]);

  // Item count for the active tab (used for navigation bounds)
  const getCurrentTabItemCount = useCallback(() => {
    const tab = TABS[activeTab];
    if (!tab) return 0;
    switch (tab.id) {
      case 'connection':
        return 3; // CONNECTION_FIELDS.length
      case 'headers':
        return headerItems.length;
      case 'variables':
        return varItems.length;
      default:
        return 0;
    }
  }, [activeTab, headerItems.length, varItems.length]);

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedIndex(0);
    setEditingField(null);
    setAddingKey(false);
    setNewKey('');
    setEditValue('');
    setCursorPos(0);
  }, [activeTab]);

  // Commit all pending changes to the parent
  const commitChanges = useCallback(() => {
    if (pending.baseUrl !== undefined) onSave('base-url', pending.baseUrl);
    if (pending.timeoutMs !== undefined) onSave('timeout', String(pending.timeoutMs));
    if (pending.verifyTls !== undefined) onSave('verify-tls', String(pending.verifyTls));

    for (const key of pending.deletedHeaders) onDelete?.(`header:${key}`);
    for (const key of pending.deletedVars) onDelete?.(`var:${key}`);

    for (const [key, value] of Object.entries(pending.headers)) {
      if (baseline.headers[key] !== value) onSave(`header:${key}`, value);
    }
    for (const [key, value] of Object.entries(pending.vars)) {
      if (baseline.vars[key] !== value) onSave(`var:${key}`, value);
    }

    const newBaseline: ProfileConfigData = {
      name: profile.name,
      baseUrl: effectiveBaseUrl,
      timeoutMs: effectiveTimeoutMs,
      verifyTls: effectiveVerifyTls,
      headers: { ...pending.headers },
      vars: { ...pending.vars },
    };

    resetBaseline(newBaseline);
    setJustSaved(true);
  }, [
    pending,
    baseline,
    profile.name,
    effectiveBaseUrl,
    effectiveTimeoutMs,
    effectiveVerifyTls,
    onSave,
    onDelete,
    resetBaseline,
  ]);

  // Cancel active edit
  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setAddingKey(false);
    setNewKey('');
    setEditValue('');
    setCursorPos(0);
  }, []);

  // Handle text input when in edit mode
  const handleTextInput = useCallback(
    (
      char: string,
      key: { backspace?: boolean; delete?: boolean; leftArrow?: boolean; rightArrow?: boolean; ctrl?: boolean },
    ) => {
      if (key.backspace || key.delete) {
        const { isBackspace, isDelete } = detectKey();
        if (isBackspace && cursorPos > 0) {
          setEditValue((v) => v.slice(0, cursorPos - 1) + v.slice(cursorPos));
          setCursorPos((p) => p - 1);
          return true;
        }
        if (isDelete && cursorPos < editValue.length) {
          setEditValue((v) => v.slice(0, cursorPos) + v.slice(cursorPos + 1));
          return true;
        }
      }

      if (key.ctrl && char === 'h' && cursorPos > 0) {
        setEditValue((v) => v.slice(0, cursorPos - 1) + v.slice(cursorPos));
        setCursorPos((p) => p - 1);
        return true;
      }
      if (key.ctrl && char === 'd' && cursorPos < editValue.length) {
        setEditValue((v) => v.slice(0, cursorPos) + v.slice(cursorPos + 1));
        return true;
      }

      if (key.leftArrow) {
        setCursorPos((p) => Math.max(0, p - 1));
        return true;
      }
      if (key.rightArrow) {
        setCursorPos((p) => Math.min(editValue.length, p + 1));
        return true;
      }

      const isPrintable = char && char.charCodeAt(0) >= 32 && !key.ctrl;
      if (isPrintable) {
        setEditValue((v) => v.slice(0, cursorPos) + char + v.slice(cursorPos));
        setCursorPos((p) => p + char.length);
        return true;
      }

      return false;
    },
    [cursorPos, editValue.length, detectKey],
  );

  // Register all keyboard handling via useProfileEditing
  useProfileEditing({
    activeTab,
    setActiveTab,
    selectedIndex,
    setSelectedIndex,
    editingField,
    setEditingField,
    editValue,
    setEditValue,
    setCursorPos,
    addingKey,
    setAddingKey,
    newKey,
    setNewKey,
    setPending,
    baseline,
    effectiveBaseUrl,
    effectiveTimeoutMs,
    effectiveVerifyTls,
    headerItems,
    varItems,
    hasChanges,
    getCurrentTabItemCount,
    commitChanges,
    cancelEdit,
    handleTextInput,
    onClose,
  });

  // Render text input with blinking cursor
  const renderInput = (placeholder: string) => {
    if (!editValue) {
      return (
        <Text>
          {cursorVisible ? <Text inverse> </Text> : <Text> </Text>}
          <Text dimColor>{placeholder}</Text>
        </Text>
      );
    }
    const before = editValue.slice(0, cursorPos);
    const at = editValue[cursorPos] || ' ';
    const after = editValue.slice(cursorPos + 1);
    return (
      <Text>
        {before}
        {cursorVisible ? <Text inverse>{at}</Text> : <Text>{at}</Text>}
        {after}
      </Text>
    );
  };

  // Render tab bar
  const renderTabBar = () => {
    const headerCount = Object.keys(pending.headers).length;
    const varCount = Object.keys(pending.vars).length;

    return (
      <Box marginBottom={1} gap={1}>
        {TABS.map((tab, index) => {
          const isActive = index === activeTab;
          let label = `${tab.icon}  ${tab.label}`;
          if (tab.id === 'headers' && headerCount > 0) label += ` (${headerCount})`;
          if (tab.id === 'variables' && varCount > 0) label += ` (${varCount})`;

          return (
            <Box key={tab.id}>
              <Text color={isActive ? 'cyan' : 'gray'} bold={isActive} inverse={isActive}>
                {` ${label} `}
              </Text>
            </Box>
          );
        })}
      </Box>
    );
  };

  // Build help text
  let helpText: string;
  if (editingField !== null || addingKey) {
    helpText = 'Enter to apply · Esc cancel';
  } else if (hasChanges) {
    helpText = 'Tab switch · ↑↓ nav · Enter edit · Ctrl+S save · Esc discard';
  } else {
    helpText = 'Tab switch · ↑↓ nav · Enter edit · Esc close';
  }

  // Build title element
  const titleElement = (
    <Box>
      <Text bold color="magenta">
        ⚙ Profile:{' '}
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

  // Calculate modal width
  const titleText = `⚙  Profile: ${profile.name}${justSaved && !hasChanges ? ' ✓ Saved' : hasChanges ? ' (modified)' : ''}`;
  const tabBarText = '🔗  Connection  📋  Headers (99)  📦  Variables (99)';
  const connectionLine = '* Base URL     [https://api.example.com/v1/endpoint] ← enter to edit';
  const keyValueLine = '> Authorization-Bearer: eyJhbGciOiJIUzI1NiIsInR5...';
  const modalMinWidth = calculateModalWidth({
    footer: helpText,
    title: titleText,
    contentLines: [tabBarText, connectionLine, keyValueLine],
  });

  // Render current tab content
  const currentTab = TABS[activeTab];
  let tabContent: ReactNode = null;
  if (currentTab?.id === 'connection') {
    tabContent = (
      <ConnectionTab
        pending={pending}
        effectiveBaseUrl={effectiveBaseUrl}
        effectiveTimeoutMs={effectiveTimeoutMs}
        effectiveVerifyTls={effectiveVerifyTls}
        selectedIndex={selectedIndex}
        editingField={editingField}
        colors={colors}
        renderInput={renderInput}
      />
    );
  } else if (currentTab?.id === 'headers') {
    tabContent = (
      <KeyValueTab
        tabId="headers"
        items={headerItems}
        selectedIndex={selectedIndex}
        editingField={editingField}
        addingKey={addingKey}
        newKey={newKey}
        colors={colors}
        renderInput={renderInput}
      />
    );
  } else if (currentTab?.id === 'variables') {
    tabContent = (
      <KeyValueTab
        tabId="variables"
        items={varItems}
        selectedIndex={selectedIndex}
        editingField={editingField}
        addingKey={addingKey}
        newKey={newKey}
        colors={colors}
        renderInput={renderInput}
      />
    );
  }

  return (
    <Modal title={titleElement} borderColor={colors.ui.border} footer={helpText} minWidth={modalMinWidth}>
      <Box flexDirection="column">
        {renderTabBar()}
        {tabContent}
      </Box>
    </Modal>
  );
}
