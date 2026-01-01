---
doc-meta:
  status: canonical
  scope: project
  type: reference
  created: 2025-12-31
  updated: 2025-12-31
---

# Unireq CLI Documentation Index

## Project: @unireq/cli

**Vision:** Rendre l'exploration, le debug et les tests E2E d'APIs aussi rapides et "mécaniques" que naviguer dans un shell.

**Binary:** `unireq`

## Quick Links

| Category | Document | Status |
|----------|----------|--------|
| Project | [Main Backlog](../TODO.md) | active |
| PRD | [Original PRD](../PRD.md) | reference |

## By Scope

| Scope | Index | Overview | Backlog | Description |
|-------|-------|----------|---------|-------------|
| cli-core | [Index](scopes/DOCS_CLI_CORE_INDEX.md) | [Overview](plans/CLI_CORE-OVERVIEW.md) | [TODO](../TODO_CLI_CORE.md) | CLI parser, REPL engine, shell commands |
| workspace | [Index](scopes/DOCS_WORKSPACE_INDEX.md) | [Overview](plans/WORKSPACE-OVERVIEW.md) | [TODO](../TODO_WORKSPACE.md) | Local/global workspace management |
| openapi | [Index](scopes/DOCS_OPENAPI_INDEX.md) | [Overview](plans/OPENAPI-OVERVIEW.md) | [TODO](../TODO_OPENAPI.md) | OpenAPI import, indexation, describe |
| auth | [Index](scopes/DOCS_AUTH_INDEX.md) | [Overview](plans/AUTH-OVERVIEW.md) | [TODO](../TODO_AUTH.md) | Auth providers (API key, Bearer, JWT, OAuth2) |
| collections | [Index](scopes/DOCS_COLLECTIONS_INDEX.md) | [Overview](plans/COLLECTIONS-OVERVIEW.md) | [TODO](../TODO_COLLECTIONS.md) | Saved requests, scenarios, assertions |
| secrets | [Index](scopes/DOCS_SECRETS_INDEX.md) | [Overview](plans/SECRETS-OVERVIEW.md) | [TODO](../TODO_SECRETS.md) | OS keychain, encrypted vault |
| output | [Index](scopes/DOCS_OUTPUT_INDEX.md) | [Overview](plans/OUTPUT-OVERVIEW.md) | [TODO](../TODO_OUTPUT.md) | Pretty print, --raw, --trace, --curl |

## Active Specifications

| Story | Spec | Status |
|-------|------|--------|
| Task 1.3 | [CLI-CORE-REPL-FOUNDATION-SPEC](plans/CLI-CORE-REPL-FOUNDATION-SPEC.md) | canonical |
| Task 1.4 | [CLI-CORE-REQUEST-EXEC-SPEC](plans/CLI-CORE-REQUEST-EXEC-SPEC.md) | canonical |
| Task 1.5 | [CLI-CORE-COMMAND-PARSING-SPEC](plans/CLI-CORE-COMMAND-PARSING-SPEC.md) | canonical |
| Task 7.1+7.2 | [CLI-OUTPUT-FORMATTING-SPEC](plans/CLI-OUTPUT-FORMATTING-SPEC.md) | canonical |
| Task 2.1 | [WORKSPACE-DETECTION-SPEC](plans/WORKSPACE-DETECTION-SPEC.md) | canonical |
| Task 2.2 | [WORKSPACE-CONFIG-SPEC](plans/WORKSPACE-CONFIG-SPEC.md) | canonical |
| Task 2.3 | [WORKSPACE-PROFILE-MANAGEMENT-SPEC](plans/WORKSPACE-PROFILE-MANAGEMENT-SPEC.md) | canonical |
| Task 2.4 | [WORKSPACE-VARIABLES-SPEC](plans/WORKSPACE-VARIABLES-SPEC.md) | canonical |
| Task 3.1 | [OPENAPI-SPEC-LOADER-SPEC](plans/OPENAPI-SPEC-LOADER-SPEC.md) | canonical |
| Task 3.2 | [OPENAPI-NAVIGATION-TREE-SPEC](plans/OPENAPI-NAVIGATION-TREE-SPEC.md) | canonical |
| Task 3.5 | [OPENAPI-DESCRIBE-COMMAND-SPEC](plans/OPENAPI-DESCRIBE-COMMAND-SPEC.md) | canonical |
| Task 4.1 | [AUTH-PROVIDER-MODEL-SPEC](plans/AUTH-PROVIDER-MODEL-SPEC.md) | canonical |
| Task 4.2 | [AUTH-API-KEY-PROVIDER-SPEC](plans/AUTH-API-KEY-PROVIDER-SPEC.md) | canonical |
| Task 7.3 | [OUTPUT-SYNTAX-HIGHLIGHTING-SPEC](plans/OUTPUT-SYNTAX-HIGHLIGHTING-SPEC.md) | draft |

## V1 vs V2 Scope

### V1 (MVP)

- CLI one-shot + REPL
- Workspace local + global
- Import OpenAPI (file/URL)
- Navigation cd/ls/pwd + describe
- Auth: apiKey/bearer/login→jwt/oauth2-client-credentials
- Secrets: keychain + encrypted vault fallback
- Variables + simple extraction
- Simple assertions
- History + save/run

### V2 (Advanced)

- Proxy/replay mode
- OAuth2 PKCE / refresh / device code
- Learning without OpenAPI (record + heuristics)
- Vendor schemas registry plugins
- CI reports (junit/json)

## Archived

See [docs/historic/](historic/) for deprecated documentation.
