/**
 * useProfileEditing — keyboard handler for ProfileConfigModal
 *
 * Encapsulates all useInput logic: tab switching, navigation, editing,
 * toggling, deleting items, and saving.
 */

import { useInput } from 'ink';
import { useCallback } from 'react';
import type { KeyValueItem, PendingChanges, ProfileConfigData, TabId } from '../components/ProfileConfigTypes.js';
import { CONNECTION_FIELDS, TABS } from '../components/ProfileConfigTypes.js';

export interface UseProfileEditingParams {
  // Tab state
  activeTab: number;
  setActiveTab: React.Dispatch<React.SetStateAction<number>>;
  // Selection
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  // Editing state
  editingField: string | null;
  setEditingField: React.Dispatch<React.SetStateAction<string | null>>;
  editValue: string;
  setEditValue: React.Dispatch<React.SetStateAction<string>>;
  setCursorPos: React.Dispatch<React.SetStateAction<number>>;
  // Adding new key-value
  addingKey: boolean;
  setAddingKey: React.Dispatch<React.SetStateAction<boolean>>;
  newKey: string;
  setNewKey: React.Dispatch<React.SetStateAction<string>>;
  // Pending state
  setPending: React.Dispatch<React.SetStateAction<PendingChanges>>;
  baseline: ProfileConfigData;
  // Effective connection values
  effectiveBaseUrl: string;
  effectiveTimeoutMs: number;
  effectiveVerifyTls: boolean;
  // Computed items
  headerItems: KeyValueItem[];
  varItems: KeyValueItem[];
  // Derived state
  hasChanges: boolean;
  // Callbacks
  getCurrentTabItemCount: () => number;
  commitChanges: () => void;
  cancelEdit: () => void;
  handleTextInput: (
    char: string,
    key: { backspace?: boolean; delete?: boolean; leftArrow?: boolean; rightArrow?: boolean; ctrl?: boolean },
  ) => boolean;
  onClose: () => void;
}

/**
 * Registers keyboard handling for the profile configuration modal via useInput.
 * Returns nothing — side effects happen via the state setters passed in.
 */
export function useProfileEditing({
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
}: UseProfileEditingParams): void {
  useInput(
    useCallback(
      (char, key) => {
        const isEditing = editingField !== null || addingKey;

        // Ctrl+S — save all pending changes (or close if nothing to save)
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

        // When in edit mode
        if (isEditing) {
          if (key.return) {
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
                // Finished entering key — transition to value entry
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
                // Commit new key-value pair
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

          // Delegate printable/cursor keys to text input handler
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

        // Vertical navigation
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

        // Enter — start editing selected item
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

        // Space — toggle boolean fields (connection tab)
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

        // 'd' / 'x' — delete selected key-value item
        if (char === 'd' || char === 'x') {
          const tab = TABS[activeTab] as { id: TabId } | undefined;
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
              const count = getCurrentTabItemCount() - 1;
              if (selectedIndex >= count) setSelectedIndex(Math.max(0, count - 1));
            }
          }
          return;
        }

        // Q — quit without saving
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
        setActiveTab,
        setSelectedIndex,
        setEditingField,
        setEditValue,
        setCursorPos,
        setAddingKey,
        setNewKey,
        setPending,
        onClose,
      ],
    ),
  );
}
