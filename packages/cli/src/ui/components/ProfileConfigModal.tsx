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

import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCursor } from '../hooks/useCursor.js';
import { useRawKeyDetection } from '../hooks/useRawKeyDetection.js';
import { useSettingsColors } from '../hooks/useSettingsColors.js';
import type { CursorSettings } from '../state/types.js';
import { calculateModalWidth, Modal } from './Modal.js';

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
  headers: Record<string, string>;
  vars: Record<string, string>;
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
 * Tab definitions
 */
type TabId = 'connection' | 'headers' | 'variables';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'connection', label: 'Connection', icon: '🔗' },
  { id: 'headers', label: 'Headers', icon: '📋' },
  { id: 'variables', label: 'Variables', icon: '📦' },
];

/**
 * Connection tab field types
 */
interface ConnectionField {
  id: string;
  label: string;
  type: 'editable' | 'toggle';
}

const CONNECTION_FIELDS: ConnectionField[] = [
  { id: 'base-url', label: 'Base URL', type: 'editable' },
  { id: 'timeout', label: 'Timeout', type: 'editable' },
  { id: 'verify-tls', label: 'Verify TLS', type: 'toggle' },
];

/**
 * Key-value item for headers/variables tabs
 */
interface KeyValueItem {
  key: string;
  value: string;
  isAddNew: boolean;
}

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

  // Local state for pending changes
  const [pending, setPending] = useState<PendingChanges>(() => createInitialPendingChanges(profile));

  // Track the "baseline" after a save
  const [baseline, setBaseline] = useState<ProfileConfigData>(profile);

  // Hooks
  const { detectKey } = useRawKeyDetection();
  const { visible: cursorVisible } = useCursor({
    blink: cursorSettings?.blink ?? true,
    blinkInterval: cursorSettings?.blinkInterval ?? 530,
    active: editingField !== null || addingKey,
    style: cursorSettings?.style ?? 'block',
  });

  // Effective values
  const effectiveBaseUrl = pending.baseUrl ?? profile.baseUrl;
  const effectiveTimeoutMs = pending.timeoutMs ?? profile.timeoutMs;
  const effectiveVerifyTls = pending.verifyTls ?? profile.verifyTls;

  // Check for unsaved changes
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

  // Clear "just saved" on new changes
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

  // Get current tab's item count (for navigation bounds)
  const getCurrentTabItemCount = useCallback(() => {
    const tab = TABS[activeTab];
    if (!tab) return 0;
    switch (tab.id) {
      case 'connection':
        return CONNECTION_FIELDS.length;
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

  // Commit all pending changes
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

    setBaseline(newBaseline);
    setPending({
      headers: { ...pending.headers },
      vars: { ...pending.vars },
      deletedHeaders: new Set(),
      deletedVars: new Set(),
    });
    setJustSaved(true);
  }, [pending, baseline, profile.name, effectiveBaseUrl, effectiveTimeoutMs, effectiveVerifyTls, onSave, onDelete]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setAddingKey(false);
    setNewKey('');
    setEditValue('');
    setCursorPos(0);
  }, []);

  // Handle text input for editing
  const handleTextInput = useCallback(
    (char: string, key: { backspace?: boolean; delete?: boolean; leftArrow?: boolean; rightArrow?: boolean; ctrl?: boolean }) => {
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

  // Keyboard handler
  useInput(
    useCallback(
      (char, key) => {
        const isEditing = editingField !== null || addingKey;

        // Ctrl+S - save
        if (key.ctrl && char === 's') {
          if (hasChanges) commitChanges();
          else onClose();
          return;
        }

        // Escape
        if (key.escape) {
          if (isEditing) cancelEdit();
          else onClose();
          return;
        }

        // When editing
        if (isEditing) {
          if (key.return) {
            // Save edit
            const tab = TABS[activeTab];
            if (!tab) return;

            if (tab.id === 'connection') {
              const field = CONNECTION_FIELDS[selectedIndex];
              if (field?.id === 'base-url') {
                setPending((prev) => ({ ...prev, baseUrl: editValue.trim() }));
              } else if (field?.id === 'timeout') {
                const num = Number.parseInt(editValue.trim(), 10);
                if (!Number.isNaN(num) && num > 0) {
                  setPending((prev) => ({ ...prev, timeoutMs: num }));
                }
              }
            } else if (tab.id === 'headers' || tab.id === 'variables') {
              const items = tab.id === 'headers' ? headerItems : varItems;
              const item = items[selectedIndex];

              if (addingKey) {
                // Finished entering key, now enter value
                const keyVal = editValue.trim();
                if (keyVal) {
                  setNewKey(keyVal);
                  setAddingKey(false);
                  setEditingField('new-value');
                  setEditValue('');
                  setCursorPos(0);
                  return;
                }
              } else if (editingField === 'new-value') {
                // Save new key-value
                const valueVal = editValue.trim();
                if (newKey && valueVal) {
                  if (tab.id === 'headers') {
                    setPending((prev) => ({
                      ...prev,
                      headers: { ...prev.headers, [newKey]: valueVal },
                      deletedHeaders: new Set([...prev.deletedHeaders].filter((k) => k !== newKey)),
                    }));
                  } else {
                    setPending((prev) => ({
                      ...prev,
                      vars: { ...prev.vars, [newKey]: valueVal },
                      deletedVars: new Set([...prev.deletedVars].filter((k) => k !== newKey)),
                    }));
                  }
                }
                setNewKey('');
              } else if (item && !item.isAddNew) {
                // Update existing value
                const valueVal = editValue.trim();
                if (valueVal) {
                  if (tab.id === 'headers') {
                    setPending((prev) => ({
                      ...prev,
                      headers: { ...prev.headers, [item.key]: valueVal },
                    }));
                  } else {
                    setPending((prev) => ({
                      ...prev,
                      vars: { ...prev.vars, [item.key]: valueVal },
                    }));
                  }
                }
              }
            }
            cancelEdit();
            return;
          }

          // Handle text input
          handleTextInput(char, key);
          return;
        }

        // Tab switching with Tab/Shift+Tab
        if (key.tab) {
          if (key.shift) {
            setActiveTab((t) => (t > 0 ? t - 1 : TABS.length - 1));
          } else {
            setActiveTab((t) => (t < TABS.length - 1 ? t + 1 : 0));
          }
          return;
        }

        // Navigation
        if (key.upArrow) {
          const count = getCurrentTabItemCount();
          setSelectedIndex((i) => (i > 0 ? i - 1 : count - 1));
          return;
        }
        if (key.downArrow) {
          const count = getCurrentTabItemCount();
          setSelectedIndex((i) => (i < count - 1 ? i + 1 : 0));
          return;
        }

        // Enter - start editing
        if (key.return) {
          const tab = TABS[activeTab];
          if (!tab) return;

          if (tab.id === 'connection') {
            const field = CONNECTION_FIELDS[selectedIndex];
            if (field?.type === 'toggle') {
              setPending((prev) => ({ ...prev, verifyTls: !effectiveVerifyTls }));
            } else if (field?.id === 'base-url') {
              setEditingField('base-url');
              setEditValue(effectiveBaseUrl);
              setCursorPos(effectiveBaseUrl.length);
            } else if (field?.id === 'timeout') {
              setEditingField('timeout');
              setEditValue(String(effectiveTimeoutMs));
              setCursorPos(String(effectiveTimeoutMs).length);
            }
          } else if (tab.id === 'headers' || tab.id === 'variables') {
            const items = tab.id === 'headers' ? headerItems : varItems;
            const item = items[selectedIndex];
            if (item?.isAddNew) {
              setAddingKey(true);
              setEditValue('');
              setCursorPos(0);
            } else if (item) {
              setEditingField(item.key);
              setEditValue(item.value);
              setCursorPos(item.value.length);
            }
          }
          return;
        }

        // Space - toggle (for connection tab)
        if (char === ' ') {
          const tab = TABS[activeTab];
          if (tab?.id === 'connection') {
            const field = CONNECTION_FIELDS[selectedIndex];
            if (field?.type === 'toggle') {
              setPending((prev) => ({ ...prev, verifyTls: !effectiveVerifyTls }));
            }
          }
          return;
        }

        // Delete key-value item with 'd' or 'x'
        if (char === 'd' || char === 'x') {
          const tab = TABS[activeTab];
          if (tab?.id === 'headers' || tab?.id === 'variables') {
            const items = tab.id === 'headers' ? headerItems : varItems;
            const item = items[selectedIndex];
            if (item && !item.isAddNew) {
              if (tab.id === 'headers') {
                setPending((prev) => {
                  const newHeaders = { ...prev.headers };
                  delete newHeaders[item.key];
                  const newDeleted = new Set(prev.deletedHeaders);
                  if (baseline.headers[item.key] !== undefined) newDeleted.add(item.key);
                  return { ...prev, headers: newHeaders, deletedHeaders: newDeleted };
                });
              } else {
                setPending((prev) => {
                  const newVars = { ...prev.vars };
                  delete newVars[item.key];
                  const newDeleted = new Set(prev.deletedVars);
                  if (baseline.vars[item.key] !== undefined) newDeleted.add(item.key);
                  return { ...prev, vars: newVars, deletedVars: newDeleted };
                });
              }
              // Adjust selection
              const count = getCurrentTabItemCount() - 1;
              if (selectedIndex >= count) setSelectedIndex(Math.max(0, count - 1));
            }
          }
          return;
        }

        // Q to quit
        if (char === 'q' || char === 'Q') {
          onClose();
        }
      },
      [
        activeTab,
        selectedIndex,
        editingField,
        addingKey,
        editValue,
        newKey,
        hasChanges,
        effectiveBaseUrl,
        effectiveTimeoutMs,
        effectiveVerifyTls,
        headerItems,
        varItems,
        baseline,
        getCurrentTabItemCount,
        commitChanges,
        cancelEdit,
        handleTextInput,
        onClose,
      ],
    ),
  );

  // Render input with cursor
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

  // Render connection tab content
  const renderConnectionTab = () => {
    return (
      <Box flexDirection="column">
        {CONNECTION_FIELDS.map((field, index) => {
          const isSelected = index === selectedIndex;
          const isEditing = editingField === field.id;

          let value: string;
          let isModified = false;

          if (field.id === 'base-url') {
            value = effectiveBaseUrl || '(not set)';
            isModified = pending.baseUrl !== undefined;
          } else if (field.id === 'timeout') {
            value = `${effectiveTimeoutMs}ms`;
            isModified = pending.timeoutMs !== undefined;
          } else {
            value = effectiveVerifyTls ? 'Yes' : 'No';
            isModified = pending.verifyTls !== undefined;
          }

          return (
            <Box key={field.id} gap={1}>
              {/* Modified indicator */}
              <Text color="yellow" bold>
                {isModified ? '*' : ' '}
              </Text>

              {/* Label */}
              <Box width={12}>
                <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                  {field.label}
                </Text>
              </Box>

              {/* Value */}
              <Box minWidth={20}>
                {isEditing ? (
                  <Text>
                    <Text color="cyan">[</Text>
                    {renderInput('Enter value...')}
                    <Text color="cyan">]</Text>
                  </Text>
                ) : field.type === 'toggle' ? (
                  <Text color={effectiveVerifyTls ? 'green' : 'gray'}>
                    [{effectiveVerifyTls ? '✓' : ' '}] {value}
                  </Text>
                ) : (
                  <Text color={isSelected ? 'cyan' : 'gray'}>[{value}]</Text>
                )}
              </Box>

              {/* Hint */}
              {isSelected && !isEditing && (
                <Text dimColor>
                  {field.type === 'toggle' ? '← space/enter' : '← enter to edit'}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>
    );
  };

  // Render key-value tab content (headers or variables)
  const renderKeyValueTab = (tabId: 'headers' | 'variables') => {
    const items = tabId === 'headers' ? headerItems : varItems;
    const separator = tabId === 'headers' ? ':' : '=';
    const keyPlaceholder = tabId === 'headers' ? 'Header-Name' : 'variable_name';
    const valuePlaceholder = tabId === 'headers' ? 'value' : 'value';

    return (
      <Box flexDirection="column">
        {items.length === 1 && items[0]?.isAddNew && (
          <Box marginBottom={1}>
            <Text dimColor>No {tabId} configured</Text>
          </Box>
        )}

        {items.map((item, index) => {
          const isSelected = index === selectedIndex;
          const isEditingThis = !item.isAddNew && editingField === item.key;

          if (item.isAddNew) {
            if (addingKey) {
              return (
                <Box key="__add__" gap={1}>
                  <Text color="green" bold>
                    +
                  </Text>
                  <Text>{renderInput(keyPlaceholder)}</Text>
                </Box>
              );
            }
            if (editingField === 'new-value') {
              return (
                <Box key="__add__" gap={1}>
                  <Text color="green" bold>
                    +
                  </Text>
                  <Text>{newKey}</Text>
                  <Text dimColor> {separator} </Text>
                  <Text>{renderInput(valuePlaceholder)}</Text>
                </Box>
              );
            }
            return (
              <Box key="__add__" gap={1}>
                <Text color={isSelected ? 'cyan' : 'green'} bold={isSelected}>
                  + Add new
                </Text>
                {isSelected && <Text dimColor>← enter</Text>}
              </Box>
            );
          }

          // Existing item
          const displayValue = item.value.length > 30 ? `${item.value.slice(0, 27)}...` : item.value;

          return (
            <Box key={item.key} gap={1}>
              {/* Key */}
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {item.key}
              </Text>

              <Text dimColor> {separator} </Text>

              {/* Value */}
              {isEditingThis ? (
                <Text>
                  <Text color="cyan">[</Text>
                  {renderInput(valuePlaceholder)}
                  <Text color="cyan">]</Text>
                </Text>
              ) : (
                <Text dimColor>{displayValue}</Text>
              )}

              {/* Hint */}
              {isSelected && !isEditingThis && <Text dimColor>← enter edit · d delete</Text>}
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

  // Build title
  const titleElement = (
    <Box>
      <Text bold color="magenta">
        ⚙  Profile:{' '}
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

  // Calculate modal width - include longest possible lines from all tabs
  const titleText = `⚙  Profile: ${profile.name}${justSaved && !hasChanges ? ' ✓ Saved' : hasChanges ? ' (modified)' : ''}`;
  const tabBarText = '🔗  Connection  📋  Headers (99)  📦  Variables (99)';
  // Connection tab: "* Label        [value] ← enter to edit"
  const connectionLine = '* Base URL     [https://api.example.com/v1/endpoint] ← enter to edit';
  // Key-value tab: "> Header-Name-Long: value-example-here..."
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
    tabContent = renderConnectionTab();
  } else if (currentTab?.id === 'headers') {
    tabContent = renderKeyValueTab('headers');
  } else if (currentTab?.id === 'variables') {
    tabContent = renderKeyValueTab('variables');
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
