/**
 * Workspace management REPL commands (kubectl-inspired model)
 *
 * Terminology:
 * - Workspace = 1 API (like kubectl cluster)
 * - Profile = 1 environment within an API (like kubectl context)
 * - Registry = global index of all known workspaces
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { cancel, confirm, isCancel, text } from '@clack/prompts';
import { consola } from 'consola';
import { stringify as stringifyYaml } from 'yaml';
import { clearSpecFromState, loadSpecIntoState } from '../openapi/state-loader.js';
import type { ReplState } from '../repl/state.js';
import type { Command, CommandHandler } from '../repl/types.js';
import { CONFIG_FILE_NAME, loadWorkspaceConfig } from './config/loader.js';
import type { WorkspaceLocation } from './config/types.js';
import { WORKSPACE_DIR_NAME } from './constants.js';
import { findWorkspace } from './detection.js';
import { type DoctorResult, runDoctor } from './doctor/index.js';
import {
  getActiveContext,
  getActiveProfile,
  getActiveWorkspace,
  setActiveContext,
  setActiveWorkspace,
} from './global-config.js';
import {
  getWorkspace,
  loadRegistry,
  addWorkspace as registryAddWorkspace,
  listWorkspaces as registryListWorkspaces,
  removeWorkspace as registryRemoveWorkspace,
  type WorkspaceDisplayInfo,
} from './registry/index.js';

/**
 * Format a path for display, replacing home directory with ~
 */
function formatPath(path: string): string {
  const home = homedir();
  if (path.startsWith(home)) {
    return '~' + path.slice(home.length);
  }
  return path;
}

/**
 * Reload workspace config into REPL state after workspace switch
 * This ensures state.workspaceConfig is updated when user runs 'workspace use'
 * Also loads OpenAPI spec if configured in the workspace
 */
async function reloadWorkspaceState(state: ReplState, workspaceName: string): Promise<void> {
  const ws = getWorkspace(workspaceName);
  if (!ws) {
    return;
  }

  const config = loadWorkspaceConfig(ws.path);
  if (config) {
    state.workspace = ws.path;
    state.workspaceConfig = config;
    state.activeProfile = getActiveProfile();

    // Load OpenAPI spec if configured
    if (config.openapi?.source) {
      await loadSpecIntoState(state, config.openapi.source, {
        workspacePath: ws.path,
      });
    } else {
      // Clear spec if new workspace has no openapi config
      clearSpecFromState(state);
    }
  } else {
    // No config found, clear spec
    clearSpecFromState(state);
  }
}

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
  /** Initial profile name (optional - no profile created if not provided) */
  profileName?: string;
  /** Base URL for the profile (required if profileName is provided) */
  profileBaseUrl?: string;
  /** Whether this is a global workspace */
  global?: boolean;
}

/**
 * Generate workspace.yaml content (version 2)
 */
function generateWorkspaceConfig(options: { name: string; profileName?: string; profileBaseUrl?: string }): object {
  const config: Record<string, unknown> = {
    version: 2,
    name: options.name,
  };

  // Only create profile if both name and baseUrl are provided
  if (options.profileName && options.profileBaseUrl) {
    config['profiles'] = {
      [options.profileName]: {
        baseUrl: options.profileBaseUrl,
      },
    };
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
    profileName: options.profileName,
    profileBaseUrl: options.profileBaseUrl,
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
export function listAllWorkspaces(): WorkspaceDisplayInfo[] {
  const result: WorkspaceDisplayInfo[] = [];
  const activeWorkspace = getActiveWorkspace();

  // Add local detected workspace (if not already in registry)
  const localWorkspace = findWorkspace();
  if (localWorkspace) {
    // Check if this local workspace is registered
    const registryEntries = registryListWorkspaces();
    const isRegistered = registryEntries.some(([, entry]) => entry.path === localWorkspace.path);

    if (!isRegistered) {
      // Get profile names from the workspace config
      let profiles: string[] = [];
      try {
        const config = loadWorkspaceConfig(localWorkspace.path);
        if (config?.profiles) {
          profiles = Object.keys(config.profiles);
        }
      } catch {
        // Ignore config load errors for listing
      }

      // Use directory name as workspace name
      const workspaceName = basename(resolve(localWorkspace.path, '..'));
      result.push({
        name: workspaceName,
        path: localWorkspace.path,
        location: 'local',
        isActive: activeWorkspace === workspaceName,
        profiles,
        exists: true,
      });
    }
  }

  // Add registered workspaces
  const registryEntries = registryListWorkspaces();
  for (const [name, entry] of registryEntries) {
    // Get profile names from the workspace config
    let profiles: string[] = [];
    try {
      const config = loadWorkspaceConfig(entry.path);
      if (config?.profiles) {
        profiles = Object.keys(config.profiles);
      }
    } catch {
      // Ignore config load errors for listing
    }

    result.push({
      name,
      path: entry.path,
      location: entry.location,
      description: entry.description,
      isActive: activeWorkspace === name,
      profiles,
      exists: existsSync(entry.path),
    });
  }

  return result;
}

/**
 * Handle 'workspace list' - list all workspaces
 */
function handleList(): void {
  const workspaces = listAllWorkspaces();
  const { workspace: activeWs, profile: activeProfile } = getActiveContext();

  if (workspaces.length === 0) {
    consola.info('No workspaces found.');
    consola.info('');
    consola.info('Create a workspace:');
    consola.info('  workspace init                    Create local workspace in current directory');
    consola.info('  workspace init --global <name>    Create global workspace');
    consola.info('');
    consola.info('Register existing workspace:');
    consola.info('  workspace register <name> <path>  Register workspace in registry');
    return;
  }

  consola.info('Workspaces:');
  consola.info('');

  // Table header
  consola.info('  NAME         PATH                                   LOCATION   PROFILES');
  consola.info('  ────         ────                                   ────────   ────────');

  for (const ws of workspaces) {
    const activeMarker = ws.isActive ? '*' : ' ';
    const existsMarker = ws.exists ? '' : ' [missing]';
    const profilesStr = ws.profiles.length > 0 ? ws.profiles.join(', ') : '-';
    const nameCol = ws.name.slice(0, 12).padEnd(12);
    const pathFormatted = formatPath(ws.path);
    // Truncate path from the start if too long
    const maxPathLen = 40;
    const pathCol =
      pathFormatted.length > maxPathLen
        ? '...' + pathFormatted.slice(-(maxPathLen - 3))
        : pathFormatted.padEnd(maxPathLen);
    const locCol = ws.location.padEnd(10);

    consola.info(`${activeMarker} ${nameCol} ${pathCol} ${locCol} ${profilesStr}${existsMarker}`);
  }

  if (activeWs) {
    consola.info('');
    consola.info(`Active: ${activeWs}${activeProfile ? ` / ${activeProfile}` : ''}`);
  }
}

/**
 * Handle 'workspace register <name> <path>' - register workspace in registry
 */
async function handleRegister(name?: string, pathArg?: string, isReplMode?: boolean): Promise<void> {
  // In REPL mode, require all arguments (no interactive prompts due to terminal conflict)
  if (isReplMode) {
    if (!name || !pathArg) {
      consola.error('Usage: workspace register <name> <path>');
      consola.info('Example: workspace register my-api /path/to/project/.unireq');
      return;
    }
    const absolutePath = resolve(pathArg);
    if (!existsSync(absolutePath)) {
      consola.warn(`Path does not exist: ${absolutePath}`);
    }
    const existing = getWorkspace(name);
    if (existing) {
      consola.warn(`Workspace "${name}" already exists at ${existing.path} - replacing`);
    }
    // Detect location type based on path
    const location: WorkspaceLocation = absolutePath.includes('.config/unireq/workspaces') ? 'global' : 'local';
    registryAddWorkspace(name, absolutePath, location);
    consola.success(`Registered workspace "${name}" (${location}) at ${absolutePath}`);
    return;
  }

  // Shell mode: Interactive prompts
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
      message: 'Register anyway?',
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

  // Detect location type based on path
  const location: WorkspaceLocation = absolutePath.includes('.config/unireq/workspaces') ? 'global' : 'local';

  // Add to registry
  registryAddWorkspace(workspaceName, absolutePath, location, description);
  consola.success(`Registered workspace "${workspaceName}" (${location}) at ${absolutePath}`);
}

/**
 * Handle 'workspace use <name>' - switch active workspace
 */
async function handleUse(name: string | undefined, isReplMode: boolean | undefined, state: ReplState): Promise<void> {
  const workspaces = listAllWorkspaces();
  const names = workspaces.map((ws) => ws.name);

  if (names.length === 0) {
    consola.warn('No workspaces found.');
    consola.info('Use "workspace init" to create a workspace');
    return;
  }

  const activeWorkspace = getActiveWorkspace();

  // In REPL mode, require name argument
  if (isReplMode && !name) {
    consola.error('Usage: workspace use <name>');
    consola.info('Available workspaces:');
    for (const n of names) {
      const marker = activeWorkspace === n ? '* ' : '  ';
      consola.info(`${marker}${n}`);
    }
    return;
  }

  // If name not provided (shell mode), show interactive selection
  let workspaceName = name;
  if (!workspaceName) {
    consola.info('Available workspaces:');
    for (const n of names) {
      const marker = activeWorkspace === n ? '* ' : '  ';
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

  // Validate workspace exists
  if (!names.includes(workspaceName)) {
    consola.error(`Unknown workspace: ${workspaceName}`);
    consola.info(`Available: ${names.join(', ')}`);
    return;
  }

  // Set active (clears activeProfile when switching workspace)
  setActiveWorkspace(workspaceName);

  // Reload workspace config into REPL state (including OpenAPI spec if configured)
  await reloadWorkspaceState(state, workspaceName);

  consola.success(`Switched to workspace "${workspaceName}"`);

  // Show hint about profiles if workspace has profiles
  const ws = workspaces.find((w) => w.name === workspaceName);
  if (ws && ws.profiles.length > 0) {
    consola.info(`Available profiles: ${ws.profiles.join(', ')}`);
    consola.info('Use "profile use <name>" to select a profile');
  } else if (ws && ws.profiles.length === 0) {
    consola.info('This workspace has no profiles.');
    consola.info('Use "profile create <name> --base-url <url>" to create one');
  }
}

/**
 * Handle 'workspace unregister <name>' - remove workspace from registry
 */
async function handleUnregister(name?: string, isReplMode?: boolean): Promise<void> {
  const registry = loadRegistry();
  const names = Object.keys(registry.workspaces);

  if (names.length === 0) {
    consola.warn('No workspaces registered.');
    return;
  }

  const activeWorkspace = getActiveWorkspace();

  // In REPL mode, require name argument (no confirmation prompt)
  if (isReplMode) {
    if (!name) {
      consola.error('Usage: workspace unregister <name>');
      consola.info('Registered workspaces:');
      for (const n of names) {
        consola.info(`  ${n}`);
      }
      return;
    }
    if (!names.includes(name)) {
      consola.error(`Unknown workspace: ${name}`);
      return;
    }
    const wasActive = activeWorkspace === name;
    const removed = registryRemoveWorkspace(name);
    if (removed) {
      consola.success(`Unregistered workspace "${name}"`);
      if (wasActive) {
        setActiveContext(undefined, undefined);
        consola.info('Active workspace cleared.');
      }
    } else {
      consola.error(`Failed to unregister workspace "${name}"`);
    }
    return;
  }

  // Shell mode: Interactive prompts
  let workspaceName = name;
  if (!workspaceName) {
    consola.info('Registered workspaces:');
    for (const n of names) {
      consola.info(`  ${n}`);
    }

    const result = await text({
      message: 'Unregister workspace:',
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
    message: `Unregister "${workspaceName}" from registry? (files will not be deleted)`,
    initialValue: false,
  });

  if (isCancel(confirmed) || !confirmed) {
    cancel('Cancelled.');
    return;
  }

  // Remove from registry
  const removed = registryRemoveWorkspace(workspaceName);
  if (removed) {
    consola.success(`Unregistered workspace "${workspaceName}"`);
    if (activeWorkspace === workspaceName) {
      setActiveContext(undefined, undefined);
      consola.info('Active workspace cleared.');
    }
  } else {
    consola.error(`Failed to unregister workspace "${workspaceName}"`);
  }
}

/**
 * Handle 'workspace init' - initialize a new workspace
 */
async function handleInit(args: string[], isReplMode: boolean | undefined, state: ReplState): Promise<void> {
  // Parse args: workspace init [--global <name>] [--profile <name>]
  let isGlobal = false;
  let globalName: string | undefined;
  let profileName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--global' || args[i] === '-g') {
      isGlobal = true;
      globalName = args[i + 1];
      i++;
    } else if (args[i] === '--profile' || args[i] === '-p') {
      profileName = args[i + 1];
      i++;
    }
  }

  // Determine target directory
  let targetDir: string;
  let workspaceName: string;

  if (isGlobal) {
    if (!globalName) {
      consola.error('Usage: workspace init --global <name> [--profile <name>]');
      return;
    }
    // Global workspace goes in ~/.config/unireq/workspaces/<name>/
    const { getGlobalWorkspacePath } = await import('./paths.js');
    const globalPath = getGlobalWorkspacePath();
    if (!globalPath) {
      consola.error('Cannot determine global workspace path (HOME not set)');
      return;
    }
    targetDir = join(globalPath, globalName);
    workspaceName = globalName;
  } else {
    targetDir = process.cwd();
    workspaceName = basename(targetDir);
  }

  // Check if workspace already exists
  const workspacePath = join(targetDir, WORKSPACE_DIR_NAME);
  if (existsSync(workspacePath)) {
    consola.warn(`Workspace already exists at ${workspacePath}`);
    consola.info('Use the existing workspace or remove it first.');
    return;
  }

  // In REPL mode, use provided args only (no interactive prompts)
  if (isReplMode) {
    try {
      const result = initWorkspace({
        targetDir,
        name: workspaceName,
        profileName,
        profileBaseUrl: profileName ? 'http://localhost:3000' : undefined, // Default URL for profile
        global: isGlobal,
      });

      // Register in registry (use directory name for both local and global)
      const location: WorkspaceLocation = isGlobal ? 'global' : 'local';
      registryAddWorkspace(workspaceName, result.workspacePath, location);

      consola.success(`Created ${location} workspace "${workspaceName}" at ${result.workspacePath}`);

      if (profileName) {
        // Set as active with the profile
        setActiveContext(workspaceName, profileName);
        await reloadWorkspaceState(state, workspaceName);
        consola.info(`Profile "${profileName}" created and activated`);
      } else {
        // Set as active without profile
        setActiveContext(workspaceName, undefined);
        await reloadWorkspaceState(state, workspaceName);
        consola.info('Workspace has no profiles. Use "profile create <name> --base-url <url>" to create one');
      }
    } catch (error) {
      consola.error(`Failed to initialize workspace: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }

  // Shell mode: Interactive prompts
  const nameResult = await text({
    message: 'Workspace name:',
    placeholder: workspaceName,
    defaultValue: workspaceName,
  });

  if (isCancel(nameResult)) {
    cancel('Workspace initialization cancelled.');
    return;
  }

  const createProfileResult = await confirm({
    message: 'Create an initial profile?',
    initialValue: false,
  });

  if (isCancel(createProfileResult)) {
    cancel('Workspace initialization cancelled.');
    return;
  }

  let finalProfileName: string | undefined;
  let finalProfileBaseUrl: string | undefined;

  if (createProfileResult) {
    const profileNameResult = await text({
      message: 'Profile name:',
      placeholder: 'dev',
      defaultValue: 'dev',
    });

    if (isCancel(profileNameResult)) {
      cancel('Workspace initialization cancelled.');
      return;
    }

    const baseUrlResult = await text({
      message: 'Base URL for this profile:',
      placeholder: 'http://localhost:3000',
      validate: (value) => {
        if (!value?.trim()) return 'Base URL is required for profiles';
        try {
          new URL(value);
          return undefined;
        } catch {
          return 'Must be a valid URL';
        }
      },
    });

    if (isCancel(baseUrlResult)) {
      cancel('Workspace initialization cancelled.');
      return;
    }

    finalProfileName = profileNameResult as string;
    finalProfileBaseUrl = baseUrlResult as string;
  }

  // Initialize workspace
  try {
    const result = initWorkspace({
      targetDir,
      name: nameResult as string,
      profileName: finalProfileName,
      profileBaseUrl: finalProfileBaseUrl,
      global: isGlobal,
    });

    // Register in registry (use the workspace name from prompt)
    const location: WorkspaceLocation = isGlobal ? 'global' : 'local';
    const wsName = nameResult as string;
    registryAddWorkspace(wsName, result.workspacePath, location);

    consola.success(`Created ${location} workspace "${wsName}" at ${result.workspacePath}`);
    consola.info(`Configuration: ${result.configPath}`);

    if (finalProfileName) {
      setActiveContext(wsName, finalProfileName);
      await reloadWorkspaceState(state, wsName);
      consola.info(`Profile "${finalProfileName}" created and activated`);
    } else {
      setActiveContext(wsName, undefined);
      await reloadWorkspaceState(state, wsName);
      consola.info('No profile created. Use "profile create <name> --base-url <url>" to add one.');
    }

    consola.info('');
    consola.info('Next steps:');
    consola.info('  1. Edit .unireq/workspace.yaml to configure your API');
    consola.info('  2. Use "workspace doctor" to validate configuration');
  } catch (error) {
    consola.error(`Failed to initialize workspace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Handle 'workspace current' - show current workspace and profile
 */
function handleCurrent(): void {
  const { workspace, profile } = getActiveContext();

  if (!workspace) {
    consola.info('No workspace selected.');
    consola.info('Use "workspace use <name>" to select one.');

    // Check for local workspace
    const localWorkspace = findWorkspace();
    if (localWorkspace) {
      consola.info('');
      consola.info(`Local workspace detected at ${localWorkspace.path}`);
      consola.info('Use "workspace use (local)" to activate it.');
    }
    return;
  }

  consola.info(`Workspace: ${workspace}`);
  if (profile) {
    consola.info(`Profile: ${profile}`);
  } else {
    consola.info('Profile: (none selected)');
  }
}

/**
 * Format a check result for display
 */
function formatCheckResult(check: DoctorResult['checks'][0]): string {
  // Determine icon based on passed AND severity
  let icon: string;
  if (!check.passed) {
    icon = check.severity === 'error' ? '✗' : '⚠';
  } else if (check.severity === 'warning') {
    icon = '⚠'; // Informational warning (passed but noteworthy)
  } else {
    icon = '✓';
  }

  const line = `${icon} ${check.name}: ${check.message}`;
  if (check.details) {
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
      // Try to use active workspace
      const activeWorkspace = getActiveWorkspace();
      if (activeWorkspace && activeWorkspace !== '(local)') {
        const ws = getWorkspace(activeWorkspace);
        if (ws) {
          targetPath = ws.path;
        } else {
          consola.error('Active workspace not found in registry.');
          return;
        }
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

  // Show ALL checks with their status
  for (const check of doctorResult.checks) {
    const formatted = formatCheckResult(check);
    if (!check.passed) {
      if (check.severity === 'error') {
        consola.error(formatted);
      } else {
        consola.warn(formatted);
      }
    } else if (check.severity === 'warning') {
      // Informational warning (passed but noteworthy)
      consola.warn(formatted);
    } else {
      consola.success(formatted);
    }
  }

  consola.info('');

  // Show summary
  if (doctorResult.success) {
    if (doctorResult.warnings > 0) {
      consola.info(`Summary: ${doctorResult.passed} passed, ${doctorResult.warnings} warning(s)`);
    } else {
      consola.success(`All ${doctorResult.passed} checks passed`);
    }
  } else {
    consola.error(`Summary: ${doctorResult.errors} error(s), ${doctorResult.warnings} warning(s)`);
  }
}

/**
 * Workspace command handler
 * Handles: workspace init|list|register|unregister|use|current|doctor
 */
export const workspaceHandler: CommandHandler = async (args, state) => {
  const subcommand = args[0]?.toLowerCase();
  const isReplMode = state.isReplMode;

  switch (subcommand) {
    case 'init':
      return handleInit(args.slice(1), isReplMode, state);

    case 'list':
    case 'ls':
      return handleList();

    case 'register':
    case 'add':
      return handleRegister(args[1], args[2], isReplMode);

    case 'unregister':
    case 'remove':
    case 'rm':
      return handleUnregister(args[1], isReplMode);

    case 'use':
    case 'switch':
      return handleUse(args[1], isReplMode, state);

    case 'current':
      return handleCurrent();

    case 'doctor':
    case 'check':
      return handleDoctor(args[1]);

    case undefined:
      // No subcommand - show current context
      return handleCurrent();

    default:
      consola.warn(`Unknown subcommand: ${subcommand}`);
      consola.info('Available: workspace [list|register|unregister|use|current|doctor|init]');
  }
};

/**
 * Create workspace command
 */
export function createWorkspaceCommand(): Command {
  return {
    name: 'workspace',
    description: 'Manage workspaces (list|register|unregister|use|current|doctor|init)',
    handler: workspaceHandler,
  };
}
