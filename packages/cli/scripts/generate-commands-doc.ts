#!/usr/bin/env tsx
/**
 * Generate COMMANDS.md from source code
 *
 * This script reads command definitions from the codebase and generates
 * up-to-date documentation in docs/COMMANDS.md
 *
 * Usage: pnpm generate:commands
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_INFO, REPL_COMMANDS } from '../src/repl/help.js';
import { HTTP_OPTIONS } from '../src/shared/http-options.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '../docs/COMMANDS.md');

/**
 * Shell commands with their subcommands
 */
const SHELL_COMMANDS = {
  workspace: {
    description: 'Manage workspaces (kubectl-inspired model)',
    subcommands: [
      { name: 'list', args: '-', description: 'List all workspaces (local + global)' },
      { name: 'init', args: '[dir]', description: 'Create workspace in directory' },
      { name: 'register', args: '<name> <path>', description: 'Register existing workspace' },
      { name: 'unregister', args: '<name>', description: 'Remove workspace from registry' },
      { name: 'use', args: '<name>', description: 'Switch active workspace' },
      { name: 'current', args: '-', description: 'Show active workspace and profile' },
      { name: 'doctor', args: '[path]', description: 'Validate workspace configuration' },
    ],
  },
  profile: {
    description: 'Manage environment profiles',
    subcommands: [
      { name: 'list', args: '-', description: 'List available profiles' },
      { name: 'create', args: '<name> [--from <profile>]', description: 'Create new profile' },
      { name: 'rename', args: '<old> <new>', description: 'Rename a profile' },
      { name: 'delete', args: '<name>', description: 'Delete a profile' },
      { name: 'use', args: '<name>', description: 'Switch to profile' },
      { name: 'show', args: '[name]', description: 'Show profile details' },
      { name: 'edit', args: '-', description: 'Open workspace.yaml in $EDITOR' },
      { name: 'set', args: '<key> <value>', description: 'Set profile parameter' },
      { name: 'unset', args: '<key> [name]', description: 'Unset profile parameter' },
      { name: 'configure', args: '-', description: 'Open interactive config modal (REPL/Ink only)' },
    ],
    setKeys: [
      { key: 'base-url', value: '<url>', description: 'Set the base URL' },
      { key: 'timeout', value: '<ms>', description: 'Set timeout in milliseconds' },
      { key: 'verify-tls', value: 'true/false', description: 'Set TLS verification' },
      { key: 'header', value: '<name> <value>', description: 'Set a default header' },
      { key: 'var', value: '<name> <value>', description: 'Set a variable' },
    ],
  },
  defaults: {
    description: 'View HTTP output defaults with source tracking',
    subcommands: [
      { name: '*(none)*', args: '-', description: 'Show all defaults with sources', context: 'Both' },
      { name: 'get', args: '<key>', description: 'Show single default with source', context: 'Both' },
      { name: 'set', args: '<key> <value>', description: 'Set session override', context: 'REPL only' },
      { name: 'reset', args: '[key]', description: 'Clear session override(s)', context: 'REPL only' },
    ],
    validKeys: ['includeHeaders', 'outputMode', 'showSummary', 'trace', 'showSecrets', 'hideBody'],
  },
  secret: {
    description: 'Manage encrypted secrets',
    subcommands: [
      { name: 'init', args: '-', description: 'Initialize vault with passphrase' },
      { name: 'unlock', args: '-', description: 'Unlock vault for session' },
      { name: 'lock', args: '-', description: 'Lock vault' },
      { name: 'set', args: '<name> [value]', description: 'Set a secret (prompts if no value)' },
      { name: 'get', args: '<name>', description: 'Get a secret value' },
      { name: 'list', args: '-', description: 'List all secrets' },
      { name: 'delete', args: '<name>', description: 'Delete a secret' },
      { name: 'status', args: '-', description: 'Show vault status' },
      { name: 'backend', args: '[auto|keychain|vault]', description: 'Get/set secrets backend' },
    ],
  },
};

/**
 * Keyboard shortcuts for REPL
 */
const KEYBOARD_SHORTCUTS = [
  { shortcut: 'Tab', action: 'Auto-complete commands and paths' },
  { shortcut: 'Up/Down', action: 'Navigate command history' },
  { shortcut: 'Ctrl+R', action: 'Reverse search history' },
  { shortcut: 'Ctrl+C', action: 'Cancel current input' },
  { shortcut: 'Ctrl+D', action: 'Exit REPL' },
  { shortcut: 'Ctrl+I', action: 'Toggle inspector (last response)' },
  { shortcut: 'Ctrl+H', action: 'Toggle history picker' },
  { shortcut: '?', action: 'Toggle help panel' },
];

/**
 * Ink UI modals
 */
const INK_MODALS = [
  { modal: 'Inspector', trigger: 'Ctrl+I', description: 'View last HTTP response details' },
  { modal: 'History Picker', trigger: 'Ctrl+H', description: 'Browse and replay command history' },
  { modal: 'Help Panel', trigger: '?', description: 'Show keyboard shortcuts and commands' },
  { modal: 'Profile Config', trigger: 'profile configure', description: 'Interactive profile editor' },
];

/**
 * Generate HTTP options table from HTTP_OPTIONS
 */
function generateHttpOptionsTable(): string {
  const lines: string[] = ['| Flag | Description |', '|------|-------------|'];

  for (const opt of HTTP_OPTIONS) {
    const flags: string[] = [];
    if (opt.short) {
      flags.push(`-${opt.short}`);
    }
    flags.push(`--${opt.long}`);
    const flagStr = flags.join(', ');
    lines.push(`| \`${flagStr}\` | ${opt.description} |`);
  }

  return lines.join('\n');
}

/**
 * Generate REPL commands by category
 */
function generateReplCommandsByCategory(): string {
  const sections: string[] = [];

  // Group commands by category
  const grouped = new Map<string, typeof REPL_COMMANDS>();
  for (const cmd of REPL_COMMANDS) {
    const existing = grouped.get(cmd.category) ?? [];
    existing.push(cmd);
    grouped.set(cmd.category, existing);
  }

  // Sort by category order
  const sortedCategories = [...grouped.entries()].sort(
    ([a], [b]) =>
      CATEGORY_INFO[a as keyof typeof CATEGORY_INFO].order - CATEGORY_INFO[b as keyof typeof CATEGORY_INFO].order,
  );

  for (const [category, commands] of sortedCategories) {
    const categoryInfo = CATEGORY_INFO[category as keyof typeof CATEGORY_INFO];
    sections.push(`### ${categoryInfo.label}`);
    sections.push('');
    sections.push('| Command | Arguments | Description |');
    sections.push('|---------|-----------|-------------|');

    for (const cmd of commands) {
      // Extract arguments from helpText if available
      let args = '-';
      if (cmd.helpText) {
        const usageMatch = cmd.helpText.match(/Usage:\s+\w+\s+(.+?)(?:\n|$)/);
        if (usageMatch?.[1]) {
          args = `\`${usageMatch[1].trim()}\``;
        }
      }
      sections.push(`| \`${cmd.name}\` | ${args} | ${cmd.description} |`);
    }

    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Generate the full COMMANDS.md content
 */
function generateDocument(): string {
  const timestamp = new Date().toISOString().split('T')[0];

  return `# @unireq/cli Command Reference

> **Auto-generated** - Run \`pnpm generate:commands\` to update this file.

## Command Availability

| Context | Description |
|---------|-------------|
| **Shell** | One-shot commands via \`unireq <command>\` |
| **REPL** | Interactive mode commands via \`unireq repl\` |
| **Both** | Available in both contexts |

---

## Shell Commands

Commands available via \`unireq <command>\`:

### \`unireq\` (root)

\`\`\`
unireq [options] <command>
\`\`\`

**Global Options:**
| Flag | Description |
|------|-------------|
| \`-t, --timeout <ms>\` | Request timeout in milliseconds |
| \`--trace\` | Show request/response details |
| \`-o, --output <mode>\` | Output mode: pretty (default), json, raw |
| \`--no-color\` | Disable colors in output |
| \`--repl-commands\` | Show all available REPL commands |

---

### \`unireq repl\`

Start interactive REPL mode.

\`\`\`
unireq repl
\`\`\`

---

### HTTP Methods

All HTTP commands share the same options:

\`\`\`
unireq <method> <url> [options]
\`\`\`

**Methods:** \`get\`, \`post\`, \`put\`, \`patch\`, \`delete\`, \`head\`, \`options\`

**Options:**
${generateHttpOptionsTable()}

**Examples:**
\`\`\`bash
unireq get https://api.example.com/users
unireq post /users -b '{"name":"Alice"}' -H "Content-Type:application/json"
unireq get /users -i -S --trace
unireq get /users -e curl
\`\`\`

---

### \`unireq workspace\`

${SHELL_COMMANDS.workspace.description}.

\`\`\`
unireq workspace <subcommand> [args]
\`\`\`

**Subcommands:**
| Subcommand | Arguments | Description |
|------------|-----------|-------------|
${SHELL_COMMANDS.workspace.subcommands.map((s) => `| \`${s.name}\` | \`${s.args}\` | ${s.description} |`).join('\n')}

---

### \`unireq profile\`

${SHELL_COMMANDS.profile.description}.

\`\`\`
unireq profile <subcommand> [args]
\`\`\`

**Subcommands:**
| Subcommand | Arguments | Description |
|------------|-----------|-------------|
${SHELL_COMMANDS.profile.subcommands.map((s) => `| \`${s.name}\` | \`${s.args}\` | ${s.description} |`).join('\n')}

**\`profile set\` Keys:**
| Key | Value | Description |
|-----|-------|-------------|
${SHELL_COMMANDS.profile.setKeys?.map((k) => `| \`${k.key}\` | \`${k.value}\` | ${k.description} |`).join('\n')}

---

### \`unireq defaults\`

${SHELL_COMMANDS.defaults.description}.

\`\`\`
unireq defaults [subcommand] [key]
\`\`\`

**Subcommands:**
| Subcommand | Arguments | Description | Context |
|------------|-----------|-------------|---------|
${SHELL_COMMANDS.defaults.subcommands.map((s) => `| \`${s.name}\` | \`${s.args}\` | ${s.description} | ${s.context} |`).join('\n')}

**Valid Keys:**
\`${SHELL_COMMANDS.defaults.validKeys?.join('`, `')}\`

---

### \`unireq secret\`

${SHELL_COMMANDS.secret.description}.

\`\`\`
unireq secret <subcommand> [args]
\`\`\`

**Subcommands:**
| Subcommand | Arguments | Description |
|------------|-----------|-------------|
${SHELL_COMMANDS.secret.subcommands.map((s) => `| \`${s.name}\` | \`${s.args}\` | ${s.description} |`).join('\n')}

---

## REPL Commands

Commands available in interactive mode (\`unireq repl\`):

${generateReplCommandsByCategory()}

---

## Keyboard Shortcuts (REPL)

| Shortcut | Action |
|----------|--------|
${KEYBOARD_SHORTCUTS.map((k) => `| \`${k.shortcut}\` | ${k.action} |`).join('\n')}

---

## Ink UI Modals (REPL)

The Ink-based UI provides interactive modals:

| Modal | Trigger | Description |
|-------|---------|-------------|
${INK_MODALS.map((m) => `| **${m.modal}** | \`${m.trigger}\` | ${m.description} |`).join('\n')}

---

*Generated from source code. Last updated: ${timestamp}*
`;
}

// Main execution
const content = generateDocument();
writeFileSync(OUTPUT_PATH, content);
console.log(`✅ Generated ${OUTPUT_PATH}`);
