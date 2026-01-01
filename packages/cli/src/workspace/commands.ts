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
 * Workspace command handler
 * Handles: workspace init [dir]
 */
export const workspaceHandler: CommandHandler = async (args, _state) => {
  const subcommand = args[0]?.toLowerCase();

  if (!subcommand || subcommand === 'init') {
    const targetDir = args[1];
    return handleInit(targetDir);
  }

  // Unknown subcommand
  consola.warn(`Unknown subcommand: ${subcommand}`);
  consola.info('Available: workspace init [dir]');
};

/**
 * Create workspace command
 */
export function createWorkspaceCommand(): Command {
  return {
    name: 'workspace',
    description: 'Manage workspaces (init)',
    handler: workspaceHandler,
  };
}
