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
import { HistoryReader, HistoryWriter } from '../collections/history/index.js';
import { getSpecInfoString, loadSpecIntoState } from '../openapi/state-loader.js';
import { type CommandRegistry, createDefaultRegistry } from '../repl/commands.js';
import { isSpecialSyntax, processSpecialInput } from '../repl/input-processor.js';
import { getHistoryPath, type ReplState } from '../repl/state.js';
import { loadWorkspaceConfig } from '../workspace/config/loader.js';
import { findWorkspace } from '../workspace/detection.js';
import { getActiveProfile, getActiveWorkspace } from '../workspace/global-config.js';
import { getWorkspace } from '../workspace/registry/loader.js';
import { AutocompletePopup } from './components/AutocompletePopup.js';
import { CommandLine } from './components/CommandLine.js';
import { HelpPanel } from './components/HelpPanel.js';
import { type HistoryItem, HistoryPicker } from './components/HistoryPicker.js';
import { HttpModal } from './components/HttpModal.js';
import { InspectorModal } from './components/InspectorModal.js';
import { type ProfileConfigData, ProfileConfigModal } from './components/ProfileConfigModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { StatusLine } from './components/StatusLine.js';
import { Transcript } from './components/Transcript.js';
import { type PathInfo, useAutocomplete } from './hooks/useAutocomplete.js';
import { useCommand } from './hooks/useCommand.js';
import { useExternalEditor } from './hooks/useExternalEditor.js';
import { useKeyBindings } from './hooks/useKeyBindings.js';
import { SettingsProvider, useSettingsContext } from './contexts/SettingsContext.js';
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

  // Get settings context for reactive color updates
  // version is used as key prop to force re-render when colors change
  const { version: settingsVersion, notifySettingsChanged } = useSettingsContext();

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
    maxSuggestions: 15,
  });

  // Command execution hook
  const { execute, isExecuting } = useCommand({
    executor: async (command, args) => {
      await registry.current.execute(command, args, replStateRef.current);
    },
    onTranscriptEvent: (event) => {
      dispatch({ type: 'ADD_TRANSCRIPT', event });
    },
    onResult: (_result) => {
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
      // All fields are set together in http-commands.ts, so if body exists, others do too
      if (
        replStateRef.current.lastResponseBody !== undefined &&
        replStateRef.current.lastResponseStatus !== undefined &&
        replStateRef.current.lastResponseStatusText !== undefined &&
        replStateRef.current.lastResponseHeaders !== undefined
      ) {
        const response: LastResponse = {
          status: replStateRef.current.lastResponseStatus,
          statusText: replStateRef.current.lastResponseStatusText,
          headers: replStateRef.current.lastResponseHeaders,
          body: replStateRef.current.lastResponseBody,
          timing: replStateRef.current.lastResponseTiming,
          size: replStateRef.current.lastResponseBody.length,
          method: replStateRef.current.lastRequestMethod,
          url: replStateRef.current.lastRequestUrl,
          requestHeaders: replStateRef.current.lastRequestHeaders,
          requestBody: replStateRef.current.lastRequestBody,
        };
        dispatch({ type: 'SET_LAST_RESPONSE', response });
      }

      // Check for pending modal (e.g., 'profile configure' or 'settings configure' command)
      if (replStateRef.current.pendingModal === 'profileConfig') {
        dispatch({ type: 'TOGGLE_PROFILE_CONFIG' });
        // Clear the flag so it doesn't re-trigger
        replStateRef.current.pendingModal = undefined;
      } else if (replStateRef.current.pendingModal === 'settingsConfig') {
        dispatch({ type: 'TOGGLE_SETTINGS' });
        // Clear the flag so it doesn't re-trigger
        replStateRef.current.pendingModal = undefined;
      }
    },
  });

  // External editor hook
  const { openEditor } = useExternalEditor();

  // History items for picker (session history)
  const historyPickerItems = useMemo((): HistoryItem[] => {
    return state.transcript
      .filter((e) => e.type === 'command')
      .map((e) => ({
        command: typeof e.content === 'string' ? e.content : '',
        timestamp: e.timestamp,
      }))
      .reverse();
  }, [state.transcript]);

  // History reader for persistent history (NDJSON file)
  const historyReader = useMemo(() => {
    const workspace = replStateRef.current.workspace;
    const historyPath = getHistoryPath(workspace);
    if (historyPath) {
      return new HistoryReader(historyPath);
    }
    return undefined;
  }, []);

  // Command history strings for arrow key navigation (newest first)
  const commandHistory = useMemo((): string[] => {
    return historyPickerItems.map((item) => item.command);
  }, [historyPickerItems]);

  // Key bindings hook
  // Note: profileConfigOpen is NOT included in isModalOpen because ProfileConfigModal
  // handles its own Esc key (for sub-modals and closing)
  useKeyBindings({
    isInputFocused,
    // Only consider inspector "open" if there's actually a response to show
    isModalOpen:
      (state.inspectorOpen && state.responseHistory.length > 0) ||
      state.historyPickerOpen ||
      state.helpOpen ||
      state.settingsOpen ||
      state.httpModalOpen,
    onInspector: () => {
      // Only open inspector if there's a response to inspect
      if (state.responseHistory.length > 0) {
        dispatch({ type: 'TOGGLE_INSPECTOR' });
      }
    },
    onHistory: () => dispatch({ type: 'TOGGLE_HISTORY_PICKER' }),
    onHelp: () => dispatch({ type: 'TOGGLE_HELP' }),
    onSettings: () => dispatch({ type: 'TOGGLE_SETTINGS' }),
    onProfileConfig: () => dispatch({ type: 'TOGGLE_PROFILE_CONFIG' }),
    onHttpModal: () => dispatch({ type: 'TOGGLE_HTTP_MODAL' }),
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
    onClear: () => dispatch({ type: 'CLEAR_TRANSCRIPT' }),
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

      // Check for special syntax (!cmd shell escape, expr | cmd piping)
      if (isSpecialSyntax(trimmed)) {
        // Add command to transcript
        dispatch({ type: 'ADD_TRANSCRIPT', event: { type: 'command', content: trimmed } });

        // Process the special syntax
        const result = await processSpecialInput(trimmed, replStateRef.current);

        if (result.handled) {
          // Add output to transcript if any (use 'meta' type for special syntax output, not 'result')
          if (result.output) {
            dispatch({ type: 'ADD_TRANSCRIPT', event: { type: 'meta', content: result.output.trimEnd() } });
          }
          if (result.error) {
            dispatch({ type: 'ADD_TRANSCRIPT', event: { type: 'error', content: result.error.trimEnd() } });
          }
          setInputValue('');
          return;
        }
        // If not handled (shouldn't happen), fall through to regular execution
      }

      // Execute the command through the registry
      await execute(trimmed);
      setInputValue('');
    },
    [execute, exit, dispatch],
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

  // Current response from history for inspector (avoid non-null assertions in JSX)
  const currentHistoryResponse = state.responseHistory[state.historyIndex];

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Status Line - always visible */}
      <StatusLine
        key={`status-${settingsVersion}`}
        workspaceName={state.workspaceName}
        currentPath={state.currentPath}
        activeProfile={state.activeProfile}
        baseUrl={state.activeProfile && state.workspaceConfig?.profiles?.[state.activeProfile]?.baseUrl}
        lastResponse={
          state.lastResponse
            ? {
                status: state.lastResponse.status,
                statusText: state.lastResponse.statusText,
                timing: state.lastResponse.timing?.total ?? 0,
              }
            : undefined
        }
        lastRequestUrl={state.lastResponse?.url}
      />

      {/* Full-screen modals replace main content */}
      {state.helpOpen ? (
        <Box flexGrow={1} flexDirection="column" marginTop={1} alignItems="center">
          <HelpPanel key={`help-${settingsVersion}`} />
        </Box>
      ) : state.inspectorOpen && currentHistoryResponse ? (
        <Box flexGrow={1} flexDirection="column" justifyContent="center">
          <InspectorModal
            key={`inspector-${settingsVersion}`}
            response={{
              status: currentHistoryResponse.status,
              statusText: currentHistoryResponse.statusText,
              headers: currentHistoryResponse.headers,
              body: currentHistoryResponse.body,
              duration: currentHistoryResponse.timing?.total,
              timing: currentHistoryResponse.timing,
              method: currentHistoryResponse.method,
              url: currentHistoryResponse.url,
              requestHeaders: currentHistoryResponse.requestHeaders,
              requestBody: currentHistoryResponse.requestBody,
            }}
            onClose={() => dispatch({ type: 'CLOSE_ALL_MODALS' })}
            historyPosition={
              state.responseHistory.length > 1
                ? { current: state.historyIndex + 1, total: state.responseHistory.length }
                : undefined
            }
            onNavigatePrev={
              state.historyIndex < state.responseHistory.length - 1
                ? () => dispatch({ type: 'SET_HISTORY_INDEX', index: state.historyIndex + 1 })
                : undefined
            }
            onNavigateNext={
              state.historyIndex > 0
                ? () => dispatch({ type: 'SET_HISTORY_INDEX', index: state.historyIndex - 1 })
                : undefined
            }
          />
        </Box>
      ) : state.historyPickerOpen ? (
        <Box flexGrow={1} flexDirection="column" marginTop={1}>
          <HistoryPicker
            key={`history-${settingsVersion}`}
            items={historyPickerItems}
            onSelect={handleHistorySelect}
            onClose={() => dispatch({ type: 'CLOSE_ALL_MODALS' })}
            maxHeight={transcriptHeight}
            historyReader={historyReader}
          />
        </Box>
      ) : state.profileConfigOpen && profileConfigData ? (
        <Box flexGrow={1} flexDirection="column" marginTop={1}>
          <ProfileConfigModal
            key={`profile-${settingsVersion}`}
            profile={profileConfigData}
            onClose={() => dispatch({ type: 'CLOSE_ALL_MODALS' })}
            onSave={handleProfileConfigSave}
            onDelete={handleProfileConfigDelete}
            cursorSettings={state.cursorSettings}
          />
        </Box>
      ) : state.settingsOpen ? (
        <Box flexGrow={1} flexDirection="column" marginTop={1} alignItems="center">
          <SettingsModal
            key={`settings-${settingsVersion}`}
            onClose={() => dispatch({ type: 'CLOSE_ALL_MODALS' })}
            onSettingsSaved={notifySettingsChanged}
          />
        </Box>
      ) : state.httpModalOpen ? (
        <Box flexGrow={1} flexDirection="column" marginTop={1} alignItems="center">
          <HttpModal
            key={`http-${settingsVersion}`}
            onClose={() => dispatch({ type: 'CLOSE_ALL_MODALS' })}
            sessionDefaults={replStateRef.current.sessionDefaults}
            workspaceDefaults={state.workspaceConfig?.defaults}
            profileDefaults={
              state.activeProfile
                ? state.workspaceConfig?.profiles?.[state.activeProfile]?.defaults
                : undefined
            }
            activeProfile={state.activeProfile}
            onSessionChange={(defaults) => {
              replStateRef.current.sessionDefaults = defaults;
              dispatch({
                type: 'ADD_TRANSCRIPT',
                event: { type: 'notice', content: defaults ? 'Session HTTP defaults updated' : 'Session HTTP defaults cleared' },
              });
            }}
            onProfileSave={async (defaults) => {
              if (!state.activeProfile) return;
              // Use profile set command to persist
              for (const [key, value] of Object.entries(defaults)) {
                const command = `profile set defaults.${key} ${String(value)}`;
                await execute(command);
              }
              // Refresh workspace config
              if (replStateRef.current.workspaceConfig) {
                dispatch({
                  type: 'SET_WORKSPACE',
                  workspace: replStateRef.current.workspace,
                  workspaceName: state.workspaceName,
                  config: { ...replStateRef.current.workspaceConfig },
                });
              }
            }}
            onWorkspaceSave={async (defaults) => {
              // Use workspace defaults set command
              for (const [key, value] of Object.entries(defaults)) {
                const command = `http set ${key} ${String(value)}`;
                await execute(command);
              }
              // Refresh workspace config
              if (replStateRef.current.workspaceConfig) {
                dispatch({
                  type: 'SET_WORKSPACE',
                  workspace: replStateRef.current.workspace,
                  workspaceName: state.workspaceName,
                  config: { ...replStateRef.current.workspaceConfig },
                });
              }
            }}
          />
        </Box>
      ) : (
        <>
          {/* Transcript */}
          <Box flexGrow={1} flexDirection="column" marginTop={1}>
            <Transcript key={`transcript-${settingsVersion}`} events={state.transcript} maxHeight={transcriptHeight} />
          </Box>

          {/* Command Line */}
          <Box flexDirection="column">
            <CommandLine
              prompt={prompt}
              value={inputValue}
              onSubmit={handleSubmit}
              onChange={handleInputChange}
              onTabPress={autocomplete.show}
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
                ^Q inspect · ^R history · ^P profile · ^O settings · ^T http · ^/ help · ^C quit
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

    // Load workspace config FIRST (try registry first, then local detection)
    // This must happen before creating historyWriter so we have the correct workspace path
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

    // Setup history writer AFTER workspace detection so we have the correct path
    const historyPath = getHistoryPath(state.workspace);
    if (historyPath) {
      state.historyWriter = new HistoryWriter({ historyPath });
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
    <SettingsProvider>
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
    </SettingsProvider>
  );
}
