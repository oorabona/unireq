# @unireq/cli Command Reference

> **Auto-generated** - Run `pnpm generate:commands` to update this file.

## Command Availability

| Context | Description |
|---------|-------------|
| **Shell** | One-shot commands via `unireq <command>` |
| **REPL** | Interactive mode commands via `unireq repl` |
| **Both** | Available in both contexts |

---

## Shell Commands

Commands available via `unireq <command>`:

### `unireq` (root)

```
unireq [options] <command>
```

**Global Options:**
| Flag | Description |
|------|-------------|
| `-t, --timeout <ms>` | Request timeout in milliseconds |
| `--trace` | Show request/response details |
| `-o, --output <mode>` | Output mode: pretty (default), json, raw |
| `--no-color` | Disable colors in output |
| `--repl-commands` | Show all available REPL commands |

---

### `unireq repl`

Start interactive REPL mode.

```
unireq repl
```

---

### HTTP Methods

All HTTP commands share the same options:

```
unireq <method> <url> [options]
```

**Methods:** `get`, `post`, `put`, `patch`, `delete`, `head`, `options`

**Options:**
| Flag | Description |
|------|-------------|
| `-H, --header` | Add header (key:value), repeatable |
| `-q, --query` | Add query param (key=value), repeatable |
| `-b, --body` | Request body (JSON string or @filepath) |
| `-t, --timeout` | Request timeout in milliseconds |
| `-o, --output` | Output mode: pretty, json, raw |
| `-i, --include` | Include response headers in output |
| `--no-redact` | Disable secret redaction (show Authorization, tokens, etc.) |
| `-S, --summary` | Show summary footer with status and size |
| `--trace` | Show timing information |
| `-e, --export` | Export request as command: curl, httpie |
| `-B, --no-body` | Suppress response body output (show headers/status only) |

**Examples:**
```bash
unireq get https://api.example.com/users
unireq post /users -b '{"name":"Alice"}' -H "Content-Type:application/json"
unireq get /users -i -S --trace
unireq get /users -e curl
```

---

### `unireq workspace`

Manage workspaces (kubectl-inspired model).

```
unireq workspace <subcommand> [args]
```

**Subcommands:**
| Subcommand | Arguments | Description |
|------------|-----------|-------------|
| `list` | `-` | List all workspaces (local + global) |
| `init` | `[dir]` | Create workspace in directory |
| `register` | `<name> <path>` | Register existing workspace |
| `unregister` | `<name>` | Remove workspace from registry |
| `use` | `<name>` | Switch active workspace |
| `current` | `-` | Show active workspace and profile |
| `doctor` | `[path]` | Validate workspace configuration |

---

### `unireq profile`

Manage environment profiles.

```
unireq profile <subcommand> [args]
```

**Subcommands:**
| Subcommand | Arguments | Description |
|------------|-----------|-------------|
| `list` | `-` | List available profiles |
| `create` | `<name> [--from <profile>]` | Create new profile |
| `rename` | `<old> <new>` | Rename a profile |
| `delete` | `<name>` | Delete a profile |
| `use` | `<name>` | Switch to profile |
| `show` | `[name]` | Show profile details |
| `edit` | `-` | Open workspace.yaml in $EDITOR |
| `set` | `<key> <value>` | Set profile parameter |
| `unset` | `<key> [name]` | Unset profile parameter |
| `configure` | `-` | Open interactive config modal (REPL/Ink only) |

**`profile set` Keys:**
| Key | Value | Description |
|-----|-------|-------------|
| `base-url` | `<url>` | Set the base URL |
| `timeout` | `<ms>` | Set timeout in milliseconds |
| `verify-tls` | `true/false` | Set TLS verification |
| `header` | `<name> <value>` | Set a default header |
| `var` | `<name> <value>` | Set a variable |

---

### `unireq defaults`

View HTTP output defaults with source tracking.

```
unireq defaults [subcommand] [key]
```

**Subcommands:**
| Subcommand | Arguments | Description | Context |
|------------|-----------|-------------|---------|
| `*(none)*` | `-` | Show all defaults with sources | Both |
| `get` | `<key>` | Show single default with source | Both |
| `set` | `<key> <value>` | Set session override | REPL only |
| `reset` | `[key]` | Clear session override(s) | REPL only |

**Valid Keys:**
`includeHeaders`, `outputMode`, `showSummary`, `trace`, `showSecrets`, `hideBody`

---

### `unireq secret`

Manage encrypted secrets.

```
unireq secret <subcommand> [args]
```

**Subcommands:**
| Subcommand | Arguments | Description |
|------------|-----------|-------------|
| `init` | `-` | Initialize vault with passphrase |
| `unlock` | `-` | Unlock vault for session |
| `lock` | `-` | Lock vault |
| `set` | `<name> [value]` | Set a secret (prompts if no value) |
| `get` | `<name>` | Get a secret value |
| `list` | `-` | List all secrets |
| `delete` | `<name>` | Delete a secret |
| `status` | `-` | Show vault status |
| `backend` | `[auto|keychain|vault]` | Get/set secrets backend |

---

## REPL Commands

Commands available in interactive mode (`unireq repl`):

### Navigation

| Command | Arguments | Description |
|---------|-----------|-------------|
| `cd` | `<path>` | Change current API path |
| `ls` | `[path]` | List available paths and operations |
| `pwd` | - | Print current API path |

### HTTP Requests

| Command | Arguments | Description |
|---------|-----------|-------------|
| `get` | `<url> [options]` | Execute GET request |
| `post` | `<url> [options]` | Execute POST request |
| `put` | `<url> [options]` | Execute PUT request |
| `patch` | `<url> [options]` | Execute PATCH request |
| `delete` | `<url> [options]` | Execute DELETE request |
| `head` | `<url> [options]` | Execute HEAD request |
| `options` | `<url> [options]` | Execute OPTIONS request |

### Workspace & Profiles

| Command | Arguments | Description |
|---------|-----------|-------------|
| `workspace` | `[subcommand]` | Manage workspaces |
| `profile` | `[subcommand]` | Manage environment profiles |
| `describe` | `[path] [method]` | Describe OpenAPI operation |
| `import` | `<path-or-url> [options]` | Load OpenAPI spec from file or URL |
| `defaults` | `[get|set|reset] [<key>] [<value>]` | View and manage HTTP output defaults |

### Collections & History

| Command | Arguments | Description |
|---------|-----------|-------------|
| `run` | `<collection>/<item>` | Execute saved request from collections |
| `save` | `<collection>/<item> [--name "Display Name"]` | Save last request to a collection |
| `extract` | `<varName> <jsonPath>` | Extract value from last response |
| `vars` | - | Show extracted variables |
| `history` | `[subcommand]` | Browse command and request history |

### Security & Auth

| Command | Arguments | Description |
|---------|-----------|-------------|
| `secret` | `<subcommand>` | Manage secrets vault |
| `auth` | `<subcommand>` | Manage authentication |

### Utility

| Command | Arguments | Description |
|---------|-----------|-------------|
| `help` | `[command]` | Show available commands or detailed help |
| `version` | - | Show CLI version |
| `exit` | - | Exit the REPL |


---

## Keyboard Shortcuts (REPL)

| Shortcut | Action |
|----------|--------|
| `Tab` | Auto-complete commands and paths |
| `Up/Down` | Navigate command history |
| `Ctrl+R` | Reverse search history |
| `Ctrl+C` | Cancel current input |
| `Ctrl+D` | Exit REPL |
| `Ctrl+I` | Toggle inspector (last response) |
| `Ctrl+H` | Toggle history picker |
| `?` | Toggle help panel |

---

## Ink UI Modals (REPL)

The Ink-based UI provides interactive modals:

| Modal | Trigger | Description |
|-------|---------|-------------|
| **Inspector** | `Ctrl+I` | View last HTTP response details |
| **History Picker** | `Ctrl+H` | Browse and replay command history |
| **Help Panel** | `?` | Show keyboard shortcuts and commands |
| **Profile Config** | `profile configure` | Interactive profile editor |

---

*Generated from source code. Last updated: 2026-01-06*
