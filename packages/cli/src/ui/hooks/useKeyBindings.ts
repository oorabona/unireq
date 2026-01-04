/**
 * Keyboard Bindings Hook
 *
 * Manages global keyboard shortcuts for the Ink REPL.
 * Shortcuts are only active when input is not focused.
 */

import { useInput } from 'ink';
import { useCallback, useState } from 'react';

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
 * Provides global keyboard shortcuts:
 * - `i` - Open inspector (view last response)
 * - `h` - Open history picker
 * - `?` - Show help
 * - `Ctrl+C` - Quit (when not in input)
 * - `Escape` - Close modal
 *
 * Shortcuts are disabled when input is focused to allow normal typing.
 *
 * @example
 * ```tsx
 * function App() {
 *   const [inputFocused, setInputFocused] = useState(true);
 *   const { activeModal, closeModal } = useKeyBindings({
 *     isInputFocused: inputFocused,
 *     onQuit: () => process.exit(0),
 *   });
 *
 *   return (
 *     <>
 *       {activeModal === 'inspector' && <InspectorModal onClose={closeModal} />}
 *       <CommandLine onFocus={() => setInputFocused(true)} />
 *     </>
 *   );
 * }
 * ```
 */
export function useKeyBindings(config: KeyBindingsConfig): KeyBindingsState {
  const { isInputFocused, onInspector, onHistory, onHelp, onQuit, isModalOpen = false, onCloseModal } = config;

  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const openModal = useCallback((modal: ModalType) => {
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    onCloseModal?.();
  }, [onCloseModal]);

  // Handle keyboard input
  useInput(
    (input, key) => {
      // Escape closes any modal
      if (key.escape) {
        if (activeModal || isModalOpen) {
          closeModal();
        }
        return;
      }

      // Ctrl+C quits (always, even in input mode for safety)
      if (key.ctrl && input === 'c') {
        onQuit?.();
        return;
      }

      // Other shortcuts only work when input is not focused and no modal is open
      if (isInputFocused || activeModal || isModalOpen) {
        return;
      }

      switch (input.toLowerCase()) {
        case 'i':
          openModal('inspector');
          onInspector?.();
          break;
        case 'h':
          openModal('history');
          onHistory?.();
          break;
        case '?':
          openModal('help');
          onHelp?.();
          break;
        case 'q':
          onQuit?.();
          break;
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
