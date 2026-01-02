/**
 * Workspace registry loader (kubectl-inspired model)
 *
 * Handles loading/saving the registry.yaml file which stores
 * the index of ALL known workspaces (local + global).
 *
 * Note: active workspace/profile is now stored in config.yaml (GlobalConfig)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as v from 'valibot';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { WorkspaceLocation } from '../config/types.js';
import { getGlobalWorkspacePath } from '../paths.js';
import { registryConfigSchema, registryVersionCheckSchema } from './schema.js';
import type { RegistryConfig, WorkspaceEntry } from './types.js';

/** Registry file name */
export const REGISTRY_FILE_NAME = 'registry.yaml';

/**
 * Error thrown for registry-related issues
 */
export class RegistryError extends Error {
  constructor(
    message: string,
    public readonly code: 'FILE_ACCESS' | 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'UNSUPPORTED_VERSION',
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}

/**
 * Get the path to the registry file
 *
 * @returns Path to registry.yaml, or null if global path unavailable
 */
export function getRegistryPath(): string | null {
  const globalPath = getGlobalWorkspacePath();
  if (!globalPath) {
    return null;
  }
  // Registry is at ~/.config/unireq/registry.yaml (parent of workspaces/)
  return join(dirname(globalPath), REGISTRY_FILE_NAME);
}

/**
 * Create an empty registry config
 */
export function createEmptyRegistry(): RegistryConfig {
  return {
    version: 1,
    workspaces: {},
  };
}

/**
 * Load the workspace registry
 *
 * @returns RegistryConfig, or empty registry if file doesn't exist
 * @throws RegistryError if file exists but is invalid
 */
export function loadRegistry(): RegistryConfig {
  const registryPath = getRegistryPath();

  // If we can't determine the registry path, return empty
  if (!registryPath) {
    return createEmptyRegistry();
  }

  // If file doesn't exist, return empty registry
  if (!existsSync(registryPath)) {
    return createEmptyRegistry();
  }

  // Read file
  let content: string;
  try {
    content = readFileSync(registryPath, 'utf-8');
  } catch (error) {
    throw new RegistryError(
      `Failed to read registry file: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_ACCESS',
    );
  }

  // Handle empty file
  if (content.trim() === '') {
    return createEmptyRegistry();
  }

  // Parse YAML
  let rawConfig: unknown;
  try {
    rawConfig = parseYaml(content);
  } catch (error) {
    throw new RegistryError(
      `Failed to parse registry YAML: ${error instanceof Error ? error.message : String(error)}`,
      'PARSE_ERROR',
    );
  }

  // Handle null/undefined
  if (rawConfig === null || rawConfig === undefined) {
    return createEmptyRegistry();
  }

  // Check version
  const versionResult = v.safeParse(registryVersionCheckSchema, rawConfig);
  if (versionResult.success && versionResult.output.version !== 1) {
    throw new RegistryError(
      `Unsupported registry version: ${versionResult.output.version}. Expected version 1.`,
      'UNSUPPORTED_VERSION',
    );
  }

  // Validate schema
  const result = v.safeParse(registryConfigSchema, rawConfig);
  if (!result.success) {
    const firstIssue = result.issues[0];
    const fieldPath = firstIssue?.path?.map((p) => p.key).join('.') || 'unknown';
    throw new RegistryError(`Invalid registry: ${fieldPath} - ${firstIssue?.message}`, 'VALIDATION_ERROR');
  }

  return result.output as RegistryConfig;
}

/**
 * Save the workspace registry
 *
 * @param config - Registry config to save
 * @throws RegistryError if save fails
 */
export function saveRegistry(config: RegistryConfig): void {
  const registryPath = getRegistryPath();

  if (!registryPath) {
    throw new RegistryError('Cannot determine registry path: HOME directory not set', 'FILE_ACCESS');
  }

  // Ensure directory exists
  const dir = dirname(registryPath);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error) {
      throw new RegistryError(
        `Failed to create registry directory: ${error instanceof Error ? error.message : String(error)}`,
        'FILE_ACCESS',
      );
    }
  }

  // Write file
  try {
    const yamlContent = stringifyYaml(config);
    writeFileSync(registryPath, yamlContent, 'utf-8');
  } catch (error) {
    throw new RegistryError(
      `Failed to write registry file: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_ACCESS',
    );
  }
}

/**
 * Add a workspace to the registry
 *
 * @param name - Workspace name
 * @param path - Path to workspace directory
 * @param location - Location type ('local' or 'global')
 * @param description - Optional description
 * @returns Updated registry config
 */
export function addWorkspace(
  name: string,
  path: string,
  location: WorkspaceLocation,
  description?: string,
): RegistryConfig {
  const config = loadRegistry();

  config.workspaces[name] = {
    path,
    location,
    ...(description && { description }),
  };

  saveRegistry(config);
  return config;
}

/**
 * Remove a workspace from the registry
 *
 * @param name - Workspace name to remove
 * @returns true if removed, false if not found
 */
export function removeWorkspace(name: string): boolean {
  const config = loadRegistry();

  if (!(name in config.workspaces)) {
    return false;
  }

  delete config.workspaces[name];
  saveRegistry(config);
  return true;
}

/**
 * Get a workspace by name
 *
 * @param name - Workspace name
 * @returns WorkspaceEntry or undefined
 */
export function getWorkspace(name: string): WorkspaceEntry | undefined {
  const config = loadRegistry();
  return config.workspaces[name];
}

/**
 * Check if a workspace exists in the registry
 *
 * @param name - Workspace name
 * @returns true if exists
 */
export function hasWorkspace(name: string): boolean {
  const config = loadRegistry();
  return name in config.workspaces;
}

/**
 * List all workspaces in the registry
 *
 * @returns Array of [name, entry] tuples
 */
export function listWorkspaces(): Array<[string, WorkspaceEntry]> {
  const config = loadRegistry();
  return Object.entries(config.workspaces);
}
