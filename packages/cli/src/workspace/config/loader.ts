/**
 * Workspace configuration loader
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { consola } from 'consola';
import * as v from 'valibot';
import { parse as parseYaml, stringify as stringifyYaml, YAMLParseError } from 'yaml';
import { WorkspaceConfigError } from './errors.js';
import { versionCheckSchema, workspaceConfigSchema } from './schema.js';
import type { WorkspaceConfig } from './types.js';

/** Known keys for HttpOutputDefaults (base defaults) */
const KNOWN_OUTPUT_DEFAULT_KEYS = new Set([
  'includeHeaders',
  'outputMode',
  'showSummary',
  'trace',
  'showSecrets',
  'hideBody',
]);

/** Known HTTP method keys for method-specific defaults */
const KNOWN_METHOD_KEYS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

/** All known keys in HttpDefaults (output keys + method keys) */
const KNOWN_DEFAULTS_KEYS = new Set([...KNOWN_OUTPUT_DEFAULT_KEYS, ...KNOWN_METHOD_KEYS]);

/**
 * Check for unknown keys in a defaults object and log warnings
 * @param defaults - The defaults object to check
 * @param path - The path prefix for warning messages (e.g., "defaults" or "profiles.dev.defaults")
 */
function warnUnknownDefaultsKeys(defaults: unknown, path: string): void {
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
    return;
  }

  const obj = defaults as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!KNOWN_DEFAULTS_KEYS.has(key)) {
      consola.warn(`Unknown field '${key}' in ${path} will be ignored`);
    } else if (KNOWN_METHOD_KEYS.has(key)) {
      // Check method-specific defaults for unknown keys
      const methodDefaults = obj[key];
      if (methodDefaults && typeof methodDefaults === 'object' && !Array.isArray(methodDefaults)) {
        const methodObj = methodDefaults as Record<string, unknown>;
        for (const methodKey of Object.keys(methodObj)) {
          if (!KNOWN_OUTPUT_DEFAULT_KEYS.has(methodKey)) {
            consola.warn(`Unknown field '${methodKey}' in ${path}.${key} will be ignored`);
          }
        }
      }
    }
  }
}

/**
 * Check for unknown defaults keys in workspace config and log warnings
 * @param rawConfig - The raw parsed config object
 */
function checkUnknownDefaultsKeys(rawConfig: unknown): void {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return;
  }

  const config = rawConfig as Record<string, unknown>;

  // Check workspace-level defaults
  if (config['defaults']) {
    warnUnknownDefaultsKeys(config['defaults'], 'defaults');
  }

  // Check profile-level defaults
  if (config['profiles'] && typeof config['profiles'] === 'object' && !Array.isArray(config['profiles'])) {
    const profiles = config['profiles'] as Record<string, unknown>;
    for (const [profileName, profile] of Object.entries(profiles)) {
      if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
        const profileObj = profile as Record<string, unknown>;
        if (profileObj['defaults']) {
          warnUnknownDefaultsKeys(profileObj['defaults'], `profiles.${profileName}.defaults`);
        }
      }
    }
  }
}

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
      "Validation error at 'version': Required field is missing. workspace.yaml must contain at least 'version: 2'",
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
      "Validation error at 'version': Required field is missing. workspace.yaml must contain at least 'version: 2'",
      { fieldPath: 'version' },
    );
  }

  // First check version separately to provide better error message
  const versionResult = v.safeParse(versionCheckSchema, rawConfig);
  if (versionResult.success) {
    const version = versionResult.output.version;
    if (version !== 2) {
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

  // Check for unknown defaults keys and warn (forward compatibility)
  checkUnknownDefaultsKeys(rawConfig);

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

/**
 * Save workspace configuration to a workspace directory
 *
 * @param workspacePath - Path to the .unireq workspace directory
 * @param config - The configuration to save
 * @throws WorkspaceConfigError if save fails
 */
export function saveWorkspaceConfig(workspacePath: string, config: WorkspaceConfig): void {
  const configPath = join(workspacePath, CONFIG_FILE_NAME);

  try {
    const yamlContent = stringifyYaml(config);
    writeFileSync(configPath, yamlContent, 'utf-8');
  } catch (error) {
    throw WorkspaceConfigError.fileAccessError(configPath, error as Error);
  }
}
