/**
 * Keyboard Bindings Hook
 *
 * Manages global keyboard shortcuts for the Ink REPL.
 * Shortcuts are only active when input is not focused.
 */

import { appendFileSync } from 'node:fs';
import { useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debug mode for key bindings - enable with DEBUG_KEYS=1
 * Writes to /tmp/unireq-keys.log
 */
const DEBUG_KEYS = process.env['DEBUG_KEYS'] === '1';
const DEBUG_LOG_PATH = '/tmp/unireq-keys.log';

function debugLog(message: string): void {
  if (DEBUG_KEYS) {
    const timestamp = new Date().toISOString();
    appendFileSync(DEBUG_LOG_PATH, `[${timestamp}] ${message}\n`);
  }
}

/**
 * Available modal types
 */
export type ModalType = 'inspector' | 'history' | 'help' | 'settings' | 'profileConfig' | 'httpModal' | null;

/**
 * Timeout for double Ctrl+C to quit (in milliseconds)
 * First Ctrl+C clears input, second Ctrl+C within this window quits
 */
export const CTRL_C_QUIT_TIMEOUT_MS = 2000;

/**
 * Keyboard bindings configuration
 */
export interface KeyBindingsConfig {
  /** Whether input field is currently focused (disables shortcuts) */
  isInputFocused: boolean;
  /** Current input text (for Ctrl+C clear vs quit logic) */
  currentInput?: string;
  /** Callback when inspector should open */
  onInspector?: () => void;
  /** Callback when history picker should open */
  onHistory?: () => void;
  /** Callback when help should show */
  onHelp?: () => void;
  /** Callback when user wants to quit */
  onQuit?: () => void;
  /** Callback to clear the input field (first Ctrl+C) */
  onClearInput?: () => void;
  /** Callback when screen should be cleared */
  onClear?: () => void;
  /** Callback when external editor should open */
  onEditor?: () => void;
  /** Callback when settings should open */
  onSettings?: () => void;
  /** Callback when profile config should open */
  onProfileConfig?: () => void;
  /** Callback when HTTP defaults modal should open */
  onHttpModal?: () => void;
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
  /** Whether a pending quit is active (Ctrl+C pressed once, waiting for second) */
  pendingQuit: boolean;
}

/**
 * Hook for managing keyboard shortcuts
 *
 * Provides global keyboard shortcuts that work even when input is focused.
 * Note: Ctrl+I=Tab, Ctrl+H=Backspace in terminals, so we use alternatives.
 *
 * Shortcuts:
 * - `Ctrl+Q` - Open inspector (view last response)
 * - `Ctrl+R` - Open history picker
 * - `Ctrl+P` - Open profile config
 * - `Ctrl+O` - Open settings (Options)
 * - `Ctrl+T` - Open HTTP defaults modal
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
    currentInput = '',
    onInspector,
    onHistory,
    onHelp,
    onQuit,
    onClearInput,
    onClear,
    onEditor,
    onSettings,
    onProfileConfig,
    onHttpModal,
    isModalOpen = false,
    onCloseModal,
  } = config;

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [pendingQuit, setPendingQuit] = useState(false);
  const lastCtrlCTime = useRef<number>(0);
  const pendingQuitTimer = useRef<NodeJS.Timeout | null>(null);

  // Clear pending quit state after timeout
  const clearPendingQuit = useCallback(() => {
    setPendingQuit(false);
    if (pendingQuitTimer.current) {
      clearTimeout(pendingQuitTimer.current);
      pendingQuitTimer.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pendingQuitTimer.current) {
        clearTimeout(pendingQuitTimer.current);
      }
    };
  }, []);

  // Sync internal state when external modal state changes
  // This handles cases where modal is closed externally (e.g., history selection)
  useEffect(() => {
    debugLog(`useEffect sync: isModalOpen=${isModalOpen}, activeModal=${activeModal}`);
    if (!isModalOpen && activeModal !== null) {
      debugLog(`Syncing: clearing activeModal because isModalOpen is false`);
      setActiveModal(null);
    }
  }, [isModalOpen, activeModal]);

  const openModal = useCallback((modal: ModalType) => {
    debugLog(`openModal(${modal})`);
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => {
    debugLog(`closeModal() - setting activeModal to null`);
    setActiveModal(null);
    onCloseModal?.();
  }, [onCloseModal]);

  // Handle keyboard input (Claude Code style Ctrl shortcuts)
  useInput(
    (input, key) => {
      // Debug: log all key events
      if (DEBUG_KEYS) {
        const charCode = input ? input.charCodeAt(0) : 0;
        debugLog(
          `input=${JSON.stringify(input)} charCode=${charCode} ctrl=${key.ctrl} ` +
            `escape=${key.escape} return=${key.return} tab=${key.tab}`,
        );
      }

      // Escape closes any modal
      if (key.escape) {
        debugLog(`Escape pressed: activeModal=${activeModal}, isModalOpen=${isModalOpen}`);
        if (activeModal || isModalOpen) {
          debugLog(`Calling closeModal()`);
          closeModal();
        }
        return;
      }

      // Ctrl shortcuts work even when input is focused
      // Note: Ctrl+H (8) = Backspace, Ctrl+I (9) = Tab - these don't work!
      // Use alternative keys that don't conflict with terminal control codes
      //
      // Important: In real terminals, Ctrl+<key> sends raw ASCII control chars:
      // Ctrl+C = ASCII 3 (\x03), Ctrl+D = ASCII 4 (\x04), etc.
      // Some terminals set key.ctrl=true with input='c', others send raw \x03.
      // We handle BOTH formats for compatibility.
      const charCode = input ? input.charCodeAt(0) : 0;
      const isCtrlChar = charCode >= 1 && charCode <= 26; // ASCII 1-26 = Ctrl+A to Ctrl+Z

      if (key.ctrl || isCtrlChar) {
        // Map raw control chars to their letter equivalent (ASCII 1='a', 3='c', etc.)
        const ctrlLetter = isCtrlChar ? String.fromCharCode(charCode + 96) : input.toLowerCase();
        debugLog(`Ctrl key detected, ctrlLetter=${ctrlLetter}, charCode=${charCode}, isCtrlChar=${isCtrlChar}`);
        switch (ctrlLetter) {
          case 'c': {
            // Ctrl+C: two-stage quit (like Claude Code)
            // - First press: clear input (if any) and show "press again to quit"
            // - Second press within timeout: actually quit
            const now = Date.now();
            const timeSinceLastCtrlC = now - lastCtrlCTime.current;
            lastCtrlCTime.current = now;

            debugLog(`Ctrl+C: currentInput="${currentInput}", timeSinceLastCtrlC=${timeSinceLastCtrlC}ms`);

            // If second Ctrl+C within timeout, quit
            if (timeSinceLastCtrlC < CTRL_C_QUIT_TIMEOUT_MS) {
              debugLog('Ctrl+C -> onQuit (second press)');
              clearPendingQuit();
              onQuit?.();
              return;
            }

            // First Ctrl+C: clear input (if any) AND set pending quit
            if (currentInput.length > 0) {
              debugLog('Ctrl+C -> clearing input');
              onClearInput?.();
            }

            // Always set pending quit state (shows "Press Ctrl+C again to quit")
            debugLog('Ctrl+C -> pending quit');
            setPendingQuit(true);

            // Clear pending quit after timeout
            if (pendingQuitTimer.current) {
              clearTimeout(pendingQuitTimer.current);
            }
            pendingQuitTimer.current = setTimeout(() => {
              debugLog('Ctrl+C timeout -> clearing pending quit');
              setPendingQuit(false);
              lastCtrlCTime.current = 0;
            }, CTRL_C_QUIT_TIMEOUT_MS);
            return;
          }
          case 'd':
            // Ctrl+D quits immediately (EOF - standard terminal behavior)
            debugLog('Ctrl+D -> onQuit');
            onQuit?.();
            return;
          case 'l':
            // Ctrl+L clears screen (ASCII 12 - form feed)
            debugLog('Ctrl+L -> onClear');
            onClear?.();
            return;
          case 'e':
            // Ctrl+E opens external editor (ASCII 5)
            debugLog('Ctrl+E -> onEditor');
            onEditor?.();
            return;
          case 'o':
            // Ctrl+O opens settings (ASCII 15 - "O" for Options)
            if (!activeModal && !isModalOpen) {
              debugLog('Ctrl+O -> onSettings');
              openModal('settings');
              onSettings?.();
            } else {
              debugLog(`Ctrl+O BLOCKED: activeModal=${activeModal}, isModalOpen=${isModalOpen}`);
            }
            return;
          case 'q':
            // Ctrl+Q opens inspector (ASCII 17 - "Q" for Query)
            if (!activeModal && !isModalOpen) {
              debugLog('Ctrl+Q -> onInspector');
              openModal('inspector');
              onInspector?.();
            } else {
              debugLog(`Ctrl+Q BLOCKED: activeModal=${activeModal}, isModalOpen=${isModalOpen}`);
            }
            return;
          case 'p':
            // Ctrl+P opens profile config (ASCII 16 - "P" for Profile)
            if (!activeModal && !isModalOpen) {
              debugLog('Ctrl+P -> onProfileConfig');
              openModal('profileConfig');
              onProfileConfig?.();
            } else {
              debugLog(`Ctrl+P BLOCKED: activeModal=${activeModal}, isModalOpen=${isModalOpen}`);
            }
            return;
          case 'r':
            // Ctrl+R also opens history (ASCII 18 - like shell reverse-search)
            if (!activeModal && !isModalOpen) {
              debugLog('Ctrl+R -> onHistory');
              openModal('history');
              onHistory?.();
            } else {
              debugLog(`Ctrl+R BLOCKED: activeModal=${activeModal}, isModalOpen=${isModalOpen}`);
            }
            return;
          case 't':
            // Ctrl+T opens HTTP defaults modal (ASCII 20 - "T" for Transfer/HTTP)
            if (!activeModal && !isModalOpen) {
              debugLog('Ctrl+T -> onHttpModal');
              openModal('httpModal');
              onHttpModal?.();
            } else {
              debugLog(`Ctrl+T BLOCKED: activeModal=${activeModal}, isModalOpen=${isModalOpen}`);
            }
            return;
        }
      }

      // Ctrl+/ for help - terminal sends ASCII 31 directly (not parsed as ctrl+key)
      // Check for raw ASCII 31 character code
      if (input === '\x1F' || (key.ctrl && (input === '/' || input === '_'))) {
        if (!activeModal && !isModalOpen) {
          debugLog('Ctrl+/ -> onHelp');
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
    pendingQuit,
  };
}
