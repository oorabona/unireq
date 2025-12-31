/**
 * Tests for profile management REPL commands
 * Following AAA pattern for unit tests
 */

import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplState } from '../../../repl/state.js';
import type { WorkspaceConfig } from '../../config/types.js';
import { createProfileCommand, profileHandler } from '../commands.js';

// Mock consola
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  },
}));

/**
 * Helper to create a minimal WorkspaceConfig for testing
 */
function createConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return {
    version: 1,
    openapi: { cache: { enabled: true, ttlMs: 86400000 } },
    profiles: {},
    auth: { providers: {} },
    vars: {},
    ...overrides,
  };
}

/**
 * Helper to create ReplState with workspace config
 */
function createState(config?: WorkspaceConfig, activeProfile?: string): ReplState {
  return {
    currentPath: '/',
    running: true,
    workspaceConfig: config,
    activeProfile,
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
        profiles: { dev: {}, staging: {}, prod: {} },
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

    it('should mark active profile', async () => {
      // Arrange
      const config = createConfig({
        activeProfile: 'staging',
        profiles: { dev: {}, staging: {}, prod: {} },
      });
      const state = createState(config);

      // Act
      await profileHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('  staging (active)');
    });

    it('should mark runtime active profile', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {}, staging: {}, prod: {} },
      });
      const state = createState(config, 'prod');

      // Act
      await profileHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('  prod (active)');
    });

    it('should default to list when no subcommand', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {} },
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
        profiles: { dev: {}, prod: {} },
      });
      const state = createState(config);

      // Act
      await profileHandler(['use', 'prod'], state);

      // Assert
      expect(state.activeProfile).toBe('prod');
      expect(consola.info).toHaveBeenCalledWith('Switched to profile: prod');
    });

    it('should warn when profile does not exist', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {}, prod: {} },
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
        profiles: { dev: {} },
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
        baseUrl: 'https://api.example.com',
        profiles: {
          dev: {
            baseUrl: 'https://dev.api.example.com',
            headers: { 'X-Env': 'dev' },
            timeoutMs: 60000,
            verifyTls: false,
            vars: { env: 'development' },
          },
        },
        vars: { tenantId: 'demo' },
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
      const state = createState(config);

      // Act
      await profileHandler(['show'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No active profile.');
    });
  });

  describe('unknown subcommand', () => {
    it('should show warning for unknown subcommand', async () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {} },
      });
      const state = createState(config);

      // Act
      await profileHandler(['unknown'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Unknown subcommand: unknown');
      expect(consola.info).toHaveBeenCalledWith('Available: profile list, profile use <name>, profile show');
    });
  });
});

describe('createProfileCommand', () => {
  it('should create command with correct properties', () => {
    // Act
    const command = createProfileCommand();

    // Assert
    expect(command.name).toBe('profile');
    expect(command.description).toBe('Manage environment profiles (list, use, show)');
    expect(command.handler).toBe(profileHandler);
  });
});
