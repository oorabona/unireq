/**
 * Individual check functions for workspace doctor
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { WorkspaceConfig } from '../config/types.js';
import type { CheckResult } from './types.js';

/**
 * Check that activeProfile exists in profiles
 */
export function checkActiveProfile(config: WorkspaceConfig): CheckResult {
  if (!config.activeProfile) {
    return {
      name: 'Active profile',
      passed: true,
      severity: 'info',
      message: 'No active profile set (using defaults)',
    };
  }

  const profileExists = config.activeProfile in config.profiles;
  if (profileExists) {
    return {
      name: 'Active profile',
      passed: true,
      severity: 'info',
      message: `Active profile "${config.activeProfile}" exists`,
    };
  }

  return {
    name: 'Active profile',
    passed: false,
    severity: 'error',
    message: `Active profile "${config.activeProfile}" not found in profiles`,
    details: `Available profiles: ${Object.keys(config.profiles).join(', ') || 'none'}`,
  };
}

/**
 * Check that all profile names are valid
 */
export function checkProfileNames(config: WorkspaceConfig): CheckResult[] {
  const results: CheckResult[] = [];
  const validNamePattern = /^[a-z0-9-]+$/i;

  for (const name of Object.keys(config.profiles)) {
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
    results.push({
      name: 'Profile names',
      passed: true,
      severity: 'info',
      message: `All ${Object.keys(config.profiles).length} profile names are valid`,
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
  const definedVars = new Set(Object.keys(config.vars || {}));

  // Pattern to find ${var:...} references
  const varPattern = /\$\{var:([^}]+)\}/g;

  // Collect values to check
  const valuesToCheck: Array<{ path: string; value: string }> = [];

  // Check baseUrl
  if (config.baseUrl) {
    valuesToCheck.push({ path: 'baseUrl', value: config.baseUrl });
  }

  // Check profile values
  for (const [profileName, profile] of Object.entries(config.profiles)) {
    if (profile.baseUrl) {
      valuesToCheck.push({ path: `profiles.${profileName}.baseUrl`, value: profile.baseUrl });
    }
    if (profile.headers) {
      for (const [headerName, headerValue] of Object.entries(profile.headers)) {
        valuesToCheck.push({ path: `profiles.${profileName}.headers.${headerName}`, value: headerValue });
      }
    }
    // Add profile vars to defined vars (profile can define vars)
    if (profile.vars) {
      for (const varName of Object.keys(profile.vars)) {
        definedVars.add(varName);
      }
    }
  }

  // Check auth provider configs (they may have variable references)
  if (config.auth?.providers) {
    for (const [providerName, provider] of Object.entries(config.auth.providers)) {
      // Check common auth fields that might have variables
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
    // Check ${var:...} references
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
 * Check baseUrl format
 */
export function checkBaseUrl(config: WorkspaceConfig): CheckResult {
  const baseUrl = config.baseUrl;

  if (!baseUrl) {
    return {
      name: 'Base URL',
      passed: true,
      severity: 'info',
      message: 'No base URL configured',
    };
  }

  // Skip if contains variable reference (can't validate at this stage)
  if (baseUrl.includes('${')) {
    return {
      name: 'Base URL',
      passed: true,
      severity: 'info',
      message: 'Base URL contains variable reference (validated at runtime)',
    };
  }

  // Basic URL validation
  try {
    new URL(baseUrl);
    return {
      name: 'Base URL',
      passed: true,
      severity: 'info',
      message: `Base URL is valid: ${baseUrl}`,
    };
  } catch {
    return {
      name: 'Base URL',
      passed: false,
      severity: 'warning',
      message: `Base URL may be invalid: ${baseUrl}`,
      details: 'Expected format: https://api.example.com',
    };
  }
}

/**
 * Check that secrets backend is valid
 */
export function checkSecretsBackend(config: WorkspaceConfig): CheckResult {
  const backend = config.secrets?.backend;

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
