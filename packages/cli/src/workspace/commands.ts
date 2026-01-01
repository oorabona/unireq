/**
 * Workspace management REPL commands
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { cancel, confirm, isCancel, text } from '@clack/prompts';
import { consola } from 'consola';
import { stringify as stringifyYaml } from 'yaml';
import type { Command, CommandHandler } from '../repl/types.js';
import { CONFIG_FILE_NAME } from './config/loader.js';
import { WORKSPACE_DIR_NAME } from './constants.js';
import { findWorkspace } from './detection.js';
import { type DoctorResult, runDoctor } from './doctor/index.js';
import {
  addWorkspace,
  getWorkspace,
  loadRegistry,
  removeWorkspace,
  setActiveWorkspace,
  type WorkspaceDisplayInfo,
} from './registry/index.js';

/**
 * Result of workspace initialization
 */
export interface WorkspaceInitResult {
  /** Path to the created workspace directory */
  workspacePath: string;
  /** Path to the created config file */
  configPath: string;
}

/**
 * Options for workspace initialization
 */
export interface WorkspaceInitOptions {
  /** Directory to initialize workspace in (defaults to cwd) */
  targetDir?: string;
  /** Workspace name (defaults to directory name) */
  name?: string;
  /** Base URL for API requests */
  baseUrl?: string;
  /** Whether to create default profiles */
  createProfiles?: boolean;
}

/**
 * Generate minimal workspace.yaml content
 */
function generateWorkspaceConfig(options: { name: string; baseUrl?: string; createProfiles: boolean }): object {
  const config: Record<string, unknown> = {
    version: 1,
    name: options.name,
  };

  if (options.baseUrl) {
    config['baseUrl'] = options.baseUrl;
  }

  if (options.createProfiles) {
    config['profiles'] = {
      dev: {
        vars: {
          env: 'development',
        },
      },
      prod: {
        vars: {
          env: 'production',
        },
      },
    };
    config['activeProfile'] = 'dev';
  }

  return config;
}

/**
 * Initialize a new workspace directory
 *
 * @param options - Initialization options
 * @returns Result with created paths
 * @throws Error if workspace already exists
 */
export function initWorkspace(options: WorkspaceInitOptions = {}): WorkspaceInitResult {
  const targetDir = resolve(options.targetDir ?? process.cwd());
  const workspacePath = join(targetDir, WORKSPACE_DIR_NAME);
  const configPath = join(workspacePath, CONFIG_FILE_NAME);

  // Check if workspace already exists
  if (existsSync(workspacePath)) {
    throw new Error(`Workspace already exists at ${workspacePath}`);
  }

  // Determine workspace name
  const name = options.name ?? basename(targetDir);

  // Generate config
  const config = generateWorkspaceConfig({
    name,
    baseUrl: options.baseUrl,
    createProfiles: options.createProfiles ?? false,
  });

  // Create directory
  mkdirSync(workspacePath, { recursive: true });

  // Write config file
  const yamlContent = stringifyYaml(config);
  writeFileSync(configPath, yamlContent, 'utf-8');

  return { workspacePath, configPath };
}

/**
 * Build list of workspaces for display
 * Combines local detected workspace with registered workspaces
 */
export function listWorkspaces(): WorkspaceDisplayInfo[] {
  const result: WorkspaceDisplayInfo[] = [];
  const registry = loadRegistry();

  // Add local detected workspace
  const localWorkspace = findWorkspace();
  if (localWorkspace) {
    result.push({
      name: '(local)',
      path: localWorkspace.path,
      isActive: !registry.active, // Active if no registry active set
      source: 'local',
      exists: true,
    });
  }

  // Add registered workspaces
  for (const [name, entry] of Object.entries(registry.workspaces)) {
    result.push({
      name,
      path: entry.path,
      description: entry.description,
      isActive: registry.active === name,
      source: 'registry',
      exists: existsSync(entry.path),
    });
  }

  return result;
}

/**
 * Handle 'workspace list' - list all workspaces
 */
function handleList(): void {
  const workspaces = listWorkspaces();

  if (workspaces.length === 0) {
    consola.info('No workspaces found.');
    consola.info('Use "workspace init" to create a local workspace');
    consola.info('Use "workspace add <name> <path>" to register a workspace');
    return;
  }

  consola.info('Workspaces:');

  for (const ws of workspaces) {
    const activeMarker = ws.isActive ? '* ' : '  ';
    const existsMarker = ws.exists ? '' : ' [missing]';
    const description = ws.description ? ` - ${ws.description}` : '';

    consola.info(`${activeMarker}${ws.name}: ${ws.path}${description}${existsMarker}`);
  }
}

/**
 * Handle 'workspace add <name> <path>' - add workspace to registry
 */
async function handleAdd(name?: string, pathArg?: string): Promise<void> {
  // Get name interactively if not provided
  let workspaceName = name;
  if (!workspaceName) {
    const result = await text({
      message: 'Workspace name:',
      placeholder: 'my-api',
      validate: (value) => {
        if (!value?.trim()) return 'Name is required';
        if (!/^[a-z0-9-]+$/i.test(value)) return 'Use alphanumeric characters and hyphens only';
        return undefined;
      },
    });

    if (isCancel(result)) {
      cancel('Cancelled.');
      return;
    }
    workspaceName = result as string;
  }

  // Get path interactively if not provided
  let workspacePath = pathArg;
  if (!workspacePath) {
    const result = await text({
      message: 'Path to workspace directory:',
      placeholder: '/path/to/project/.unireq',
      validate: (value) => {
        if (!value?.trim()) return 'Path is required';
        return undefined;
      },
    });

    if (isCancel(result)) {
      cancel('Cancelled.');
      return;
    }
    workspacePath = result as string;
  }

  // Resolve to absolute path
  const absolutePath = resolve(workspacePath);

  // Check if path exists
  if (!existsSync(absolutePath)) {
    consola.warn(`Path does not exist: ${absolutePath}`);
    const confirmed = await confirm({
      message: 'Add anyway?',
      initialValue: false,
    });

    if (isCancel(confirmed) || !confirmed) {
      cancel('Cancelled.');
      return;
    }
  }

  // Check if already registered
  const existing = getWorkspace(workspaceName);
  if (existing) {
    consola.warn(`Workspace "${workspaceName}" already exists at ${existing.path}`);
    const confirmed = await confirm({
      message: 'Replace?',
      initialValue: false,
    });

    if (isCancel(confirmed) || !confirmed) {
      cancel('Cancelled.');
      return;
    }
  }

  // Optional description
  const descResult = await text({
    message: 'Description (optional):',
    placeholder: 'My API project',
  });

  if (isCancel(descResult)) {
    cancel('Cancelled.');
    return;
  }

  const description = descResult ? (descResult as string) : undefined;

  // Add to registry
  addWorkspace(workspaceName, absolutePath, description);
  consola.success(`Added workspace "${workspaceName}" → ${absolutePath}`);
}

/**
 * Handle 'workspace use <name>' - switch active workspace
 */
async function handleUse(name?: string): Promise<void> {
  const registry = loadRegistry();
  const names = Object.keys(registry.workspaces);

  if (names.length === 0) {
    consola.warn('No workspaces registered.');
    consola.info('Use "workspace add <name> <path>" to register a workspace');
    return;
  }

  // If name not provided, show selection
  let workspaceName = name;
  if (!workspaceName) {
    consola.info('Available workspaces:');
    for (const n of names) {
      const marker = registry.active === n ? '* ' : '  ';
      consola.info(`${marker}${n}`);
    }

    const result = await text({
      message: 'Switch to workspace:',
      placeholder: names[0],
      validate: (value) => {
        if (!value?.trim()) return 'Name is required';
        if (!names.includes(value ?? '')) return `Unknown workspace: ${value}`;
        return undefined;
      },
    });

    if (isCancel(result)) {
      cancel('Cancelled.');
      return;
    }
    workspaceName = result as string;
  }

  // Validate workspace exists in registry
  if (!names.includes(workspaceName)) {
    consola.error(`Unknown workspace: ${workspaceName}`);
    consola.info(`Available: ${names.join(', ')}`);
    return;
  }

  // Set active
  const success = setActiveWorkspace(workspaceName);
  if (success) {
    consola.success(`Switched to workspace "${workspaceName}"`);
  } else {
    consola.error(`Failed to switch to workspace "${workspaceName}"`);
  }
}

/**
 * Handle 'workspace remove <name>' - remove workspace from registry
 */
async function handleRemove(name?: string): Promise<void> {
  const registry = loadRegistry();
  const names = Object.keys(registry.workspaces);

  if (names.length === 0) {
    consola.warn('No workspaces registered.');
    return;
  }

  // If name not provided, show selection
  let workspaceName = name;
  if (!workspaceName) {
    consola.info('Registered workspaces:');
    for (const n of names) {
      consola.info(`  ${n}`);
    }

    const result = await text({
      message: 'Remove workspace:',
      placeholder: names[0],
      validate: (value) => {
        if (!value?.trim()) return 'Name is required';
        if (!names.includes(value ?? '')) return `Unknown workspace: ${value}`;
        return undefined;
      },
    });

    if (isCancel(result)) {
      cancel('Cancelled.');
      return;
    }
    workspaceName = result as string;
  }

  // Validate workspace exists in registry
  if (!names.includes(workspaceName)) {
    consola.error(`Unknown workspace: ${workspaceName}`);
    return;
  }

  // Confirm removal
  const confirmed = await confirm({
    message: `Remove "${workspaceName}" from registry?`,
    initialValue: false,
  });

  if (isCancel(confirmed) || !confirmed) {
    cancel('Cancelled.');
    return;
  }

  // Remove from registry
  const removed = removeWorkspace(workspaceName);
  if (removed) {
    consola.success(`Removed workspace "${workspaceName}"`);
    if (registry.active === workspaceName) {
      consola.info('Active workspace cleared.');
    }
  } else {
    consola.error(`Failed to remove workspace "${workspaceName}"`);
  }
}

/**
 * Handle 'workspace init' - initialize a new workspace
 */
async function handleInit(targetDir?: string): Promise<void> {
  const resolvedDir = resolve(targetDir ?? process.cwd());

  // Check if workspace already exists
  const existingWorkspace = findWorkspace({ startDir: resolvedDir });
  if (existingWorkspace) {
    consola.warn(`Workspace already exists at ${existingWorkspace.path}`);
    consola.info('Use the existing workspace or remove it first.');
    return;
  }

  // Interactive prompts
  const dirName = basename(resolvedDir);

  const nameResult = await text({
    message: 'Workspace name:',
    placeholder: dirName,
    defaultValue: dirName,
  });

  if (isCancel(nameResult)) {
    cancel('Workspace initialization cancelled.');
    return;
  }

  const baseUrlResult = await text({
    message: 'Base URL (optional):',
    placeholder: 'https://api.example.com',
  });

  if (isCancel(baseUrlResult)) {
    cancel('Workspace initialization cancelled.');
    return;
  }

  const createProfilesResult = await confirm({
    message: 'Create default profiles (dev, prod)?',
    initialValue: true,
  });

  if (isCancel(createProfilesResult)) {
    cancel('Workspace initialization cancelled.');
    return;
  }

  // Initialize workspace
  try {
    const result = initWorkspace({
      targetDir: resolvedDir,
      name: nameResult as string,
      baseUrl: baseUrlResult ? (baseUrlResult as string) : undefined,
      createProfiles: createProfilesResult,
    });

    consola.success(`Created workspace at ${result.workspacePath}`);
    consola.info(`Configuration: ${result.configPath}`);

    if (createProfilesResult) {
      consola.info('Profiles created: dev (active), prod');
    }

    consola.info('\nNext steps:');
    consola.info('  1. Edit workspace.yaml to configure your API');
    consola.info('  2. Add authentication providers if needed');
    consola.info('  3. Run unireq to start the REPL');
  } catch (error) {
    consola.error(`Failed to initialize workspace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Format a check result for display
 */
function formatCheckResult(check: DoctorResult['checks'][0]): string {
  const icon = check.passed ? '✓' : check.severity === 'error' ? '✗' : '⚠';
  const line = `${icon} ${check.name}: ${check.message}`;
  if (check.details && !check.passed) {
    return `${line}\n    ${check.details}`;
  }
  return line;
}

/**
 * Handle 'workspace doctor' - validate workspace configuration
 */
function handleDoctor(workspacePath?: string): void {
  // Find workspace to check
  let targetPath: string;

  if (workspacePath) {
    targetPath = resolve(workspacePath);
  } else {
    // Try to find local workspace
    const local = findWorkspace();
    if (local) {
      targetPath = local.path;
    } else {
      // Try to use active from registry
      const registry = loadRegistry();
      if (registry.active && registry.workspaces[registry.active]) {
        targetPath = registry.workspaces[registry.active]?.path ?? '';
      } else {
        consola.error('No workspace found.');
        consola.info('Either:');
        consola.info('  - Run from a directory with .unireq workspace');
        consola.info('  - Use "workspace use <name>" to set active workspace');
        consola.info('  - Provide path: "workspace doctor /path/to/.unireq"');
        return;
      }
    }
  }

  consola.info(`Checking workspace: ${targetPath}`);
  consola.info('');

  const result = runDoctor(targetPath);

  // Handle load error
  if ('error' in result && !('checks' in result)) {
    consola.error(`✗ ${result.error}`);
    return;
  }

  // Show results
  const doctorResult = result as DoctorResult;

  // Group by passed/failed
  const failed = doctorResult.checks.filter((c) => !c.passed);

  // Show failures first
  if (failed.length > 0) {
    const errors = failed.filter((c) => c.severity === 'error');
    const warnings = failed.filter((c) => c.severity === 'warning');

    if (errors.length > 0) {
      consola.error('Errors:');
      for (const check of errors) {
        consola.error(formatCheckResult(check));
      }
      consola.info('');
    }

    if (warnings.length > 0) {
      consola.warn('Warnings:');
      for (const check of warnings) {
        consola.warn(formatCheckResult(check));
      }
      consola.info('');
    }
  }

  // Show summary
  if (doctorResult.success) {
    consola.success(`✓ All checks passed (${doctorResult.passed} checks)`);
    if (doctorResult.warnings > 0) {
      consola.info(`  ${doctorResult.warnings} warning(s)`);
    }
  } else {
    consola.error(`✗ ${doctorResult.errors} error(s), ${doctorResult.warnings} warning(s)`);
  }
}

/**
 * Workspace command handler
 * Handles: workspace init|list|add|use|remove|doctor
 */
export const workspaceHandler: CommandHandler = async (args, _state) => {
  const subcommand = args[0]?.toLowerCase();

  switch (subcommand) {
    case 'init':
      return handleInit(args[1]);

    case 'list':
    case 'ls':
      return handleList();

    case 'add':
      return handleAdd(args[1], args[2]);

    case 'use':
    case 'switch':
      return handleUse(args[1]);

    case 'remove':
    case 'rm':
      return handleRemove(args[1]);

    case 'doctor':
    case 'check':
      return handleDoctor(args[1]);

    case undefined:
      // No subcommand - show list
      return handleList();

    default:
      consola.warn(`Unknown subcommand: ${subcommand}`);
      consola.info('Available: workspace [list|add|use|remove|doctor|init]');
  }
};

/**
 * Create workspace command
 */
export function createWorkspaceCommand(): Command {
  return {
    name: 'workspace',
    description: 'Manage workspaces (list|add|use|remove|doctor|init)',
    handler: workspaceHandler,
  };
}
