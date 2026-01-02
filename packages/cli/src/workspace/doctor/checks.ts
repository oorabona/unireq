/**
 * Individual check functions for workspace doctor (kubectl-inspired model)
 *
 * Note: activeProfile is no longer in WorkspaceConfig - it's in GlobalConfig
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { WorkspaceConfig } from '../config/types.js';
import type { CheckResult } from './types.js';

/**
 * Check that all profile names are valid
 */
export function checkProfileNames(config: WorkspaceConfig): CheckResult[] {
  const results: CheckResult[] = [];
  const profiles = config.profiles ?? {};
  const validNamePattern = /^[a-z0-9-]+$/i;

  for (const name of Object.keys(profiles)) {
    if (!validNamePattern.test(name)) {
      results.push({
        name: 'Profile name',
        passed: false,
        severity: 'warning',
        message: `Profile "${name}" has invalid characters`,
        details: 'Use alphanumeric characters and hyphens only',
      });
    }
  }

  if (results.length === 0) {
    const profileCount = Object.keys(profiles).length;
    results.push({
      name: 'Profile names',
      passed: true,
      severity: 'info',
      message: profileCount > 0 ? `All ${profileCount} profile names are valid` : 'No profiles defined',
    });
  }

  return results;
}

/**
 * Check that profiles have valid baseUrl
 */
export function checkProfileBaseUrls(config: WorkspaceConfig): CheckResult[] {
  const results: CheckResult[] = [];
  const profiles = config.profiles ?? {};

  for (const [profileName, profile] of Object.entries(profiles)) {
    const baseUrl = profile.baseUrl;

    // Skip if contains variable reference (can't validate at this stage)
    if (baseUrl.includes('${')) {
      results.push({
        name: `Profile ${profileName} base URL`,
        passed: true,
        severity: 'info',
        message: `Base URL contains variable reference (validated at runtime)`,
      });
      continue;
    }

    // Basic URL validation
    try {
      new URL(baseUrl);
      results.push({
        name: `Profile ${profileName} base URL`,
        passed: true,
        severity: 'info',
        message: `Base URL is valid: ${baseUrl}`,
      });
    } catch {
      results.push({
        name: `Profile ${profileName} base URL`,
        passed: false,
        severity: 'error',
        message: `Base URL is invalid: ${baseUrl}`,
        details: 'Expected format: https://api.example.com',
      });
    }
  }

  if (results.length === 0) {
    results.push({
      name: 'Profile base URLs',
      passed: true,
      severity: 'info',
      message: 'No profiles defined',
    });
  }

  return results;
}

/**
 * Check that OpenAPI source file exists (if specified)
 */
export function checkOpenApiSource(config: WorkspaceConfig, workspacePath: string): CheckResult {
  const source = config.openapi?.source;

  if (!source) {
    return {
      name: 'OpenAPI source',
      passed: true,
      severity: 'info',
      message: 'No OpenAPI source configured',
    };
  }

  // Skip URL sources
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return {
      name: 'OpenAPI source',
      passed: true,
      severity: 'info',
      message: `OpenAPI source is a URL: ${source}`,
    };
  }

  // Resolve path relative to workspace
  const resolvedPath = isAbsolute(source) ? source : join(dirname(workspacePath), source);

  if (existsSync(resolvedPath)) {
    return {
      name: 'OpenAPI source',
      passed: true,
      severity: 'info',
      message: `OpenAPI source file exists: ${source}`,
    };
  }

  return {
    name: 'OpenAPI source',
    passed: false,
    severity: 'warning',
    message: `OpenAPI source file not found: ${source}`,
    details: `Expected at: ${resolvedPath}`,
  };
}

/**
 * Check for undefined variable references in config values
 */
export function checkVariableReferences(config: WorkspaceConfig): CheckResult[] {
  const results: CheckResult[] = [];
  const profiles = config.profiles ?? {};

  // Collect all defined vars (workspace-level secrets + profile vars)
  const definedVars = new Set<string>();

  // Add workspace-level secrets as available vars
  if (config.secrets) {
    for (const secretName of Object.keys(config.secrets)) {
      definedVars.add(secretName);
    }
  }

  // Pattern to find ${var:...} references
  const varPattern = /\$\{var:([^}]+)\}/g;

  // Collect values to check
  const valuesToCheck: Array<{ path: string; value: string }> = [];

  // Check profile values
  for (const [profileName, profile] of Object.entries(profiles)) {
    // Add profile vars to defined vars
    if (profile.vars) {
      for (const varName of Object.keys(profile.vars)) {
        definedVars.add(varName);
      }
    }

    // Add profile secrets to defined vars
    if (profile.secrets) {
      for (const secretName of Object.keys(profile.secrets)) {
        definedVars.add(secretName);
      }
    }

    // Check baseUrl
    valuesToCheck.push({ path: `profiles.${profileName}.baseUrl`, value: profile.baseUrl });

    // Check headers
    if (profile.headers) {
      for (const [headerName, headerValue] of Object.entries(profile.headers)) {
        valuesToCheck.push({ path: `profiles.${profileName}.headers.${headerName}`, value: headerValue });
      }
    }
  }

  // Check auth provider configs (they may have variable references)
  if (config.auth?.providers) {
    for (const [providerName, provider] of Object.entries(config.auth.providers)) {
      const providerObj = provider as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(providerObj)) {
        if (typeof value === 'string') {
          valuesToCheck.push({ path: `auth.providers.${providerName}.${key}`, value });
        }
      }
    }
  }

  // Find undefined var references
  const undefinedVars = new Map<string, string[]>();

  for (const { path, value } of valuesToCheck) {
    varPattern.lastIndex = 0;
    let match = varPattern.exec(value);
    while (match !== null) {
      const varName = match[1] as string;
      if (!definedVars.has(varName)) {
        if (!undefinedVars.has(varName)) {
          undefinedVars.set(varName, []);
        }
        undefinedVars.get(varName)?.push(path);
      }
      match = varPattern.exec(value);
    }
  }

  // Report undefined variables
  for (const [varName, paths] of undefinedVars) {
    results.push({
      name: 'Variable reference',
      passed: false,
      severity: 'warning',
      message: `Variable "${varName}" is not defined`,
      details: `Used in: ${paths.join(', ')}`,
    });
  }

  if (results.length === 0) {
    results.push({
      name: 'Variable references',
      passed: true,
      severity: 'info',
      message: 'All variable references are valid',
    });
  }

  return results;
}

/**
 * Check that secrets backend is valid
 */
export function checkSecretsBackend(config: WorkspaceConfig): CheckResult {
  const backend = config.secretsBackend?.backend;

  if (!backend || backend === 'auto') {
    return {
      name: 'Secrets backend',
      passed: true,
      severity: 'info',
      message: 'Secrets backend: auto (will use best available)',
    };
  }

  const validBackends = ['auto', 'keychain', 'vault'];
  if (validBackends.includes(backend)) {
    return {
      name: 'Secrets backend',
      passed: true,
      severity: 'info',
      message: `Secrets backend: ${backend}`,
    };
  }

  return {
    name: 'Secrets backend',
    passed: false,
    severity: 'warning',
    message: `Unknown secrets backend: ${backend}`,
    details: `Valid options: ${validBackends.join(', ')}`,
  };
}

/**
 * Check workspace name is valid
 */
export function checkWorkspaceName(config: WorkspaceConfig): CheckResult {
  const name = config.name;
  const validNamePattern = /^[a-z0-9-]+$/i;

  if (!name) {
    return {
      name: 'Workspace name',
      passed: false,
      severity: 'error',
      message: 'Workspace name is required',
    };
  }

  if (!validNamePattern.test(name)) {
    return {
      name: 'Workspace name',
      passed: false,
      severity: 'warning',
      message: `Workspace name "${name}" has invalid characters`,
      details: 'Use alphanumeric characters and hyphens only',
    };
  }

  return {
    name: 'Workspace name',
    passed: true,
    severity: 'info',
    message: `Workspace name is valid: ${name}`,
  };
}

/**
 * Check that workspace has at least one profile (warning if none)
 */
export function checkHasProfiles(config: WorkspaceConfig): CheckResult {
  const profileCount = Object.keys(config.profiles ?? {}).length;

  if (profileCount === 0) {
    return {
      name: 'Profiles',
      passed: true,
      severity: 'warning',
      message: 'No profiles defined',
      details: 'Use "profile create <name> --base-url <url>" to create a profile',
    };
  }

  return {
    name: 'Profiles',
    passed: true,
    severity: 'info',
    message: `${profileCount} profile(s) defined`,
  };
}
