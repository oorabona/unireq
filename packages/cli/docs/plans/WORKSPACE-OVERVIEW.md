---
doc-meta:
  status: draft
  scope: workspace
  type: design
  created: 2025-12-31
  updated: 2025-12-31
---

# Workspace Overview

## Purpose

Workspace management providing:
- Project-level configuration (baseUrl, headers, timeouts)
- Local and global scope support
- Profile management for different environments
- Variable persistence and interpolation

## Key Features

### Workspace Concept

A workspace is a context for targeting an API:
- `baseUrl` - API base URL
- `openapi` - OpenAPI spec reference
- `auth` - Authentication configuration
- `profiles` - Environment profiles (dev, staging, prod)
- `vars` - Persistent variables
- `collections` - Saved requests

### Scope

| Scope | Location | Use Case |
|-------|----------|----------|
| Local | `.unireq/` in project | Per-project config |
| Global | OS config directory | Shared workspaces |

### Behavior

1. If workspace exists in cwd → use it
2. Else CLI works stateless (one-shot)
3. `unireq workspace init` creates new workspace

## Target Users

- Developers working on specific API projects
- Teams sharing workspace configs via git
- Users with multiple API targets

## Commands

```
unireq workspace init [-n <name>] [--openapi <path|url>]
unireq workspace list [--global]
unireq workspace use <name|path>
unireq workspace doctor [-w <name|path>]
```

## File Structure

```
.unireq/
├── workspace.yaml      # Main configuration
├── collections/        # Saved request collections
│   └── smoke.yaml
├── history.ndjson      # Command history
└── cache/              # OpenAPI cache, temp files
```

## Configuration Schema (workspace.yaml)

```yaml
version: 1
name: my-api
baseUrl: https://api.example.com

openapi:
  source: https://api.example.com/openapi.json
  cache:
    enabled: true
    ttlMs: 86400000

profiles:
  default:
    headers:
      User-Agent: unireq
    timeoutMs: 30000
    verifyTls: true

auth:
  active: main
  providers:
    main: { ... }

vars:
  tenantId: "demo"
```

## OS-Specific Paths

| OS | Config | Data/Cache |
|----|--------|------------|
| Linux | `$XDG_CONFIG_HOME/unireq` | `$XDG_DATA_HOME/unireq` |
| macOS | `~/Library/Preferences/unireq` | `~/Library/Application Support/unireq` |
| Windows | `%APPDATA%\unireq` | `%LOCALAPPDATA%\unireq` |

## Open Questions

- [ ] Workspace inheritance/overlay strategy
- [ ] Git-friendly secrets handling
- [ ] Profile switching in REPL

## Next Steps

1. Run `/clarify workspace` to detail requirements
2. Run `/spec workspace-init` for initialization flow
3. Run `/spec workspace-resolution` for path resolution logic
