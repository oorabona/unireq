/**
 * Workspace configuration loader
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as v from 'valibot';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import { WorkspaceConfigError } from './errors.js';
import { versionCheckSchema, workspaceConfigSchema } from './schema.js';
import type { WorkspaceConfig } from './types.js';

/** Config file name */
export const CONFIG_FILE_NAME = 'workspace.yaml';

/**
 * Load and validate workspace configuration from a workspace directory
 *
 * @param workspacePath - Path to the .unireq workspace directory
 * @returns Parsed and validated WorkspaceConfig, or null if file doesn't exist
 * @throws WorkspaceConfigError if config is invalid
 */
export function loadWorkspaceConfig(workspacePath: string): WorkspaceConfig | null {
  const configPath = join(workspacePath, CONFIG_FILE_NAME);

  // Check if file exists
  if (!existsSync(configPath)) {
    return null;
  }

  // Read file contents
  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch (error) {
    throw WorkspaceConfigError.fileAccessError(configPath, error as Error);
  }

  // Handle empty file - treat as missing required version
  if (content.trim() === '') {
    throw new WorkspaceConfigError(
      "Validation error at 'version': Required field is missing. workspace.yaml must contain at least 'version: 1'",
      { fieldPath: 'version' },
    );
  }

  // Parse YAML
  let rawConfig: unknown;
  try {
    rawConfig = parseYaml(content);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const pos = error.linePos?.[0];
      throw WorkspaceConfigError.yamlSyntaxError(error.message, pos?.line, pos?.col, error);
    }
    throw WorkspaceConfigError.yamlSyntaxError((error as Error).message, undefined, undefined, error as Error);
  }

  // Handle case where YAML parses to null/undefined (empty or null document)
  if (rawConfig === null || rawConfig === undefined) {
    throw new WorkspaceConfigError(
      "Validation error at 'version': Required field is missing. workspace.yaml must contain at least 'version: 1'",
      { fieldPath: 'version' },
    );
  }

  // First check version separately to provide better error message
  const versionResult = v.safeParse(versionCheckSchema, rawConfig);
  if (versionResult.success) {
    const version = versionResult.output.version;
    if (version !== 1) {
      throw WorkspaceConfigError.unsupportedVersion(version);
    }
  }

  // Validate against full schema
  const result = v.safeParse(workspaceConfigSchema, rawConfig);
  if (!result.success) {
    const firstIssue = result.issues[0];
    const fieldPath = firstIssue?.path?.map((p) => p.key).join('.') || 'unknown';
    const message = firstIssue?.message || 'Invalid configuration';
    throw WorkspaceConfigError.schemaValidationError(fieldPath, message);
  }

  return result.output as WorkspaceConfig;
}

/**
 * Check if a workspace has a config file
 *
 * @param workspacePath - Path to the .unireq workspace directory
 * @returns true if workspace.yaml exists
 */
export function hasWorkspaceConfig(workspacePath: string): boolean {
  return existsSync(join(workspacePath, CONFIG_FILE_NAME));
}
