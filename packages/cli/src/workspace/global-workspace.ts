/**
 * Global Workspace Auto-Creation (kubectl-like model)
 *
 * Automatically creates a minimal global workspace when no workspace exists.
 * This enables zero-friction onboarding - first command "just works".
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { consola } from 'consola';
import { stringify as stringifyYaml } from 'yaml';
import { findWorkspace } from './detection.js';
import { getGlobalWorkspacePath } from './paths.js';
import { loadRegistry } from './registry/loader.js';

/** Global workspace directory name */
export const GLOBAL_WORKSPACE_DIR = 'global';

/** Global workspace file name */
export const GLOBAL_WORKSPACE_FILE = 'workspace.yaml';

/** Reserved name for the auto-created global workspace in registry */
export const GLOBAL_WORKSPACE_NAME = 'global';

/**
 * Get the path to the global workspace directory
 *
 * @returns Path to ~/.config/unireq/global/, or null if unavailable
 */
export function getGlobalWorkspaceDir(): string | null {
  const globalPath = getGlobalWorkspacePath();
  if (!globalPath) {
    return null;
  }
  return join(globalPath, GLOBAL_WORKSPACE_DIR);
}

/**
 * Get the path to the global workspace.yaml file
 *
 * @returns Path to ~/.config/unireq/global/workspace.yaml, or null if unavailable
 */
export function getGlobalWorkspaceFile(): string | null {
  const globalDir = getGlobalWorkspaceDir();
  if (!globalDir) {
    return null;
  }
  return join(globalDir, GLOBAL_WORKSPACE_FILE);
}

/**
 * Check if global workspace exists
 *
 * @returns true if ~/.config/unireq/global/workspace.yaml exists
 */
export function globalWorkspaceExists(): boolean {
  const filePath = getGlobalWorkspaceFile();
  if (!filePath) {
    return false;
  }
  return existsSync(filePath);
}

/**
 * Check if any workspace is available (local, registered, or global)
 *
 * @returns true if any workspace exists
 */
export function hasAnyWorkspace(): boolean {
  // Check for local .unireq/ workspace
  const localWorkspace = findWorkspace();
  if (localWorkspace) {
    return true;
  }

  // Check for registered workspaces
  const registry = loadRegistry();
  if (Object.keys(registry.workspaces).length > 0) {
    return true;
  }

  // Check for global workspace
  if (globalWorkspaceExists()) {
    return true;
  }

  return false;
}

/**
 * Create the minimal global workspace
 *
 * Creates ~/.config/unireq/global/workspace.yaml with minimal content.
 *
 * @returns true if created, false if skipped (already exists or error)
 */
export function createGlobalWorkspace(): boolean {
  const filePath = getGlobalWorkspaceFile();

  // Can't determine path (no HOME)
  if (!filePath) {
    return false;
  }

  // Already exists
  if (existsSync(filePath)) {
    return false;
  }

  // Create minimal workspace config
  // Note: version: 2 is required by WorkspaceConfig schema
  const config = {
    version: 2,
    name: GLOBAL_WORKSPACE_NAME,
  };

  try {
    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write workspace.yaml
    const yamlContent = stringifyYaml(config);
    writeFileSync(filePath, yamlContent, 'utf-8');
    return true;
  } catch (error) {
    // Log warning but don't fail - workspace features are optional
    consola.warn(`Cannot create global workspace: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Ensure a workspace exists for HTTP commands
 *
 * If no workspace is available (local, registered, or global), auto-creates
 * the global workspace. This is the main entry point for kubectl-like behavior.
 *
 * Call this at the start of any HTTP command to ensure workspace features work.
 *
 * @returns Object indicating what happened
 */
export function ensureWorkspaceExists(): {
  hasWorkspace: boolean;
  created: boolean;
  path: string | null;
} {
  // First check if any workspace already exists
  if (hasAnyWorkspace()) {
    // Return the first available workspace path for context
    const local = findWorkspace();
    if (local) {
      return { hasWorkspace: true, created: false, path: local.path };
    }

    // Check global workspace
    const globalPath = getGlobalWorkspaceFile();
    if (globalPath && existsSync(globalPath)) {
      return { hasWorkspace: true, created: false, path: dirname(globalPath) };
    }

    // Has registered workspaces
    return { hasWorkspace: true, created: false, path: null };
  }

  // No workspace exists - try to create global workspace
  const created = createGlobalWorkspace();
  const globalDir = getGlobalWorkspaceDir();

  return {
    hasWorkspace: created,
    created,
    path: created && globalDir ? globalDir : null,
  };
}
