/**
 * Tests for profile management REPL commands (kubectl-inspired model)
 * Following AAA pattern for unit tests
 *
 * Note: In kubectl model:
 * - activeProfile is in GlobalConfig and ReplState, not WorkspaceConfig
 * - baseUrl is required per-profile (not at workspace level)
 * - vars are per-profile only (no workspace-level vars)
 */

import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplState } from '../../../repl/state.js';
import type { WorkspaceConfig } from '../../config/types.js';
import * as globalConfig from '../../global-config.js';
import { createProfileCommand, profileHandler } from '../commands.js';

// Mock consola
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

// Mock global-config
vi.mock('../../global-config.js', () => ({
  getActiveProfile: vi.fn(() => undefined),
  setActiveProfile: vi.fn(),
}));

// Mock config loader
vi.mock('../../config/loader.js', () => ({
  saveWorkspaceConfig: vi.fn(),
}));

import * as configLoader from '../../config/loader.js';

/**
 * Helper to create a minimal WorkspaceConfig for testing (version 2, kubectl model)
 */
function createConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return {
    version: 2,
    name: 'test-workspace',
    openapi: { cache: { enabled: true, ttlMs: 86400000 } },
    profiles: {},
    auth: { providers: {} },
    secrets: {},
    ...overrides,
  };
}

/**
 * Helper to create ReplState with workspace config
 */
function createState(config?: WorkspaceConfig, activeProfile?: string, workspace?: string): ReplState {
  return {
    currentPath: '/',
    running: true,
    workspaceConfig: config,
    activeProfile,
    workspace,
  };
}

describe('profileHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when no workspace is loaded', () => {
    it('should show warning message', async () => {
      // Arrange
      const state = createState();

      // Act
      await profileHandler([], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No workspace loaded.');
      expect(consola.info).toHaveBeenCalledWith('Profile management requires a workspace.');
    });
  });

  describe('profile list', () => {
    it('should show message when no profiles defined', async () => {
      // Arrange
      const config = createConfig({ profiles: {} });
      const state = createState(config);

      // Act
      await profileHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No profiles defined.');
    });

    it('should list all profiles', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
          staging: { baseUrl: 'https://staging.api.example.com' },
          prod: { baseUrl: 'https://api.example.com' },
        },
      });
      const state = createState(config);

      // Act
      await profileHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nProfiles:');
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('dev'));
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('staging'));
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('prod'));
    });

    it('should mark active profile from GlobalConfig', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
          staging: { baseUrl: 'https://staging.api.example.com' },
          prod: { baseUrl: 'https://api.example.com' },
        },
      });
      vi.mocked(globalConfig.getActiveProfile).mockReturnValue('staging');
      const state = createState(config);

      // Act
      await profileHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('  staging (active)');
    });

    it('should mark runtime active profile over GlobalConfig', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
          staging: { baseUrl: 'https://staging.api.example.com' },
          prod: { baseUrl: 'https://api.example.com' },
        },
      });
      vi.mocked(globalConfig.getActiveProfile).mockReturnValue('staging');
      const state = createState(config, 'prod'); // Runtime overrides GlobalConfig

      // Act
      await profileHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('  prod (active)');
    });

    it('should default to list when no subcommand', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
        },
      });
      const state = createState(config);

      // Act
      await profileHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nProfiles:');
    });
  });

  describe('profile use', () => {
    it('should switch to existing profile', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
          prod: { baseUrl: 'https://api.example.com' },
        },
      });
      const state = createState(config);

      // Act
      await profileHandler(['use', 'prod'], state);

      // Assert
      expect(state.activeProfile).toBe('prod');
      expect(globalConfig.setActiveProfile).toHaveBeenCalledWith('prod');
      expect(consola.info).toHaveBeenCalledWith('Switched to profile: prod');
    });

    it('should warn when profile does not exist', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
          prod: { baseUrl: 'https://api.example.com' },
        },
      });
      const state = createState(config);

      // Act
      await profileHandler(['use', 'nonexistent'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith("Profile 'nonexistent' not found.");
      expect(consola.info).toHaveBeenCalledWith('Available profiles: dev, prod');
    });

    it('should warn when no profile name provided', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
        },
      });
      const state = createState(config);

      // Act
      await profileHandler(['use'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Usage: profile use <name>');
    });
  });

  describe('profile show', () => {
    it('should show profile details', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: {
            baseUrl: 'https://dev.api.example.com',
            headers: { 'X-Env': 'dev' },
            timeoutMs: 60000,
            verifyTls: false,
            vars: { env: 'development' },
          },
        },
      });
      const state = createState(config, 'dev');

      // Act
      await profileHandler(['show'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nProfile: dev');
      expect(consola.info).toHaveBeenCalledWith('Base URL: https://dev.api.example.com');
      expect(consola.info).toHaveBeenCalledWith('Timeout: 60000ms');
      expect(consola.info).toHaveBeenCalledWith('Verify TLS: false');
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Headers'));
      expect(consola.info).toHaveBeenCalledWith('  X-Env: dev');
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Variables'));
    });

    it('should show message when no active profile', async () => {
      // Arrange
      const config = createConfig({ profiles: {} });
      vi.mocked(globalConfig.getActiveProfile).mockReturnValue(undefined);
      const state = createState(config);

      // Act
      await profileHandler(['show'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No active profile.');
    });

    it('should show profile from GlobalConfig when no runtime active', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          staging: {
            baseUrl: 'https://staging.api.example.com',
          },
        },
      });
      vi.mocked(globalConfig.getActiveProfile).mockReturnValue('staging');
      const state = createState(config); // No runtime active profile

      // Act
      await profileHandler(['show'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nProfile: staging');
      expect(consola.info).toHaveBeenCalledWith('Base URL: https://staging.api.example.com');
    });

    it('should show merged secrets (workspace + profile)', async () => {
      // Arrange
      const config = createConfig({
        secrets: { SHARED_KEY: 'shared-value' },
        profiles: {
          dev: {
            baseUrl: 'https://dev.api.example.com',
            secrets: { DEV_KEY: 'dev-value' },
          },
        },
      });
      const state = createState(config, 'dev');

      // Act
      await profileHandler(['show'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Secrets'));
      expect(consola.info).toHaveBeenCalledWith('  SHARED_KEY: ********');
      expect(consola.info).toHaveBeenCalledWith('  DEV_KEY: ********');
    });
  });

  describe('unknown subcommand', () => {
    it('should show warning for unknown subcommand', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
        },
      });
      const state = createState(config);

      // Act
      await profileHandler(['unknown'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Unknown subcommand: unknown');
      expect(consola.info).toHaveBeenCalledWith('Available: profile [list|create|rename|delete|use|show|edit]');
    });
  });

  describe('profile create', () => {
    it('should show usage when no name provided', async () => {
      // Arrange
      const config = createConfig();
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['create'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith(
        'Usage: profile create <name> [--base-url <url>] [--from <source>] [--copy-vars|--copy-secrets|--copy-all]',
      );
    });

    it('should show warning when no workspace loaded', async () => {
      // Arrange
      const state = createState();

      // Act
      await profileHandler(['create', 'dev'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No workspace loaded.');
    });

    it('should create profile with default baseUrl', async () => {
      // Arrange
      const config = createConfig({ profiles: {} });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['create', 'dev'], state);

      // Assert
      expect(configLoader.saveWorkspaceConfig).toHaveBeenCalled();
      expect(config.profiles?.['dev']).toBeDefined();
      expect(config.profiles?.['dev']?.baseUrl).toBe('http://localhost:3000');
      expect(consola.info).toHaveBeenCalledWith("Created profile 'dev'");
    });

    it('should create profile with specified baseUrl', async () => {
      // Arrange
      const config = createConfig({ profiles: {} });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['create', 'prod', '--base-url', 'https://api.example.com'], state);

      // Assert
      expect(config.profiles?.['prod']?.baseUrl).toBe('https://api.example.com');
    });

    it('should warn when profile already exists', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.example.com' } },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['create', 'dev'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith("Profile 'dev' already exists.");
      expect(configLoader.saveWorkspaceConfig).not.toHaveBeenCalled();
    });

    it('should clone profile with --from option', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: {
            baseUrl: 'https://dev.example.com',
            headers: { 'X-Env': 'dev' },
            timeoutMs: 5000,
          },
        },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['create', 'staging', '--from', 'dev'], state);

      // Assert
      expect(config.profiles?.['staging']?.baseUrl).toBe('https://dev.example.com');
      expect(config.profiles?.['staging']?.headers).toEqual({ 'X-Env': 'dev' });
      expect(config.profiles?.['staging']?.timeoutMs).toBe(5000);
    });

    it('should copy vars with --copy-vars option', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: {
            baseUrl: 'https://dev.example.com',
            vars: { env: 'development', debug: 'true' },
          },
        },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['create', 'staging', '--from', 'dev', '--copy-vars'], state);

      // Assert
      expect(config.profiles?.['staging']?.vars).toEqual({ env: 'development', debug: 'true' });
    });

    it('should copy secrets with --copy-secrets option', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: {
            baseUrl: 'https://dev.example.com',
            secrets: { API_KEY: '{{secret:dev-key}}' },
          },
        },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['create', 'staging', '--from', 'dev', '--copy-secrets'], state);

      // Assert
      expect(config.profiles?.['staging']?.secrets).toEqual({ API_KEY: '{{secret:dev-key}}' });
    });

    it('should copy both with --copy-all option', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: {
            baseUrl: 'https://dev.example.com',
            vars: { env: 'development' },
            secrets: { API_KEY: '{{secret:dev-key}}' },
          },
        },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['create', 'staging', '--from', 'dev', '--copy-all'], state);

      // Assert
      expect(config.profiles?.['staging']?.vars).toEqual({ env: 'development' });
      expect(config.profiles?.['staging']?.secrets).toEqual({ API_KEY: '{{secret:dev-key}}' });
    });

    it('should auto-select first profile as active', async () => {
      // Arrange
      const config = createConfig({ profiles: {} });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['create', 'dev', '--base-url', 'https://dev.example.com'], state);

      // Assert
      expect(state.activeProfile).toBe('dev');
      expect(globalConfig.setActiveProfile).toHaveBeenCalledWith('dev');
    });
  });

  describe('profile rename', () => {
    it('should show usage when arguments missing', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.example.com' } },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['rename', 'dev'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Usage: profile rename <old-name> <new-name>');
    });

    it('should rename profile', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.example.com' } },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['rename', 'dev', 'development'], state);

      // Assert
      expect(config.profiles?.['dev']).toBeUndefined();
      expect(config.profiles?.['development']?.baseUrl).toBe('https://dev.example.com');
      expect(consola.info).toHaveBeenCalledWith("Renamed profile 'dev' to 'development'");
    });

    it('should warn when old profile not found', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.example.com' } },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['rename', 'nonexistent', 'new-name'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith("Profile 'nonexistent' not found.");
    });

    it('should warn when new name already exists', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.example.com' },
          staging: { baseUrl: 'https://staging.example.com' },
        },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['rename', 'dev', 'staging'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith("Profile 'staging' already exists.");
    });

    it('should update active profile when renaming active', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.example.com' } },
      });
      const state = createState(config, 'dev', '/tmp/workspace');

      // Act
      await profileHandler(['rename', 'dev', 'development'], state);

      // Assert
      expect(state.activeProfile).toBe('development');
      expect(globalConfig.setActiveProfile).toHaveBeenCalledWith('development');
    });
  });

  describe('profile delete', () => {
    it('should show usage when name missing', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.example.com' } },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['delete'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Usage: profile delete <name>');
    });

    it('should delete profile', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.example.com' },
          staging: { baseUrl: 'https://staging.example.com' },
        },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['delete', 'dev'], state);

      // Assert
      expect(config.profiles?.['dev']).toBeUndefined();
      expect(config.profiles?.['staging']).toBeDefined();
      expect(consola.info).toHaveBeenCalledWith("Deleted profile 'dev'");
    });

    it('should warn when deleting last profile', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.example.com' } },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['delete', 'dev'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith(
        'This is the last profile. Workspace will have no profiles after deletion.',
      );
      expect(config.profiles?.['dev']).toBeUndefined();
    });

    it('should clear active profile when deleting active', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.example.com' },
          staging: { baseUrl: 'https://staging.example.com' },
        },
      });
      const state = createState(config, 'dev', '/tmp/workspace');

      // Act
      await profileHandler(['delete', 'dev'], state);

      // Assert
      expect(state.activeProfile).toBe('staging'); // Auto-selected next profile
      expect(globalConfig.setActiveProfile).toHaveBeenCalledWith('staging');
    });

    it('should work with rm alias', async () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.example.com' },
          staging: { baseUrl: 'https://staging.example.com' },
        },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['rm', 'dev'], state);

      // Assert
      expect(config.profiles?.['dev']).toBeUndefined();
    });
  });

  describe('profile edit', () => {
    it('should show error when EDITOR not set', async () => {
      // Arrange
      const originalEditor = process.env['EDITOR'];
      const originalVisual = process.env['VISUAL'];
      delete process.env['EDITOR'];
      delete process.env['VISUAL'];

      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.example.com' } },
      });
      const state = createState(config, 'dev', '/tmp/workspace');

      // Act
      await profileHandler(['edit'], state);

      // Assert
      expect(consola.error).toHaveBeenCalledWith('$EDITOR not set. Set it with: export EDITOR=vim');
      expect(consola.info).toHaveBeenCalledWith('Or edit manually: /tmp/workspace/workspace.yaml');

      // Restore
      if (originalEditor) process.env['EDITOR'] = originalEditor;
      if (originalVisual) process.env['VISUAL'] = originalVisual;
    });

    it('should show warning when profile not found', async () => {
      // Arrange
      const originalEditor = process.env['EDITOR'];
      process.env['EDITOR'] = 'vi';

      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.example.com' } },
      });
      const state = createState(config, undefined, '/tmp/workspace');

      // Act
      await profileHandler(['edit', 'nonexistent'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith("Profile 'nonexistent' not found.");

      // Restore
      if (originalEditor) {
        process.env['EDITOR'] = originalEditor;
      } else {
        delete process.env['EDITOR'];
      }
    });
  });
});

describe('createProfileCommand', () => {
  it('should create command with correct properties', () => {
    // Act
    const command = createProfileCommand();

    // Assert
    expect(command.name).toBe('profile');
    expect(command.description).toBe('Manage environment profiles (list, create, rename, delete, use, show, edit)');
    expect(command.handler).toBe(profileHandler);
  });
});
