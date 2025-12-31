---
doc-meta:
  status: canonical
  scope: openapi
  type: specification
  created: 2025-12-31
  updated: 2025-12-31
---

# Specification: OpenAPI Navigation Tree (Task 3.2)

## 1. User Stories

### US-1: Build Navigation Tree

**AS A** developer with a loaded OpenAPI spec
**I WANT** a tree structure representing API paths
**SO THAT** I can navigate endpoints like a filesystem

**ACCEPTANCE:** `buildNavigationTree(spec)` returns a tree with paths as nodes

### US-2: Handle Path Parameters

**AS A** developer navigating to `/users/{id}`
**I WANT** `{id}` to be a navigable child node
**SO THAT** I can explore parameterized endpoints

**ACCEPTANCE:** Path parameters become child nodes with `isParameter: true`

### US-3: List Available Methods

**AS A** developer at a path like `/users`
**I WANT** to see which HTTP methods are available
**SO THAT** I can know what operations I can perform

**ACCEPTANCE:** Each path node has `methods: ['GET', 'POST', ...]`

---

## 2. Business Rules

### Tree Structure

| Path | Tree Representation |
|------|---------------------|
| `/users` | root → users (methods: GET, POST) |
| `/users/{id}` | root → users → {id} (methods: GET, PUT, DELETE) |
| `/users/{id}/posts` | root → users → {id} → posts |

### Path Parameter Handling

- Parameters like `{id}`, `{userId}` become child nodes
- Node property `isParameter: true` distinguishes them
- Display with braces preserved: `{id}`

### Method Detection

HTTP methods detected: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, TRACE

---

## 3. Technical Design

### Types

```typescript
interface NavigationNode {
  name: string;           // Segment name ('users', '{id}')
  path: string;           // Full path ('/users/{id}')
  isParameter: boolean;   // True for {param} segments
  methods: HttpMethod[];  // Available HTTP methods
  children: Map<string, NavigationNode>;
  operation?: {           // For leaf operations
    summary?: string;
    description?: string;
    operationId?: string;
  };
}

interface NavigationTree {
  root: NavigationNode;
  getNode(path: string): NavigationNode | undefined;
  listChildren(path: string): NavigationNode[];
  getMethods(path: string): HttpMethod[];
}
```

### Functions

```typescript
// Build tree from spec
function buildNavigationTree(spec: LoadedSpec): NavigationTree;

// List children at path
function listChildren(tree: NavigationTree, path: string): NavigationNode[];

// Get methods at path
function getMethods(tree: NavigationTree, path: string): HttpMethod[];

// Check if path exists
function pathExists(tree: NavigationTree, path: string): boolean;
```

---

## 4. Acceptance Criteria (BDD)

### Scenario 1: Build tree from simple paths
```gherkin
Given an OpenAPI spec with paths ["/users", "/users/{id}"]
When buildNavigationTree is called
Then root has child "users"
And "users" has child "{id}"
```

### Scenario 2: Detect methods at path
```gherkin
Given path "/users" has GET and POST operations
When getMethods("/users") is called
Then result is ["GET", "POST"]
```

### Scenario 3: Handle nested parameters
```gherkin
Given paths ["/orgs/{orgId}/members/{memberId}"]
When tree is built
Then structure is root → orgs → {orgId} → members → {memberId}
And {orgId} has isParameter: true
```

### Scenario 4: List children at path
```gherkin
Given tree with "/users", "/users/{id}", "/users/{id}/posts"
When listChildren("/users") is called
Then result contains "{id}" node
```

### Scenario 5: Empty spec
```gherkin
Given an OpenAPI spec with no paths
When buildNavigationTree is called
Then root node has empty children
```

### Scenario 6: Root path operations
```gherkin
Given path "/" has GET operation
When getMethods("/") is called
Then result is ["GET"]
```

---

## 5. Implementation Plan

### Block 1: Types and Tree Builder
- Define NavigationNode and NavigationTree types
- Implement `buildNavigationTree(spec)`
- Unit tests for tree building

### Block 2: Query Functions
- Implement `getNode()`, `listChildren()`, `getMethods()`
- Implement `pathExists()`
- Unit tests for queries

### Block 3: Integration with REPL
- Update `lsHandler` to use tree
- Add spec to REPL state
- Integration tests

---

## 6. Test Strategy

| Scenario | Unit | Integration |
|----------|------|-------------|
| Build tree | Yes | - |
| Path parameters | Yes | - |
| Method detection | Yes | - |
| Query functions | Yes | - |
| ls command | - | Yes |

---

## Definition of Done

- [ ] All BDD scenarios have passing tests
- [ ] Tree builds correctly from real OpenAPI specs
- [ ] `ls` command shows tree contents
- [ ] All tests pass
- [ ] Documentation updated
