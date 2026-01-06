/**
 * Context Resolver Tests
 *
 * Tests for kubectl-like workspace/profile resolution with priority handling.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatContext,
  getProfileFromEnv,
  getWorkspaceFromEnv,
  resolveContext,
  UNIREQ_PROFILE_ENV,
  UNIREQ_WORKSPACE_ENV,
} from '../context-resolver.js';
import { UNIREQ_HOME_ENV } from '../paths.js';

describe('Context Resolver', () => {
  let testDir: string;
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Create isolated test directory
    testDir = join('/tmp', `unireq-context-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    // Save and clear env vars
    originalEnv = {
      [UNIREQ_HOME_ENV]: process.env[UNIREQ_HOME_ENV],
      [UNIREQ_WORKSPACE_ENV]: process.env[UNIREQ_WORKSPACE_ENV],
      [UNIREQ_PROFILE_ENV]: process.env[UNIREQ_PROFILE_ENV],
    };

    // Set test home
    process.env[UNIREQ_HOME_ENV] = testDir;
    delete process.env[UNIREQ_WORKSPACE_ENV];
    delete process.env[UNIREQ_PROFILE_ENV];
  });

  afterEach(() => {
    // Restore original env vars
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getWorkspaceFromEnv', () => {
    it('should return undefined when env var not set', () => {
      // Act
      const result = getWorkspaceFromEnv();

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return workspace name from UNIREQ_WORKSPACE (S-5)', () => {
      // Arrange
      process.env[UNIREQ_WORKSPACE_ENV] = 'ci-workspace';

      // Act
      const result = getWorkspaceFromEnv();

      // Assert
      expect(result).toBe('ci-workspace');
    });

    it('should trim whitespace from value', () => {
      // Arrange
      process.env[UNIREQ_WORKSPACE_ENV] = '  my-workspace  ';

      // Act
      const result = getWorkspaceFromEnv();

      // Assert
      expect(result).toBe('my-workspace');
    });

    it('should treat empty string as not set', () => {
      // Arrange
      process.env[UNIREQ_WORKSPACE_ENV] = '';

      // Act
      const result = getWorkspaceFromEnv();

      // Assert
      expect(result).toBeUndefined();
    });

    it('should treat whitespace-only as not set', () => {
      // Arrange
      process.env[UNIREQ_WORKSPACE_ENV] = '   ';

      // Act
      const result = getWorkspaceFromEnv();

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getProfileFromEnv', () => {
    it('should return undefined when env var not set', () => {
      // Act
      const result = getProfileFromEnv();

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return profile name from UNIREQ_PROFILE (S-6)', () => {
      // Arrange
      process.env[UNIREQ_PROFILE_ENV] = 'ci';

      // Act
      const result = getProfileFromEnv();

      // Assert
      expect(result).toBe('ci');
    });

    it('should trim whitespace from value', () => {
      // Arrange
      process.env[UNIREQ_PROFILE_ENV] = '  admin  ';

      // Act
      const result = getProfileFromEnv();

      // Assert
      expect(result).toBe('admin');
    });
  });

  describe('resolveContext', () => {
    it('should return none source when nothing is set', () => {
      // Act
      const result = resolveContext();

      // Assert
      expect(result.workspace).toBeUndefined();
      expect(result.workspaceSource).toBe('none');
      expect(result.profile).toBeUndefined();
      expect(result.profileSource).toBe('none');
    });

    it('should prioritize flag over env var (S-11 - S-3)', () => {
      // Arrange
      process.env[UNIREQ_WORKSPACE_ENV] = 'env-workspace';

      // Act
      const result = resolveContext({ workspaceFlag: 'flag-workspace' });

      // Assert
      expect(result.workspace).toBe('flag-workspace');
      expect(result.workspaceSource).toBe('flag');
    });

    it('should prioritize flag over env var for profile (S-11 - S-4)', () => {
      // Arrange
      process.env[UNIREQ_PROFILE_ENV] = 'env-profile';

      // Act
      const result = resolveContext({ profileFlag: 'flag-profile' });

      // Assert
      expect(result.profile).toBe('flag-profile');
      expect(result.profileSource).toBe('flag');
    });

    it('should use env var when flag not provided (S-5)', () => {
      // Arrange
      process.env[UNIREQ_WORKSPACE_ENV] = 'ci-workspace';

      // Act
      const result = resolveContext();

      // Assert
      expect(result.workspace).toBe('ci-workspace');
      expect(result.workspaceSource).toBe('env');
    });

    it('should use env var for profile when flag not provided (S-6)', () => {
      // Arrange
      process.env[UNIREQ_PROFILE_ENV] = 'ci';

      // Act
      const result = resolveContext();

      // Assert
      expect(result.profile).toBe('ci');
      expect(result.profileSource).toBe('env');
    });

    it('should use global config when env var not set', () => {
      // Arrange - create config.yaml with active workspace/profile
      const configContent = `version: 1
activeWorkspace: config-workspace
activeProfile: config-profile
`;
      writeFileSync(join(testDir, 'config.yaml'), configContent);

      // Act
      const result = resolveContext();

      // Assert
      expect(result.workspace).toBe('config-workspace');
      expect(result.workspaceSource).toBe('config');
      expect(result.profile).toBe('config-profile');
      expect(result.profileSource).toBe('config');
    });

    it('should use workspace activeProfile as fallback', () => {
      // Act
      const result = resolveContext({ workspaceActiveProfile: 'workspace-default' });

      // Assert
      expect(result.profile).toBe('workspace-default');
      expect(result.profileSource).toBe('workspace');
    });

    it('should not use workspace activeProfile when env var is set', () => {
      // Arrange
      process.env[UNIREQ_PROFILE_ENV] = 'env-profile';

      // Act
      const result = resolveContext({ workspaceActiveProfile: 'workspace-default' });

      // Assert
      expect(result.profile).toBe('env-profile');
      expect(result.profileSource).toBe('env');
    });
  });

  describe('formatContext', () => {
    it('should format context with workspace and profile', () => {
      // Arrange
      const context = {
        workspace: 'myworkspace',
        workspaceSource: 'flag' as const,
        profile: 'prod',
        profileSource: 'env' as const,
      };

      // Act
      const result = formatContext(context);

      // Assert
      expect(result).toBe('workspace=myworkspace (flag), profile=prod (env)');
    });

    it('should format context with workspace only', () => {
      // Arrange
      const context = {
        workspace: 'myworkspace',
        workspaceSource: 'config' as const,
        profile: undefined,
        profileSource: 'none' as const,
      };

      // Act
      const result = formatContext(context);

      // Assert
      expect(result).toBe('workspace=myworkspace (config)');
    });

    it('should format empty context', () => {
      // Arrange
      const context = {
        workspace: undefined,
        workspaceSource: 'none' as const,
        profile: undefined,
        profileSource: 'none' as const,
      };

      // Act
      const result = formatContext(context);

      // Assert
      expect(result).toBe('no context');
    });
  });
});
