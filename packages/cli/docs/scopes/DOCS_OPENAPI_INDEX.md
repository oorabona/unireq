---
doc-meta:
  status: canonical
  scope: openapi
  type: reference
  created: 2025-12-31
  updated: 2026-01-02
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

| Story | Spec | Status |
|-------|------|--------|
| Task 3.1 | [OPENAPI-SPEC-LOADER-SPEC](../plans/OPENAPI-SPEC-LOADER-SPEC.md) | canonical |
| Task 3.2 | [OPENAPI-NAVIGATION-TREE-SPEC](../plans/OPENAPI-NAVIGATION-TREE-SPEC.md) | canonical |
| Task 3.5 | [OPENAPI-DESCRIBE-COMMAND-SPEC](../plans/OPENAPI-DESCRIBE-COMMAND-SPEC.md) | canonical |
| Task 3.6 | [OPENAPI-INPUT-VALIDATION-SPEC](../plans/OPENAPI-INPUT-VALIDATION-SPEC.md) | canonical |
| Task 3.7 | [SWAGGER-2.0-CONVERSION-SPEC](../plans/SWAGGER-2.0-CONVERSION-SPEC.md) | canonical |
| Task 3.8 | [OPENAPI-SPEC-CACHING-SPEC](../plans/OPENAPI-SPEC-CACHING-SPEC.md) | canonical |
| Task 3.9 | [OPENAPI-STATE-LOADING-SPEC](../plans/OPENAPI-STATE-LOADING-SPEC.md) | canonical |

## Backlog

- [TODO_OPENAPI.md](TODO_OPENAPI.md)
