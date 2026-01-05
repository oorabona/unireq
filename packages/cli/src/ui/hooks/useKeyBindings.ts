/**
 * Keyboard Bindings Hook
 *
 * Manages global keyboard shortcuts for the Ink REPL.
 * Shortcuts are only active when input is not focused.
 */

import { useInput } from 'ink';
import { useCallback, useEffect, useState } from 'react';

/**
 * Available modal types
 */
export type ModalType = 'inspector' | 'history' | 'help' | null;

/**
 * Keyboard bindings configuration
 */
export interface KeyBindingsConfig {
  /** Whether input field is currently focused (disables shortcuts) */
  isInputFocused: boolean;
  /** Callback when inspector should open */
  onInspector?: () => void;
  /** Callback when history picker should open */
  onHistory?: () => void;
  /** Callback when help should show */
  onHelp?: () => void;
  /** Callback when user wants to quit */
  onQuit?: () => void;
  /** Callback when screen should be cleared */
  onClear?: () => void;
  /** Callback when external editor should open */
  onEditor?: () => void;
  /** Whether a modal is currently open */
  isModalOpen?: boolean;
  /** Callback when modal should close */
  onCloseModal?: () => void;
}

/**
 * Keyboard bindings state
 */
export interface KeyBindingsState {
  /** Currently active modal */
  activeModal: ModalType;
  /** Open a specific modal */
  openModal: (modal: ModalType) => void;
  /** Close the active modal */
  closeModal: () => void;
}

/**
 * Hook for managing keyboard shortcuts
 *
 * Provides global keyboard shortcuts that work even when input is focused.
 * Note: Ctrl+I=Tab, Ctrl+H=Backspace in terminals, so we use alternatives.
 *
 * Shortcuts:
 * - `Ctrl+O` - Open inspector (view last response)
 * - `Ctrl+R` or `Ctrl+P` - Open history picker
 * - `Ctrl+/` - Show help
 * - `Ctrl+L` - Clear screen
 * - `Ctrl+E` - Open external editor
 * - `Ctrl+C` - Quit
 * - `Ctrl+D` - Quit (EOF)
 * - `Escape` - Close modal
 *
 * @example
 * ```tsx
 * function App() {
 *   const { activeModal, closeModal } = useKeyBindings({
 *     isInputFocused: true,
 *     onQuit: () => process.exit(0),
 *   });
 *
 *   return (
 *     <>
 *       {activeModal === 'inspector' && <InspectorModal onClose={closeModal} />}
 *       <CommandLine />
 *     </>
 *   );
 * }
 * ```
 */
export function useKeyBindings(config: KeyBindingsConfig): KeyBindingsState {
  const {
    // isInputFocused is kept for API compatibility but shortcuts work even when focused
    isInputFocused: _isInputFocused,
    onInspector,
    onHistory,
    onHelp,
    onQuit,
    onClear,
    onEditor,
    isModalOpen = false,
    onCloseModal,
  } = config;

  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Sync internal state when external modal state changes
  // This handles cases where modal is closed externally (e.g., history selection)
  useEffect(() => {
    if (!isModalOpen && activeModal !== null) {
      setActiveModal(null);
    }
  }, [isModalOpen, activeModal]);

  const openModal = useCallback((modal: ModalType) => {
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    onCloseModal?.();
  }, [onCloseModal]);

  // Handle keyboard input (Claude Code style Ctrl shortcuts)
  useInput(
    (input, key) => {
      // Escape closes any modal
      if (key.escape) {
        if (activeModal || isModalOpen) {
          closeModal();
        }
        return;
      }

      // Ctrl shortcuts work even when input is focused
      // Note: Ctrl+H (8) = Backspace, Ctrl+I (9) = Tab - these don't work!
      // Use alternative keys that don't conflict with terminal control codes
      if (key.ctrl) {
        switch (input.toLowerCase()) {
          case 'c':
            // Ctrl+C quits
            onQuit?.();
            return;
          case 'd':
            // Ctrl+D quits (EOF)
            onQuit?.();
            return;
          case 'l':
            // Ctrl+L clears screen (ASCII 12 - form feed)
            onClear?.();
            return;
          case 'e':
            // Ctrl+E opens external editor (ASCII 5)
            onEditor?.();
            return;
          case 'o':
            // Ctrl+O opens inspector (ASCII 15 - avoids Ctrl+I=Tab conflict)
            if (!activeModal && !isModalOpen) {
              openModal('inspector');
              onInspector?.();
            }
            return;
          case 'p':
            // Ctrl+P opens history (ASCII 16 - "previous")
            if (!activeModal && !isModalOpen) {
              openModal('history');
              onHistory?.();
            }
            return;
          case 'r':
            // Ctrl+R also opens history (ASCII 18 - like shell reverse-search)
            if (!activeModal && !isModalOpen) {
              openModal('history');
              onHistory?.();
            }
            return;
        }
      }

      // Ctrl+/ for help - terminal sends ASCII 31 directly (not parsed as ctrl+key)
      // Check for raw ASCII 31 character code
      if (input === '\x1F' || (key.ctrl && (input === '/' || input === '_'))) {
        if (!activeModal && !isModalOpen) {
          openModal('help');
          onHelp?.();
        }
        return;
      }
    },
    { isActive: true },
  );

  return {
    activeModal,
    openModal,
    closeModal,
  };
}
