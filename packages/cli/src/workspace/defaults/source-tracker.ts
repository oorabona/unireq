/**
 * HTTP defaults resolution with source tracking
 */

import type { HttpDefaults, HttpMethodName, HttpOutputDefaults } from '../config/types.js';
import type { DefaultSource, ResolvedDefaults } from './types.js';

/**
 * Built-in defaults (hardcoded values)
 * These match the defaults in HTTP_OPTIONS from http-options.ts
 */
export const BUILT_IN_DEFAULTS: Required<HttpOutputDefaults> = {
  includeHeaders: false,
  outputMode: 'pretty',
  showSummary: false,
  trace: false,
  showSecrets: false,
  hideBody: false,
};

/**
 * Apply defaults from source with tracking
 */
function applyWithSource(
  resolved: ResolvedDefaults,
  source: HttpOutputDefaults | undefined,
  sourceName: DefaultSource,
): void {
  if (!source) return;

  if (source.includeHeaders !== undefined) {
    resolved.includeHeaders = { key: 'includeHeaders', value: source.includeHeaders, source: sourceName };
  }
  if (source.outputMode !== undefined) {
    resolved.outputMode = { key: 'outputMode', value: source.outputMode, source: sourceName };
  }
  if (source.showSummary !== undefined) {
    resolved.showSummary = { key: 'showSummary', value: source.showSummary, source: sourceName };
  }
  if (source.trace !== undefined) {
    resolved.trace = { key: 'trace', value: source.trace, source: sourceName };
  }
  if (source.showSecrets !== undefined) {
    resolved.showSecrets = { key: 'showSecrets', value: source.showSecrets, source: sourceName };
  }
  if (source.hideBody !== undefined) {
    resolved.hideBody = { key: 'hideBody', value: source.hideBody, source: sourceName };
  }
}

/**
 * Resolve HTTP defaults with source tracking
 *
 * Priority order (highest to lowest):
 * 1. Session overrides (ephemeral REPL override)
 * 2. Profile method-specific defaults
 * 3. Profile general defaults
 * 4. Workspace method-specific defaults
 * 5. Workspace general defaults
 * 6. Built-in defaults
 *
 * @param method - Optional HTTP method for method-specific resolution
 * @param workspaceDefaults - Workspace-level defaults from config
 * @param profileDefaults - Profile-level defaults from config
 * @param profileName - Active profile name (for source labeling)
 * @param sessionDefaults - Session-level overrides (REPL only)
 * @returns All defaults with their effective values and sources
 */
export function resolveDefaultsWithSource(
  method: HttpMethodName | undefined,
  workspaceDefaults?: HttpDefaults,
  profileDefaults?: HttpDefaults,
  profileName?: string,
  sessionDefaults?: HttpOutputDefaults,
): ResolvedDefaults {
  // Start with built-in defaults
  const resolved: ResolvedDefaults = {
    includeHeaders: { key: 'includeHeaders', value: BUILT_IN_DEFAULTS.includeHeaders, source: 'built-in' },
    outputMode: { key: 'outputMode', value: BUILT_IN_DEFAULTS.outputMode, source: 'built-in' },
    showSummary: { key: 'showSummary', value: BUILT_IN_DEFAULTS.showSummary, source: 'built-in' },
    trace: { key: 'trace', value: BUILT_IN_DEFAULTS.trace, source: 'built-in' },
    showSecrets: { key: 'showSecrets', value: BUILT_IN_DEFAULTS.showSecrets, source: 'built-in' },
    hideBody: { key: 'hideBody', value: BUILT_IN_DEFAULTS.hideBody, source: 'built-in' },
  };

  // Layer 1: Workspace general defaults
  applyWithSource(resolved, workspaceDefaults, 'workspace');

  // Layer 2: Workspace method-specific defaults
  if (method && workspaceDefaults?.[method]) {
    applyWithSource(resolved, workspaceDefaults[method], `workspace.${method}`);
  }

  // Layer 3: Profile general defaults
  if (profileDefaults && profileName) {
    applyWithSource(resolved, profileDefaults, `profile:${profileName}`);
  }

  // Layer 4: Profile method-specific defaults
  if (method && profileDefaults?.[method] && profileName) {
    applyWithSource(resolved, profileDefaults[method], `profile:${profileName}.${method}`);
  }

  // Layer 5: Session overrides (highest priority)
  if (sessionDefaults) {
    applyWithSource(resolved, sessionDefaults, 'session');
  }

  return resolved;
}

/**
 * Get the description of a source for display
 */
export function getSourceDescription(source: DefaultSource): string {
  if (source === 'built-in') {
    return 'Hardcoded default';
  }
  if (source === 'workspace') {
    return 'workspace.yaml \u2192 defaults';
  }
  if (source.startsWith('workspace.')) {
    const method = source.slice('workspace.'.length);
    return `workspace.yaml \u2192 defaults.${method}`;
  }
  if (source === 'session') {
    return 'Session override (ephemeral)';
  }
  if (source.startsWith('profile:')) {
    const rest = source.slice('profile:'.length);
    const dotIndex = rest.indexOf('.');
    if (dotIndex === -1) {
      return `workspace.yaml \u2192 profiles.${rest}.defaults`;
    }
    const profileName = rest.slice(0, dotIndex);
    const method = rest.slice(dotIndex + 1);
    return `workspace.yaml \u2192 profiles.${profileName}.defaults.${method}`;
  }
  return source;
}
