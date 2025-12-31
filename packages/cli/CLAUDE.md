# @unireq/cli - Claude Context

## Package Overview

HTTP CLI client with REPL mode for API exploration and testing.

**Status:** Design phase (docs/plans/)

## Documentation Structure

```
packages/cli/
├── docs/
│   ├── DOCUMENTATION_INDEX.md   # Main index
│   ├── scopes/                  # Per-scope indexes + backlogs
│   │   ├── DOCS_*_INDEX.md      # 7 scope indexes
│   │   └── TODO_*.md            # 7 scope backlogs
│   ├── plans/                   # Design documents
│   │   └── *-OVERVIEW.md        # 7 overview docs
│   └── historic/                # Archived docs
├── TODO.md                      # Main backlog (source of truth)
└── src/                         # Implementation (TBD)
```

## Scopes

| Scope | Description |
|-------|-------------|
| cli-core | Entry point, REPL, command execution |
| workspace | Project config, profiles, variables |
| openapi | Spec loading, navigation, validation |
| auth | Authentication providers, injection |
| collections | Saved requests, assertions, history |
| secrets | Vault, keychain, secure storage |
| output | Formatting, highlighting, export |

## Key Commands (Planned)

```bash
# One-shot mode
unireq get https://api.example.com/users
unireq post /users -d '{"name":"Alice"}'

# REPL mode
unireq
> cd /users
> ls
> get {id}
```

## Dependencies

- `@unireq/http` - HTTP client core
- `commander` - CLI parsing
- `yaml` - Config parsing
- `chalk` - Terminal colors

## Workflow

1. Check `TODO.md` for current tasks
2. Run `/clarify <scope>` before implementation
3. Run `/spec <feature>` for specifications
4. Run `/implement` with quality gates
5. Run `/review` after implementation

## Doc-Meta System

All docs use front-matter:

```yaml
---
doc-meta:
  status: draft|wip|canonical|deprecated|archived
  scope: cli-core|workspace|openapi|auth|collections|secrets|output
  type: design|spec|guide|reference
---
```
