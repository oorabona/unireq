---
doc-meta:
  status: draft
  scope: workspace
  type: reference
  created: 2025-12-31
  updated: 2025-12-31
---

# Workspace Documentation Index

## Overview

Workspace management: configuration, persistence, local and global scope, profile management.

## Documents

| Document | Type | Status | Description |
|----------|------|--------|-------------|
| [Overview](../plans/WORKSPACE-OVERVIEW.md) | design | draft | Scope overview and features |

## Key Commands

| Command | Description |
|---------|-------------|
| `unireq workspace init` | Create new workspace |
| `unireq workspace list` | List workspaces |
| `unireq workspace use <name>` | Switch workspace |
| `unireq workspace doctor` | Validate workspace |

## REPL Commands

| Command | Description |
|---------|-------------|
| `set <key>=<value>` | Set workspace variable |
| `unset <key>` | Remove variable |
| `env` | Show workspace context |

## File Structure

```
.unireq/
├── workspace.yaml      # Main config
├── collections/        # Saved requests
├── history.ndjson      # Command history
└── cache/              # OpenAPI cache, etc.
```

## Config Paths by OS

| OS | Config | Data/Cache |
|----|--------|------------|
| Linux | `$XDG_CONFIG_HOME/unireq` | `$XDG_DATA_HOME/unireq` |
| macOS | `~/Library/Preferences/unireq` | `~/Library/Application Support/unireq` |
| Windows | `%APPDATA%\unireq` | `%LOCALAPPDATA%\unireq` |

## Related Specifications

| Story | Status |
|-------|--------|
| (none yet) | - |

## Backlog

- [TODO_WORKSPACE.md](../../TODO_WORKSPACE.md)
