---
doc-meta:
  status: draft
  scope: cli-core
  type: design
  created: 2025-12-31
  updated: 2025-12-31
---

# CLI Core Overview

## Purpose

Core CLI and REPL functionality providing:
- Command-line argument parsing
- Interactive REPL session management
- Shell-like navigation commands (cd, ls, pwd)
- HTTP verb shortcuts (get, post, put, patch, delete)

## Key Features

### CLI Mode (One-shot)

- Single request execution
- Pipeline support for shell scripting
- CI-friendly output (stable, parseable)

### REPL Mode (Interactive)

- Persistent state (workspace, auth, variables)
- Filesystem-like API navigation
- Integrated help and autocompletion
- Command history with search
- Escape hatch for local commands (`! <cmd>`)

## Target Users

- Developers (API exploration, debugging)
- QA/Testers (E2E scenarios, assertions)
- DevOps/SRE (health checks, smoke tests)
- Integrators (SaaS APIs, cloud platforms)

## CLI Commands

```
unireq [-h] [--version]
unireq repl [-w <workspace>] [--no-color]
unireq request <METHOD> <URL> [options]
unireq get|post|put|patch|delete <URL> [options]
```

### Request Options

| Option | Description |
|--------|-------------|
| `-H, --header <k:v>` | Add header (repeatable) |
| `-q, --query <k=v>` | Add query param (repeatable) |
| `-b, --body <json\|@file>` | Request body |
| `-F, --form <k=v>` | Multipart form-data |
| `--timeout <ms>` | Request timeout |
| `--auth <name>` | Use auth provider |
| `--var <k=v>` | Inject variable |
| `--save <name>` | Save request to workspace |
| `--trace` | Show request/response details |
| `--raw` | Raw output |

## REPL Commands

### Navigation

| Command | Description |
|---------|-------------|
| `pwd` | Show current API path |
| `ls [-l] [-a] [<path>]` | List endpoints |
| `cd <path>` | Navigate (supports `..`, `/`, relative) |
| `cat <name>` | Show resource description |
| `describe [<path>]` | OpenAPI describe view |

### HTTP

| Command | Description |
|---------|-------------|
| `get [options] <path>` | GET request |
| `post [options] <path>` | POST request |
| `put [options] <path>` | PUT request |
| `patch [options] <path>` | PATCH request |
| `delete [options] <path>` | DELETE request |

### Session

| Command | Description |
|---------|-------------|
| `help [<command>]` | Show help |
| `exit` | Quit REPL |
| `history [--tail <n>]` | Show history |
| `! <cmd>` | Execute local command |

## Open Questions

- [ ] Exact readline/linenoise library choice
- [ ] Autocompletion strategy (sync vs async)
- [ ] History persistence format and search

## Next Steps

1. Run `/clarify cli-core` to detail requirements
2. Run `/spec cli-core-parser` for argument parsing
3. Run `/spec cli-core-repl` for REPL implementation
