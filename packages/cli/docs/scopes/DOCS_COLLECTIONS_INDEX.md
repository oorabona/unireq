---
doc-meta:
  status: draft
  scope: collections
  type: reference
  created: 2025-12-31
  updated: 2025-12-31
---

# Collections Documentation Index

## Overview

Request collections and scenarios: saved requests (recipes), variable extraction, simple assertions, history management.

## Documents

| Document | Type | Status | Description |
|----------|------|--------|-------------|
| [Overview](../plans/COLLECTIONS-OVERVIEW.md) | design | draft | Scope overview and features |

## Key Commands

| Command | Description |
|---------|-------------|
| `unireq history [--tail <n>]` | Show command history |
| `unireq save <name>` | Save last request |
| `unireq run <name> [--var k=v]` | Execute saved request |

## REPL Commands

| Command | Description |
|---------|-------------|
| `history [--json]` | Show history |
| `rm [-r] <path>` | Remove saved artifacts |

## Collection Schema

```yaml
collections:
  - name: smoke
    description: Health checks
    items:
      - name: health
        request:
          method: GET
          path: /health
          assert:
            status: 200
```

## Features (V1)

- Save request as "recipe" (request template)
- Variables `${var}` + simple extraction (JSONPath-lite)
- Simple assertions: status, header, contains, equals

## Features (V2)

- Multi-step scenarios with dependencies
- Replay / proxy-mode
- Exports (markdown / junit / json)

## History Format (NDJSON)

```json
{"ts":"2025-12-29T01:23:45.123Z","kind":"cmd","text":"get /health","cwd":"/","workspace":"my-api"}
{"ts":"2025-12-29T01:23:45.456Z","kind":"http","method":"GET","url":"https://api.example.com/health","status":200,"durationMs":112}
```

## Related Specifications

| Story | Status |
|-------|--------|
| (none yet) | - |

## Backlog

- [TODO_COLLECTIONS.md](../../TODO_COLLECTIONS.md)
