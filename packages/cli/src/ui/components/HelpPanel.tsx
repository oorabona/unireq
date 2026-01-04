/**
 * Help Panel Component
 *
 * Displays contextual help with keyboard shortcuts, commands, and tips.
 * Integrates with the REPL to show context-aware information.
 */

import { Box, Text } from 'ink';
import type React from 'react';

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
  /** Commands to display */
  commands?: CommandHelp[];
  /** Additional tips to display */
  tips?: string[];
  /** Panel width */
  width?: number;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Default keyboard shortcuts
 */
export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: 'Tab', action: 'Autocomplete', category: 'Input' },
  { key: 'Ctrl+C', action: 'Cancel / Exit', category: 'Control' },
  { key: 'Ctrl+D', action: 'Exit REPL', category: 'Control' },
  { key: 'Ctrl+L', action: 'Clear screen', category: 'Control' },
  { key: 'Ctrl+E', action: 'Open editor', category: 'Editor' },
  { key: '?', action: 'Show help', category: 'Help' },
  { key: 'Ctrl+R', action: 'History search', category: 'History' },
  { key: '↑/↓', action: 'Navigate history', category: 'History' },
  { key: 'Ctrl+I', action: 'Inspect response', category: 'Inspector' },
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
 * Help Panel component
 *
 * @example
 * ```tsx
 * <HelpPanel
 *   title="REPL Help"
 *   shortcuts={DEFAULT_SHORTCUTS}
 *   commands={DEFAULT_COMMANDS}
 *   tips={['Use Tab for autocomplete', 'Press ? for context help']}
 * />
 * ```
 */
export function HelpPanel({
  title = 'Help',
  shortcuts = DEFAULT_SHORTCUTS,
  commands = DEFAULT_COMMANDS,
  tips = [],
  width = 60,
  compact = false,
}: HelpPanelProps): React.ReactElement {
  const groupedShortcuts = groupShortcuts(shortcuts);

  return (
    <Box flexDirection="column" width={width} borderStyle="round" paddingX={1}>
      {/* Title */}
      <Box justifyContent="center" marginBottom={compact ? 0 : 1}>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>

      {/* Keyboard Shortcuts */}
      {shortcuts.length > 0 && (
        <Box flexDirection="column" marginBottom={compact ? 0 : 1}>
          <Text bold underline color="yellow">
            Keyboard Shortcuts
          </Text>

          {compact ? (
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              {shortcuts.map((s, i) => (
                <Text key={i} dimColor>
                  <Text color="green">{s.key}</Text>: {s.action}
                </Text>
              ))}
            </Box>
          ) : (
            Array.from(groupedShortcuts.entries()).map(([category, items]) => (
              <Box key={category} flexDirection="column" marginTop={1}>
                <Text dimColor italic>
                  {category}
                </Text>
                {items.map((s, i) => (
                  <Box key={i}>
                    <Box width={12}>
                      <Text color="green">{s.key}</Text>
                    </Box>
                    <Text>{s.action}</Text>
                  </Box>
                ))}
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Commands */}
      {commands.length > 0 && (
        <Box flexDirection="column" marginBottom={compact ? 0 : 1}>
          <Text bold underline color="yellow">
            Commands
          </Text>

          {compact ? (
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              {commands.map((cmd, i) => (
                <Text key={i} dimColor>
                  <Text color="blue">{cmd.name}</Text>
                </Text>
              ))}
            </Box>
          ) : (
            <Box flexDirection="column" marginTop={1}>
              {commands.map((cmd, i) => (
                <Box key={i} flexDirection="column">
                  <Box>
                    <Box width={12}>
                      <Text color="blue" bold>
                        {cmd.name}
                      </Text>
                    </Box>
                    <Text>{cmd.description}</Text>
                  </Box>
                  {cmd.aliases && cmd.aliases.length > 0 && (
                    <Text dimColor>
                      {'            '}Aliases: {cmd.aliases.join(', ')}
                    </Text>
                  )}
                  {cmd.usage && (
                    <Text dimColor>
                      {'            '}Usage: {cmd.usage}
                    </Text>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* HTTP Methods */}
      <Box flexDirection="column" marginBottom={compact ? 0 : 1}>
        <Text bold underline color="yellow">
          HTTP Methods
        </Text>
        <Box marginTop={1}>
          <Text>
            <Text color="green">GET</Text>, <Text color="blue">POST</Text>, <Text color="yellow">PUT</Text>,{' '}
            <Text color="magenta">PATCH</Text>, <Text color="red">DELETE</Text>, <Text dimColor>HEAD</Text>,{' '}
            <Text dimColor>OPTIONS</Text>
          </Text>
        </Box>
      </Box>

      {/* Tips */}
      {tips.length > 0 && (
        <Box flexDirection="column">
          <Text bold underline color="yellow">
            Tips
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {tips.map((tip, i) => (
              <Text key={i} dimColor>
                • {tip}
              </Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
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
