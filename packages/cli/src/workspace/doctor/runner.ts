/**
 * Doctor command runner - orchestrates all checks
 */

import { loadWorkspaceConfig } from '../config/loader.js';
import type { WorkspaceConfig } from '../config/types.js';
import {
  checkActiveProfile,
  checkBaseUrl,
  checkOpenApiSource,
  checkProfileNames,
  checkSecretsBackend,
  checkVariableReferences,
} from './checks.js';
import type { CheckResult, DoctorResult } from './types.js';

/**
 * Result of loading a workspace for doctor
 */
export type WorkspaceLoadResult =
  | { success: true; config: WorkspaceConfig; path: string }
  | { success: false; error: string };

/**
 * Load workspace config for doctor checks
 */
export function loadWorkspaceForDoctor(workspacePath: string): WorkspaceLoadResult {
  try {
    const config = loadWorkspaceConfig(workspacePath);
    if (!config) {
      return {
        success: false,
        error: `No workspace.yaml found at ${workspacePath}`,
      };
    }
    return { success: true, config, path: workspacePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run all doctor checks on a workspace config
 */
export function runDoctorChecks(config: WorkspaceConfig, workspacePath: string): DoctorResult {
  const results: CheckResult[] = [];

  // Run all checks
  results.push(checkActiveProfile(config));
  results.push(...checkProfileNames(config));
  results.push(checkOpenApiSource(config, workspacePath));
  results.push(...checkVariableReferences(config));
  results.push(checkBaseUrl(config));
  results.push(checkSecretsBackend(config));

  // Aggregate results
  let errors = 0;
  let warnings = 0;
  let passed = 0;

  for (const result of results) {
    if (result.passed) {
      passed++;
    } else if (result.severity === 'error') {
      errors++;
    } else if (result.severity === 'warning') {
      warnings++;
    }
  }

  return {
    checks: results,
    errors,
    warnings,
    passed,
    success: errors === 0,
  };
}

/**
 * Run doctor on a workspace path
 * This is the main entry point for the doctor command
 */
export function runDoctor(workspacePath: string): DoctorResult | { success: false; error: string } {
  const loadResult = loadWorkspaceForDoctor(workspacePath);

  if (!loadResult.success) {
    return { success: false, error: loadResult.error };
  }

  return runDoctorChecks(loadResult.config, workspacePath);
}
