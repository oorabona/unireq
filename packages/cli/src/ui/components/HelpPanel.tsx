/**
 * Help Panel Component
 *
 * Displays contextual help with keyboard shortcuts, commands, and tips.
 * Uses the shared Modal component for consistent styling.
 */

import { Box, Text } from 'ink';
import React from 'react';
import { Modal } from './Modal.js';

// React is needed for JSX transformation with tsx
void React;

/**
 * Shortcut definition
 */
export interface Shortcut {
  /** Key binding (e.g., "Ctrl+C") */
  key: string;
  /** Action description */
  action: string;
  /** Category for grouping */
  category?: string;
}

/**
 * Command help definition
 */
export interface CommandHelp {
  /** Command name */
  name: string;
  /** Short description */
  description: string;
  /** Usage example */
  usage?: string;
  /** Aliases */
  aliases?: string[];
}

/**
 * HelpPanel props
 */
export interface HelpPanelProps {
  /** Panel title */
  title?: string;
  /** Keyboard shortcuts to display */
  shortcuts?: Shortcut[];
  /** Panel width */
  width?: number;
  /** Callback when panel should close */
  onClose?: () => void;
}

/**
 * Default keyboard shortcuts
 * Note: Ctrl+I=Tab, Ctrl+H=Backspace in terminals, so we use alternatives
 */
export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: 'Tab', action: 'Autocomplete', category: 'Input' },
  { key: '↑/↓', action: 'Navigate history', category: 'Input' },
  { key: 'Ctrl+C', action: 'Quit', category: 'Control' },
  { key: 'Ctrl+D', action: 'Quit (EOF)', category: 'Control' },
  { key: 'Ctrl+L', action: 'Clear screen', category: 'Control' },
  { key: 'Ctrl+E', action: 'Open editor', category: 'Editor' },
  { key: 'Ctrl+Q', action: 'Inspect response', category: 'Modals' },
  { key: 'Ctrl+R', action: 'History picker', category: 'Modals' },
  { key: 'Ctrl+P', action: 'Profile config', category: 'Modals' },
  { key: 'Ctrl+O', action: 'Settings', category: 'Modals' },
  { key: 'Ctrl+T', action: 'HTTP defaults', category: 'Modals' },
  { key: 'Ctrl+/', action: 'Show help', category: 'Modals' },
  { key: 'Escape', action: 'Close modal', category: 'Modals' },
];

/**
 * Default REPL commands
 */
export const DEFAULT_COMMANDS: CommandHelp[] = [
  { name: 'help', description: 'Show this help', aliases: ['?', 'h'] },
  { name: 'exit', description: 'Exit the REPL', aliases: ['quit', 'q'] },
  { name: 'clear', description: 'Clear the screen', aliases: ['cls'] },
  { name: 'history', description: 'Show command history' },
  { name: 'cd', description: 'Change base path', usage: 'cd /api/v1' },
  { name: 'ls', description: 'List available paths' },
  { name: 'pwd', description: 'Show current path' },
  { name: 'env', description: 'Show/set environment variables' },
  { name: 'set', description: 'Set configuration option', usage: 'set timeout 5000' },
  { name: 'auth', description: 'Configure authentication' },
  { name: 'headers', description: 'Manage request headers' },
  { name: 'spec', description: 'OpenAPI spec operations' },
  { name: 'workspace', description: 'Workspace operations' },
  { name: 'profile', description: 'Profile management' },
  { name: 'http', description: 'HTTP output defaults' },
  { name: 'settings', description: 'UI settings' },
];

/**
 * Group shortcuts by category
 */
function groupShortcuts(shortcuts: Shortcut[]): Map<string, Shortcut[]> {
  const groups = new Map<string, Shortcut[]>();

  for (const shortcut of shortcuts) {
    const category = shortcut.category || 'General';
    const group = groups.get(category) || [];
    group.push(shortcut);
    groups.set(category, group);
  }

  return groups;
}

/**
 * Keyboard Shortcuts Panel
 *
 * Shows keyboard shortcuts in a styled modal.
 * Use 'help' command for full command list.
 *
 * @example
 * ```tsx
 * <HelpPanel onClose={() => setShowHelp(false)} />
 * ```
 */
export function HelpPanel({
  title = 'Keyboard Shortcuts',
  shortcuts = DEFAULT_SHORTCUTS,
  width = 46,
}: HelpPanelProps): React.ReactElement {
  const groupedShortcuts = groupShortcuts(shortcuts);

  return (
    <Modal title={title} titleColor="cyan" borderColor="cyan" footer="Esc close · 'help' for commands" minWidth={width}>
      <Box flexDirection="column">
        {/* Keyboard Shortcuts by category */}
        {Array.from(groupedShortcuts.entries()).map(([category, items]) => (
          <Box key={category} flexDirection="column" marginBottom={1}>
            <Text dimColor italic>
              {category}
            </Text>
            {items.map((s, i) => (
              <Text key={i}>
                <Text color="green">{s.key.padEnd(12)}</Text>
                <Text>{s.action}</Text>
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    </Modal>
  );
}

/**
 * Compact help bar for inline display
 */
export interface HelpBarProps {
  /** Shortcuts to display */
  shortcuts?: Shortcut[];
  /** Maximum number of shortcuts to show */
  maxItems?: number;
}

/**
 * Compact help bar for status line
 *
 * @example
 * ```tsx
 * <HelpBar shortcuts={[
 *   { key: 'Tab', action: 'Complete' },
 *   { key: '?', action: 'Help' },
 * ]} />
 * ```
 */
export function HelpBar({ shortcuts = [], maxItems = 5 }: HelpBarProps): React.ReactElement {
  const visibleShortcuts = shortcuts.slice(0, maxItems);

  return (
    <Box flexDirection="row" gap={2}>
      {visibleShortcuts.map((s, i) => (
        <Text key={i} dimColor>
          <Text color="green">{s.key}</Text> {s.action}
        </Text>
      ))}
      {shortcuts.length > maxItems && (
        <Text dimColor>
          <Text color="green">?</Text> more...
        </Text>
      )}
    </Box>
  );
}
