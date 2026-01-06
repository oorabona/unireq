/**
 * Ink-based Terminal UI - Root Application Component
 *
 * Provides a Claude Code-like UX with:
 * - Persistent status header
 * - Scrollable transcript
 * - Keyboard shortcuts for inspection
 * - OpenAPI-aware autocomplete
 */

import { Box, Text, useApp, useStdout } from 'ink';
import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HistoryWriter } from '../collections/history/index.js';
import { getSpecInfoString, loadSpecIntoState } from '../openapi/state-loader.js';
import { type CommandRegistry, createDefaultRegistry } from '../repl/commands.js';
import { getHistoryPath, type ReplState } from '../repl/state.js';
import { loadWorkspaceConfig } from '../workspace/config/loader.js';
import { findWorkspace } from '../workspace/detection.js';
import { getActiveProfile, getActiveWorkspace } from '../workspace/global-config.js';
import { getWorkspace } from '../workspace/registry/loader.js';
import { AutocompletePopup } from './components/AutocompletePopup.js';
import { CommandLine } from './components/CommandLine.js';
import { HelpPanel } from './components/HelpPanel.js';
import { type HistoryItem, HistoryPicker } from './components/HistoryPicker.js';
import { InspectorModal } from './components/InspectorModal.js';
import { type ProfileConfigData, ProfileConfigModal } from './components/ProfileConfigModal.js';
import { StatusLine } from './components/StatusLine.js';
import { Transcript } from './components/Transcript.js';
import { type PathInfo, useAutocomplete } from './hooks/useAutocomplete.js';
import { useCommand } from './hooks/useCommand.js';
import { useExternalEditor } from './hooks/useExternalEditor.js';
import { useKeyBindings } from './hooks/useKeyBindings.js';
import { InkStateProvider, useInkState } from './state/context.js';
import type { LastResponse } from './state/types.js';

// React is needed for JSX transformation with tsx
void React;

export interface AppProps {
  initialState: ReplState;
}

/**
 * Inner App component that uses context
 */
function AppInner({ replState }: { replState: ReplState }): ReactNode {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { state, dispatch } = useInkState();

  // Track if we're currently typing in the input
  const [isInputFocused] = useState(true);

  // Track input value for command line
  const [inputValue, setInputValue] = useState('');

  // Mutable ref for current REPL state (updated during command execution)
  const replStateRef = useRef(replState);

  // Command registry
  const registry = useRef<CommandRegistry>(createDefaultRegistry());

  // Build OpenAPI paths for autocomplete
  const paths = useMemo((): PathInfo[] => {
    const spec = replState.spec;
    if (!spec?.document?.paths) return [];

    return Object.entries(spec.document.paths).map(([path, methods]) => ({
      path,
      methods: Object.keys(methods || {}),
      description: undefined,
    }));
  }, [replState.spec]);

  // Autocomplete hook
  const autocomplete = useAutocomplete({
    paths,
    commands: registry.current.getAll().map((c) => c.name),
    minChars: 1,
    maxSuggestions: 8,
  });

  // Command execution hook
  const { execute, isExecuting } = useCommand({
    executor: async (command, args) => {
      await registry.current.execute(command, args, replStateRef.current);
    },
    onTranscriptEvent: (event) => {
      dispatch({ type: 'ADD_TRANSCRIPT', event });
    },
    onResult: (result) => {
      // Check if path changed after command execution
      if (replStateRef.current.currentPath !== state.currentPath) {
        dispatch({ type: 'SET_CURRENT_PATH', path: replStateRef.current.currentPath });
      }

      // Check if active profile changed (e.g., after 'profile use')
      if (replStateRef.current.activeProfile !== state.activeProfile) {
        dispatch({ type: 'SET_ACTIVE_PROFILE', profile: replStateRef.current.activeProfile });
      }

      // Check if workspace changed (e.g., after 'workspace use')
      if (
        replStateRef.current.workspace !== state.workspace ||
        replStateRef.current.workspaceConfig !== state.workspaceConfig
      ) {
        // Derive workspace name from config or path
        let newWorkspaceName: string | undefined;
        if (replStateRef.current.workspaceConfig?.name) {
          newWorkspaceName = replStateRef.current.workspaceConfig.name;
        } else if (replStateRef.current.workspace) {
          const parts = replStateRef.current.workspace.split('/');
          newWorkspaceName = parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1];
        }

        dispatch({
          type: 'SET_WORKSPACE',
          workspace: replStateRef.current.workspace,
          workspaceName: newWorkspaceName,
          config: replStateRef.current.workspaceConfig,
        });

        // Also sync activeProfile since workspace switch often clears/changes it
        dispatch({ type: 'SET_ACTIVE_PROFILE', profile: replStateRef.current.activeProfile });
      }

      // Check for last response from HTTP commands
      if (replStateRef.current.lastResponseBody) {
        const response: LastResponse = {
          status: 200, // Would need to get actual status from command
          statusText: 'OK',
          headers: {},
          body: replStateRef.current.lastResponseBody,
          timing: result.timing,
          size: replStateRef.current.lastResponseBody.length,
        };
        dispatch({ type: 'SET_LAST_RESPONSE', response });
      }

      // Check for pending modal (e.g., 'profile configure' command)
      if (replStateRef.current.pendingModal === 'profileConfig') {
        dispatch({ type: 'TOGGLE_PROFILE_CONFIG' });
        // Clear the flag so it doesn't re-trigger
        replStateRef.current.pendingModal = undefined;
      }
    },
  });

  // External editor hook
  const { openEditor } = useExternalEditor();

  // History items for picker
  const historyPickerItems = useMemo((): HistoryItem[] => {
    return state.transcript
      .filter((e) => e.type === 'command')
      .map((e) => ({
        command: typeof e.content === 'string' ? e.content : '',
        timestamp: e.timestamp,
      }))
      .reverse();
  }, [state.transcript]);

  // Command history strings for arrow key navigation (newest first)
  const commandHistory = useMemo((): string[] => {
    return historyPickerItems.map((item) => item.command);
  }, [historyPickerItems]);

  // Key bindings hook
  // Note: profileConfigOpen is NOT included in isModalOpen because ProfileConfigModal
  // handles its own Esc key (for sub-modals and closing)
  useKeyBindings({
    isInputFocused,
    isModalOpen: state.inspectorOpen || state.historyPickerOpen || state.helpOpen,
    onInspector: () => dispatch({ type: 'TOGGLE_INSPECTOR' }),
    onHistory: () => dispatch({ type: 'TOGGLE_HISTORY_PICKER' }),
    onHelp: () => dispatch({ type: 'TOGGLE_HELP' }),
    onEditor: () => {
      // Open external editor with current input value
      const result = openEditor(inputValue);
      if (result.success) {
        if (result.content) {
          setInputValue(result.content);
          dispatch({
            type: 'ADD_TRANSCRIPT',
            event: { type: 'notice', content: `Loaded from editor: ${result.content.length} chars` },
          });
        }
      } else if (result.error) {
        dispatch({
          type: 'ADD_TRANSCRIPT',
          event: { type: 'error', content: `Editor error: ${result.error}` },
        });
      }
    },
    onQuit: () => {
      replStateRef.current.running = false;
      exit();
    },
    onCloseModal: () => dispatch({ type: 'CLOSE_ALL_MODALS' }),
  });

  // Handle command submission
  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      // Handle exit command specially
      if (trimmed === 'exit' || trimmed === 'quit') {
        replStateRef.current.running = false;
        exit();
        return;
      }

      // Execute the command
      await execute(trimmed);
      setInputValue('');
    },
    [execute, exit],
  );

  // Handle input change
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      autocomplete.updateInput(value);
    },
    [autocomplete],
  );

  // Handle autocomplete selection
  const handleAutocompleteSelect = useCallback(
    (value: string) => {
      const completed = autocomplete.select(value);
      setInputValue(completed);
    },
    [autocomplete],
  );

  // Handle history selection
  const handleHistorySelect = useCallback(
    (selectedCommand: string) => {
      setInputValue(selectedCommand);
      dispatch({ type: 'CLOSE_ALL_MODALS' });
    },
    [dispatch],
  );

  // Build profile config data for modal
  const profileConfigData = useMemo((): ProfileConfigData | undefined => {
    const profileName = state.activeProfile;
    const profiles = state.workspaceConfig?.profiles;
    if (!profileName || !profiles) {
      return undefined;
    }
    const profileConfig = profiles[profileName];
    if (!profileConfig) {
      return undefined;
    }
    return {
      name: profileName,
      baseUrl: profileConfig.baseUrl || '',
      timeoutMs: profileConfig.timeoutMs || 30000,
      verifyTls: profileConfig.verifyTls ?? true,
      headers: profileConfig.headers || {},
      vars: profileConfig.vars || {},
    };
  }, [state.activeProfile, state.workspaceConfig]);

  // Handle profile config save
  const handleProfileConfigSave = useCallback(
    async (key: string, value: string) => {
      // Build the correct command based on key format
      let command: string;

      if (key.startsWith('header:')) {
        // header:Name -> profile set header Name value
        const headerName = key.slice(7);
        command = `profile set header ${headerName} ${value}`;
      } else if (key.startsWith('var:')) {
        // var:name -> profile set var name value
        const varName = key.slice(4);
        command = `profile set var ${varName} ${value}`;
      } else {
        // base-url, timeout, verify-tls -> profile set key value
        command = `profile set ${key} ${value}`;
      }

      // Execute the profile set command to persist changes
      await execute(command);

      // Force refresh of workspaceConfig in Ink state (the command mutates in place)
      if (replStateRef.current.workspaceConfig) {
        dispatch({
          type: 'SET_WORKSPACE',
          workspace: replStateRef.current.workspace,
          workspaceName: state.workspaceName,
          // Create a shallow copy to trigger React re-render
          config: { ...replStateRef.current.workspaceConfig },
        });
      }

      dispatch({
        type: 'ADD_TRANSCRIPT',
        event: { type: 'notice', content: `Updated ${key}` },
      });
    },
    [execute, dispatch, state.workspaceName],
  );

  // Handle profile config delete
  const handleProfileConfigDelete = useCallback(
    async (key: string) => {
      // Build the unset command based on key format
      let command: string;

      if (key.startsWith('header:')) {
        // header:Name -> profile unset header Name
        const headerName = key.slice(7);
        command = `profile unset header ${headerName}`;
      } else if (key.startsWith('var:')) {
        // var:name -> profile unset var name
        const varName = key.slice(4);
        command = `profile unset var ${varName}`;
      } else {
        // Other keys - use profile unset key
        command = `profile unset ${key}`;
      }

      // Execute the profile unset command
      await execute(command);

      // Force refresh of workspaceConfig in Ink state
      if (replStateRef.current.workspaceConfig) {
        dispatch({
          type: 'SET_WORKSPACE',
          workspace: replStateRef.current.workspace,
          workspaceName: state.workspaceName,
          config: { ...replStateRef.current.workspaceConfig },
        });
      }

      dispatch({
        type: 'ADD_TRANSCRIPT',
        event: { type: 'notice', content: `Deleted ${key}` },
      });
    },
    [execute, dispatch, state.workspaceName],
  );

  // Calculate terminal height for transcript
  const terminalHeight = stdout?.rows ?? 24;
  const transcriptHeight = Math.max(5, terminalHeight - 10); // Leave room for status, input, etc.

  // Simple ">" prompt - path is shown in StatusLine
  const prompt = '>';

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Status Line - always visible */}
      <StatusLine
        workspaceName={state.workspaceName}
        currentPath={state.currentPath}
        activeProfile={state.activeProfile}
        baseUrl={state.activeProfile && state.workspaceConfig?.profiles?.[state.activeProfile]?.baseUrl}
        lastResponse={
          state.lastResponse
            ? {
                status: state.lastResponse.status,
                statusText: state.lastResponse.statusText,
                timing: state.lastResponse.timing,
              }
            : undefined
        }
      />

      {/* Full-screen modals replace main content */}
      {state.helpOpen ? (
        <Box flexGrow={1} flexDirection="column" marginTop={1}>
          <HelpPanel width={stdout?.columns ?? 80} />
          <Box marginTop={1}>
            <Text dimColor>Press Escape to close</Text>
          </Box>
        </Box>
      ) : state.inspectorOpen && state.lastResponse ? (
        <Box flexGrow={1} flexDirection="column" marginTop={1}>
          <InspectorModal
            response={{
              status: state.lastResponse.status,
              statusText: state.lastResponse.statusText,
              headers: state.lastResponse.headers,
              body: state.lastResponse.body,
              duration: state.lastResponse.timing,
            }}
            onClose={() => dispatch({ type: 'CLOSE_ALL_MODALS' })}
          />
        </Box>
      ) : state.historyPickerOpen ? (
        <Box flexGrow={1} flexDirection="column" marginTop={1}>
          <HistoryPicker
            items={historyPickerItems}
            onSelect={handleHistorySelect}
            onClose={() => dispatch({ type: 'CLOSE_ALL_MODALS' })}
            maxHeight={transcriptHeight}
          />
        </Box>
      ) : state.profileConfigOpen && profileConfigData ? (
        <Box flexGrow={1} flexDirection="column" marginTop={1}>
          <ProfileConfigModal
            profile={profileConfigData}
            onClose={() => dispatch({ type: 'CLOSE_ALL_MODALS' })}
            onSave={handleProfileConfigSave}
            onDelete={handleProfileConfigDelete}
            cursorSettings={state.cursorSettings}
          />
        </Box>
      ) : (
        <>
          {/* Transcript */}
          <Box flexGrow={1} flexDirection="column" marginTop={1}>
            <Transcript events={state.transcript} maxHeight={transcriptHeight} />
          </Box>

          {/* Command Line */}
          <Box flexDirection="column">
            <CommandLine
              prompt={prompt}
              value={inputValue}
              onSubmit={handleSubmit}
              onChange={handleInputChange}
              placeholder="Type a command..."
              isDisabled={isExecuting}
              history={commandHistory}
              autocompleteActive={autocomplete.isVisible && autocomplete.suggestions.length > 0}
              cursorSettings={state.cursorSettings}
            />

            {/* Autocomplete - inline below input */}
            {autocomplete.isVisible && (
              <AutocompletePopup
                suggestions={autocomplete.suggestions}
                onSelect={handleAutocompleteSelect}
                onClose={autocomplete.hide}
              />
            )}

            {/* Hint bar - at the very bottom */}
            <Box marginTop={1}>
              <Text dimColor>
                ^O inspect · ^R history · ^/ help · ^C quit
                {isExecuting && <Text color="yellow"> (executing...)</Text>}
              </Text>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

/**
 * Welcome message component
 */
function WelcomeMessage({ replState }: { replState: ReplState }): ReactNode {
  const { state, dispatch } = useInkState();

  useEffect(() => {
    // Add welcome message to transcript
    dispatch({
      type: 'ADD_TRANSCRIPT',
      event: {
        type: 'meta',
        content: '╔════════════════════════════╗\n║  Welcome to unireq REPL    ║\n╚════════════════════════════╝',
      },
    });

    // Add workspace info if available (skip if "(local)" - no default workspace concept)
    if (state.workspaceName && state.workspaceName !== '(local)') {
      const profileLabel = replState.activeProfile ? ` / ${replState.activeProfile}` : '';
      dispatch({
        type: 'ADD_TRANSCRIPT',
        event: { type: 'meta', content: `Workspace: ${state.workspaceName}${profileLabel}` },
      });
    }

    // Add OpenAPI info if loaded
    const specInfo = getSpecInfoString(replState);
    if (specInfo) {
      dispatch({
        type: 'ADD_TRANSCRIPT',
        event: { type: 'meta', content: `OpenAPI: ${specInfo}` },
      });
    }

    // Add help hint
    dispatch({
      type: 'ADD_TRANSCRIPT',
      event: {
        type: 'meta',
        content: "Type 'help' for available commands, 'exit' or Ctrl+C to quit.",
      },
    });
  }, [dispatch, replState, state.workspaceName]);

  return null;
}

/**
 * Root Ink application component
 *
 * Renders the full REPL UI with:
 * - StatusLine (top)
 * - Transcript (middle, scrollable)
 * - CommandLine (bottom)
 * - Modals (inspector, history, help)
 */
export function App({ initialState }: AppProps): ReactNode {
  // Initialize state from ReplState
  const [replState, setReplState] = useState(() => {
    const state = { ...initialState };
    state.isReplMode = true;

    // Setup history writer
    const historyPath = getHistoryPath(state.workspace);
    if (historyPath) {
      state.historyWriter = new HistoryWriter({ historyPath });
    }

    // Load workspace config (try registry first, then local detection)
    const activeWorkspaceName = getActiveWorkspace();
    if (activeWorkspaceName) {
      // First try registry lookup
      const ws = getWorkspace(activeWorkspaceName);
      if (ws) {
        const config = loadWorkspaceConfig(ws.path);
        if (config) {
          state.workspace = ws.path;
          state.workspaceConfig = config;
          state.activeProfile = getActiveProfile();
        }
      }
    }

    // Fallback: try local workspace detection if still not loaded
    if (!state.workspaceConfig) {
      const localWorkspace = findWorkspace();
      if (localWorkspace) {
        const config = loadWorkspaceConfig(localWorkspace.path);
        if (config) {
          state.workspace = localWorkspace.path;
          state.workspaceConfig = config;
          // Also load active profile if set in global config
          state.activeProfile = getActiveProfile();
        }
      }
    }

    return state;
  });

  // Load OpenAPI spec asynchronously
  useEffect(() => {
    const loadSpec = async () => {
      if (replState.workspaceConfig?.openapi?.source) {
        await loadSpecIntoState(replState, replState.workspaceConfig.openapi.source, {
          workspacePath: replState.workspace,
          silent: true,
        });
        // Trigger re-render with updated spec
        setReplState({ ...replState });
      }
    };
    loadSpec();
  }, []);

  // Derive workspace name from config or path
  // Priority: config.name > parent directory of .unireq path > undefined
  const workspaceName = useMemo(() => {
    // Use name from workspace config if available
    if (replState.workspaceConfig?.name) {
      return replState.workspaceConfig.name;
    }
    // Fallback: extract parent directory name from .unireq path
    // e.g., /home/user/test-api/.unireq -> test-api
    if (replState.workspace) {
      const parts = replState.workspace.split('/');
      // Remove the last part (.unireq) and get the parent directory
      if (parts.length >= 2) {
        return parts[parts.length - 2] || parts[parts.length - 1];
      }
      return parts[parts.length - 1];
    }
    return undefined;
  }, [replState.workspace, replState.workspaceConfig?.name]);

  return (
    <InkStateProvider
      initialState={{
        workspace: replState.workspace,
        workspaceName,
        workspaceConfig: replState.workspaceConfig,
        currentPath: replState.currentPath,
        activeProfile: replState.activeProfile,
        spec: replState.spec,
      }}
    >
      <WelcomeMessage replState={replState} />
      <AppInner replState={replState} />
    </InkStateProvider>
  );
}
