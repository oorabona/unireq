---
doc-meta:
  status: canonical
  scope: cli-core
  type: spec
  created: 2026-01-07
---

# CLI-CORE: Inspector Enhancements Spec

## Overview

Enhance the Inspector modal with:
1. **Always-on timing capture** - Show TTFB, download, total without `--trace`
2. **Persistent history** - Load history from NDJSON file in HistoryPicker
3. **History navigation** - Browse past requests in Inspector with ←/→

## Architecture

### Current Flow
```
HTTP Command → executor.ts → timing() only if --trace → response
                                                          ↓
                                              App.tsx → InspectorModal
```

### New Flow
```
HTTP Command → executor.ts → timing() ALWAYS → response with timing
                                                    ↓
App.tsx → InspectorModal ←→ HistoryReader (NDJSON)
              ↓
    [T] Timing tab + ←/→ navigation
```

## BDD Scenarios

### Feature 1: Always-On Timing

```gherkin
Scenario: Timing captured without --trace flag
  Given the user has not used --trace flag
  When the user executes "get https://example.com"
  Then the response should include timing information
  And the timing should have ttfb, download, and total values

Scenario: Timing displayed in Inspector
  Given a request has been executed
  When the user opens Inspector (Ctrl+O)
  Then the Inspector should show timing information
  And pressing [T] should show detailed timing breakdown

Scenario: --trace still outputs to console
  Given the user executes "get https://example.com --trace"
  Then timing should be displayed in console output
  And timing should also be available in Inspector
```

### Feature 2: Persistent History in HistoryPicker

```gherkin
Scenario: History loaded from NDJSON file
  Given the history file contains previous HTTP requests
  When the user opens HistoryPicker (Ctrl+H)
  Then requests from previous sessions should be visible
  And entries should be ordered most recent first

Scenario: Empty history file
  Given the history file does not exist
  When the user opens HistoryPicker
  Then "No history" message should be displayed

Scenario: History survives restart
  Given the user made HTTP requests in a previous session
  When the user starts a new REPL session
  And opens HistoryPicker
  Then previous requests should be visible
```

### Feature 3: Inspector History Navigation

```gherkin
Scenario: Navigate to previous request
  Given the Inspector is open showing request at index 0
  And there are 5 requests in history
  When the user presses left arrow (←)
  Then the Inspector should show request at index 1
  And position indicator should show "2/5"

Scenario: Navigate to next request
  Given the Inspector is showing request at index 2
  When the user presses right arrow (→)
  Then the Inspector should show request at index 1
  And position indicator should show "2/5"

Scenario: Boundary - first request
  Given the Inspector is showing request at index 0 (most recent)
  When the user presses right arrow (→)
  Then nothing should happen (stay at index 0)

Scenario: Boundary - last request
  Given the Inspector is showing the oldest request (index N-1)
  When the user presses left arrow (←)
  Then nothing should happen (stay at index N-1)

Scenario: No history available
  Given no HTTP requests have been made
  When the user tries to open Inspector
  Then Inspector should not open (no response to show)
```

## Implementation Plan

### Block 1: Timing Infrastructure (executor + types)

**Files:**
- `packages/cli/src/executor.ts`
- `packages/cli/src/ui/state/types.ts`
- `packages/cli/src/ui/components/InspectorModal.tsx`

**Changes:**
1. Always add `timing()` policy in executeRequest (remove conditional)
2. Add `TimingInfo` to `ExecuteResult` interface
3. Return timing data from executeRequest
4. Update `LastResponse` to include timing details
5. Update `InspectorResponse` to include timing details

**Tests:**
- Unit: timing always captured
- Unit: timing values populated correctly

### Block 2: Inspector Timing Tab

**Files:**
- `packages/cli/src/ui/components/InspectorModal.tsx`

**Changes:**
1. Add 'timing' to `InspectorTab` type
2. Add [T] Timing tab in tab bar
3. Format timing display (TTFB bar, download bar, total)
4. Reuse formatting from `output/trace.ts`

**Tests:**
- Unit: timing tab renders
- Unit: timing values formatted correctly
- Unit: tab switching works

### Block 3: Persistent HistoryPicker

**Files:**
- `packages/cli/src/ui/components/HistoryPicker.tsx`
- `packages/cli/src/ui/App.tsx`

**Changes:**
1. Accept `historyReader?: HistoryReader` prop
2. Load history on mount (async)
3. Convert `HistoryEntry` to `HistoryItem`
4. Show loading state
5. Pass historyReader from App.tsx

**Tests:**
- Unit: history loads from reader
- Unit: empty history handled
- Unit: loading state shown

### Block 4: Inspector History Navigation

**Files:**
- `packages/cli/src/ui/components/InspectorModal.tsx`
- `packages/cli/src/ui/App.tsx`
- `packages/cli/src/ui/state/reducer.ts`

**Changes:**
1. Add `historyIndex` and `historyEntries` to InspectorModal props
2. Add ←/→ key handlers
3. Add position indicator UI ("1/15")
4. Add callbacks for navigation (onPrevious, onNext)
5. Load history entries in App.tsx
6. Track current history index in state

**Tests:**
- Unit: left arrow navigates to older
- Unit: right arrow navigates to newer
- Unit: boundaries respected
- Unit: position indicator updates

### Block 5: Integration & E2E

**Tests:**
- Integration: full flow timing capture
- Integration: full flow history loading
- E2E: Inspector with timing
- E2E: history navigation

## Type Changes

### ExecuteResult (executor.ts)
```typescript
export interface ExecuteResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timing?: TimingInfo; // NEW
}
```

### LastResponse (types.ts)
```typescript
export interface LastResponse {
  status: number;
  statusText: string;
  headers: HttpHeaders;
  body: string;
  timing?: TimingInfo; // CHANGE: from number to TimingInfo
  size: number;
  method?: string; // NEW
  url?: string; // NEW
}
```

### InspectorModalProps
```typescript
export interface InspectorModalProps {
  response: InspectorResponse;
  onClose: () => void;
  maxHeight?: number;
  // NEW for history navigation:
  historyIndex?: number;
  historyTotal?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}
```

## Dependencies

- `@unireq/http` - TimingInfo type
- `HistoryReader` - history loading

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Async history loading delays UI | Show loading state, don't block |
| Large history file | HistoryReader already limits to 1000 entries |
| Timing adds overhead | Tested: ~0.5µs/request - negligible |
