---
doc-meta:
  status: draft
  scope: openapi
  type: reference
  created: 2025-12-31
  updated: 2025-12-31
---

# OpenAPI Documentation Index

## Overview

OpenAPI integration: import from file/URL, path indexation, autocompletion, endpoint discovery, input/output validation.

## Documents

| Document | Type | Status | Description |
|----------|------|--------|-------------|
| [Overview](../plans/OPENAPI-OVERVIEW.md) | design | draft | Scope overview and features |

## Features

### When OpenAPI is Present

- Import (file / URL)
- Path + method indexation
- REPL autocompletion
- `ls` on "folders" (tags, paths, resources)
- `describe` on endpoint (params, body, schemas)
- Light validation: basic types + required

### Fallback Without OpenAPI

- Navigation via "registered routes" (collections) + heuristics
- `unireq record on` (V2) to learn from executed requests

## Configuration

```yaml
openapi:
  source: https://api.example.com/openapi.json
  cache:
    enabled: true
    ttlMs: 86400000  # 24 hours
```

## Related Specifications

| Story | Status |
|-------|--------|
| (none yet) | - |

## Backlog

- [TODO_OPENAPI.md](../../TODO_OPENAPI.md)
