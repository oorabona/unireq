---
doc-meta:
  status: wip
  scope: output
  type: spec
---

# Settings System Specification

## Overview

User-configurable UI preferences for the REPL, including color themes, syntax highlighting, and external command behavior.

## Problem Statement

1. **External commands lose colors**: When piping to `jq`, `grep --color`, etc., ANSI colors are stripped because `spawn()` doesn't signal TTY support
2. **No UI customization**: Users cannot configure output colors, themes, or display preferences

## Solution

### 1. External Command Color Passthrough

Modify `shell.ts` to pass `FORCE_COLOR=1` environment variable to spawned commands.

```typescript
const child = spawn(command, {
  shell: true,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '1' },
});
```

### 2. Settings System

#### Settings Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `theme` | `'dark' \| 'light' \| 'auto'` | `'auto'` | Color theme |
| `colors.primary` | string (hex/name) | `'cyan'` | Primary accent color |
| `colors.success` | string | `'green'` | Success status color |
| `colors.error` | string | `'red'` | Error status color |
| `colors.warning` | string | `'yellow'` | Warning color |
| `colors.muted` | string | `'gray'` | Muted/secondary text |
| `syntax.json` | boolean | `true` | Syntax highlight JSON |
| `syntax.headers` | boolean | `true` | Colorize HTTP headers |
| `externalColors` | boolean | `true` | Preserve external command colors |

#### Storage

- **Session**: In-memory state (cleared on exit)
- **Persistent**: `~/.config/unireq/config.yaml` under `settings:` key

```yaml
version: 1
activeWorkspace: my-api
settings:
  theme: dark
  colors:
    primary: cyan
    success: green
  syntax:
    json: true
  externalColors: true
```

### 3. Command Interface

```
settings                     # List all settings with sources
settings get <key>           # Get specific setting
settings set <key> <value>   # Set setting (persists to config)
settings reset [<key>]       # Reset to default (all or specific)
```

### 4. Keyboard Shortcut

`Ctrl+,` opens SettingsModal (consistent with VS Code, most IDEs).

### 5. Settings Modal UI

```
┌─────────────────────────────────────────┐
│ Settings                          [Esc] │
├─────────────────────────────────────────┤
│ Theme:      [dark] [light] [auto]       │
│                                         │
│ Colors                                  │
│   Primary:  [cyan    ▼]                 │
│   Success:  [green   ▼]                 │
│   Error:    [red     ▼]                 │
│                                         │
│ Syntax Highlighting                     │
│   [x] JSON responses                    │
│   [x] HTTP headers                      │
│                                         │
│ External Commands                       │
│   [x] Preserve colors (FORCE_COLOR)     │
│                                         │
│ [Reset to Defaults]                     │
└─────────────────────────────────────────┘
```

## BDD Scenarios

### External Command Colors

```gherkin
Scenario: External command preserves colors
  Given I have jq installed
  When I run "get /users | jq '.'"
  Then the output should contain ANSI color codes
  And the JSON should be syntax highlighted by jq

Scenario: External colors can be disabled
  Given settings externalColors is false
  When I run "get /users | jq '.'"
  Then the output should not contain ANSI color codes
```

### Settings Command

```gherkin
Scenario: List all settings
  When I run "settings"
  Then I see all settings with their values
  And each setting shows its source (built-in/config/session)

Scenario: Get specific setting
  When I run "settings get theme"
  Then I see "theme = dark (source: built-in)"

Scenario: Set setting persists to config
  When I run "settings set theme light"
  Then ~/.config/unireq/config.yaml contains "theme: light"
  And I see "theme = light (saved to config)"

Scenario: Reset specific setting
  Given theme is set to "light" in config
  When I run "settings reset theme"
  Then theme returns to default "auto"
  And config file no longer contains theme

Scenario: Reset all settings
  Given multiple settings are customized
  When I run "settings reset"
  Then all settings return to defaults
  And config settings section is cleared
```

### Settings Modal

```gherkin
Scenario: Open settings with Ctrl+,
  When I press Ctrl+,
  Then the settings modal opens
  And I can navigate with arrow keys

Scenario: Change theme in modal
  Given settings modal is open
  When I select "light" theme
  Then the UI immediately reflects the change
  And the setting is persisted

Scenario: Close modal with Escape
  Given settings modal is open
  When I press Escape
  Then the modal closes
  And focus returns to command line
```

## Implementation Plan

### Block 1: External Command Colors (Quick Fix)
- [ ] Modify `shell.ts` to pass `FORCE_COLOR=1`
- [ ] Add `externalColors` setting check
- [ ] Test with jq, grep --color

### Block 2: Settings Types & Storage
- [ ] Create `settings/types.ts` with SettingsConfig interface
- [ ] Create `settings/store.ts` for session + persistent storage
- [ ] Add settings to global config schema
- [ ] Create `settings/defaults.ts` with built-in defaults

### Block 3: Settings Command
- [ ] Create `settings/commands.ts` following defaults pattern
- [ ] Register in REPL commands
- [ ] Add help text
- [ ] Write tests

### Block 4: Ctrl+, Shortcut
- [ ] Add case in `useKeyBindings.ts`
- [ ] Add `onSettings` callback
- [ ] Update help panel

### Block 5: Settings Modal
- [ ] Create `SettingsModal.tsx` component
- [ ] Wire up to App.tsx
- [ ] Add keyboard navigation
- [ ] Write tests

## Test Requirements

- Unit tests for settings store (get/set/reset/persistence)
- Unit tests for settings command parsing
- Integration test for external command colors
- Component tests for SettingsModal
