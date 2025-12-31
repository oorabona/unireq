---
doc-meta:
  status: draft
  scope: cli-core
  type: reference
  created: 2025-12-31
  updated: 2025-12-31
---

# CLI Core Documentation Index

## Overview

Core CLI and REPL functionality: command parsing, shell-like navigation, and interactive session management.

## Documents

| Document | Type | Status | Description |
|----------|------|--------|-------------|
| [Overview](../plans/CLI_CORE-OVERVIEW.md) | design | draft | Scope overview and features |

## Key Commands (CLI)

| Command | Description |
|---------|-------------|
| `unireq [-h] [--version]` | Help and version |
| `unireq repl` | Start interactive REPL |
| `unireq request <METHOD> <URL>` | Execute HTTP request |
| `unireq get/post/put/patch/delete` | Method shortcuts |

## Key Commands (REPL)

| Command | Description |
|---------|-------------|
| `help [<command>]` | Display help |
| `exit` | Quit REPL |
| `pwd` | Show current API path |
| `ls [-l] [-a] [<path>]` | List endpoints |
| `cd <path>` | Navigate API tree |
| `cat <name>` | Show resource description |
| `describe [<path>]` | OpenAPI describe |
| `! <cmd>` | Execute local command |

## Related Specifications

| Story | Status |
|-------|--------|
| [CLI-CORE-SETUP-SPEC](../plans/CLI-CORE-SETUP-SPEC.md) | canonical |
| [CLI-CORE-COMMANDER-SPEC](../plans/CLI-CORE-COMMANDER-SPEC.md) | draft |

## Backlog

- [TODO_CLI_CORE.md](../../TODO_CLI_CORE.md)
