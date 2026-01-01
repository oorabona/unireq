/**
 * Tests for auth management REPL commands
 * Following AAA pattern for unit tests
 */

import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { ReplState } from '../../repl/state.js';
import type { IVault, VaultState } from '../../secrets/types.js';
import type { WorkspaceConfig } from '../../workspace/config/types.js';
import { authHandler, createAuthCommand } from '../commands.js';
import type { AuthConfig } from '../types.js';

// Create mocks with vi.hoisted (hoisted before mocks)
const { isCancelMock, mockResolveLoginJwtProvider, mockResolveOAuth2Provider } = vi.hoisted(() => ({
  isCancelMock: vi.fn(() => false),
  mockResolveLoginJwtProvider: vi.fn(),
  mockResolveOAuth2Provider: vi.fn(),
}));

// Mock consola
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  password: vi.fn(),
  confirm: vi.fn(),
  isCancel: isCancelMock,
}));

// Mock login-jwt provider (network requests need MSW which is tested separately)
vi.mock('../providers/login-jwt.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../providers/login-jwt.js')>();
  return {
    ...original,
    resolveLoginJwtProvider: mockResolveLoginJwtProvider,
  };
});

// Mock oauth2-client-credentials provider (network requests need MSW which is tested separately)
vi.mock('../providers/oauth2-client-credentials.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../providers/oauth2-client-credentials.js')>();
  return {
    ...original,
    resolveOAuth2ClientCredentialsProvider: mockResolveOAuth2Provider,
  };
});

// Import mocked modules
import * as clack from '@clack/prompts';

/**
 * Create a mock vault for testing
 */
function createMockVault(overrides: Partial<IVault> = {}): IVault {
  const secrets: Map<string, string> = new Map();
  let state: VaultState = 'unlocked';

  return {
    getState: vi.fn(() => state),
    exists: vi.fn(async () => true),
    initialize: vi.fn(async () => {
      state = 'unlocked';
    }),
    unlock: vi.fn(async () => {
      state = 'unlocked';
    }),
    lock: vi.fn(() => {
      state = 'locked';
    }),
    get: vi.fn((name: string) => secrets.get(name)),
    set: vi.fn(async (name: string, value: string) => {
      secrets.set(name, value);
    }),
    delete: vi.fn(async (name: string) => {
      secrets.delete(name);
    }),
    list: vi.fn(() => Array.from(secrets.keys())),
    ...overrides,
  };
}

/**
 * Create a minimal AuthConfig for testing
 */
function createAuthConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    providers: {},
    ...overrides,
  };
}

/**
 * Create a minimal WorkspaceConfig for testing
 */
function createWorkspaceConfig(authConfig: AuthConfig = createAuthConfig()): WorkspaceConfig {
  return {
    version: 1,
    openapi: { cache: { enabled: true, ttlMs: 86400000 } },
    profiles: {},
    auth: authConfig,
    vars: {},
  };
}

/**
 * Create ReplState with optional workspace config and vault
 */
function createState(workspaceConfig?: WorkspaceConfig, vault?: IVault): ReplState {
  return {
    currentPath: '/',
    running: true,
    workspaceConfig,
    vault,
  };
}

describe('authHandler', () => {
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
      await authHandler([], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No workspace loaded.');
      expect(consola.info).toHaveBeenCalledWith('Auth management requires a workspace with auth configuration.');
    });
  });

  describe('auth status', () => {
    it('should show status when no providers configured', async () => {
      // Arrange
      const state = createState(createWorkspaceConfig());

      // Act
      await authHandler(['status'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nAuth Status:');
      expect(consola.info).toHaveBeenCalledWith('Providers: None configured');
    });

    it('should show status with provider count and active', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        active: 'main',
        providers: {
          main: { type: 'api_key', location: 'header', name: 'X-API-Key', value: 'test' },
          backup: { type: 'bearer', token: 'token123' },
        },
      });
      const state = createState(createWorkspaceConfig(authConfig));

      // Act
      await authHandler(['status'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('Providers: 2 configured');
      expect(consola.info).toHaveBeenCalledWith('Active: main [api_key]');
    });

    it('should default to status when no subcommand', async () => {
      // Arrange
      const state = createState(createWorkspaceConfig());

      // Act
      await authHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nAuth Status:');
    });
  });

  describe('auth list', () => {
    it('should show message when no providers configured', async () => {
      // Arrange
      const state = createState(createWorkspaceConfig());

      // Act
      await authHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No auth providers configured.');
    });

    it('should list all providers with types', async () => {
      // Arrange
      // Note: When no explicit 'active' is set, getActiveProviderName falls back to first provider
      const authConfig = createAuthConfig({
        providers: {
          main: { type: 'api_key', location: 'header', name: 'X-API-Key', value: 'test' },
          backup: { type: 'bearer', token: 'token123' },
        },
      });
      const state = createState(createWorkspaceConfig(authConfig));

      // Act
      await authHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nAuth Providers:');
      // First provider is auto-selected as active when no explicit active is set
      expect(consola.info).toHaveBeenCalledWith('  main [api_key] (active)');
      expect(consola.info).toHaveBeenCalledWith('  backup [bearer]');
    });

    it('should mark active provider', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        active: 'backup',
        providers: {
          main: { type: 'api_key', location: 'header', name: 'X-API-Key', value: 'test' },
          backup: { type: 'bearer', token: 'token123' },
        },
      });
      const state = createState(createWorkspaceConfig(authConfig));

      // Act
      await authHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('  backup [bearer] (active)');
    });

    it('should accept ls as alias for list', async () => {
      // Arrange
      const state = createState(createWorkspaceConfig());

      // Act
      await authHandler(['ls'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No auth providers configured.');
    });
  });

  describe('auth use', () => {
    it('should warn when no provider name provided', async () => {
      // Arrange
      const state = createState(createWorkspaceConfig());

      // Act
      await authHandler(['use'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Usage: auth use <provider>');
    });

    it('should warn when provider does not exist', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        providers: {
          main: { type: 'api_key', location: 'header', name: 'X-API-Key', value: 'test' },
        },
      });
      const state = createState(createWorkspaceConfig(authConfig));

      // Act
      await authHandler(['use', 'nonexistent'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith("Provider 'nonexistent' not found.");
      expect(consola.info).toHaveBeenCalledWith('Available providers: main');
    });

    it('should switch to existing provider', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        providers: {
          main: { type: 'api_key', location: 'header', name: 'X-API-Key', value: 'test' },
          backup: { type: 'bearer', token: 'token123' },
        },
      });
      const workspaceConfig = createWorkspaceConfig(authConfig);
      const state = createState(workspaceConfig);

      // Act
      await authHandler(['use', 'backup'], state);

      // Assert
      expect(workspaceConfig.auth.active).toBe('backup');
      expect(consola.success).toHaveBeenCalledWith('Switched to auth provider: backup');
    });
  });

  describe('auth show', () => {
    it('should warn when no provider specified and no active', async () => {
      // Arrange
      const state = createState(createWorkspaceConfig());

      // Act
      await authHandler(['show'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No provider specified and no active provider set.');
    });

    it('should show api_key provider details', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        active: 'main',
        providers: {
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
          main: { type: 'api_key', location: 'header', name: 'X-API-Key', value: '${secret:api_key}' },
        },
      });
      const state = createState(createWorkspaceConfig(authConfig));

      // Act
      await authHandler(['show'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nProvider: main');
      expect(consola.info).toHaveBeenCalledWith('Type: api_key');
      expect(consola.info).toHaveBeenCalledWith('Location: header');
      expect(consola.info).toHaveBeenCalledWith('Name: X-API-Key');
    });

    it('should show bearer provider details', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        providers: {
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
          token: { type: 'bearer', token: '${secret:token}', prefix: 'JWT' },
        },
      });
      const state = createState(createWorkspaceConfig(authConfig));

      // Act
      await authHandler(['show', 'token'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nProvider: token');
      expect(consola.info).toHaveBeenCalledWith('Type: bearer');
      expect(consola.info).toHaveBeenCalledWith('Prefix: JWT');
    });
  });

  describe('auth login', () => {
    it('should warn when no provider and no active', async () => {
      // Arrange
      const state = createState(createWorkspaceConfig());

      // Act
      await authHandler(['login'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No auth provider specified and no active provider set.');
    });

    it('should warn when provider not found', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        providers: {
          main: { type: 'api_key', location: 'header', name: 'X-API-Key', value: 'test' },
        },
      });
      const state = createState(createWorkspaceConfig(authConfig));

      // Act
      await authHandler(['login', 'nonexistent'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith("Provider 'nonexistent' not found.");
    });

    it('should resolve api_key provider and display credential', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        providers: {
          main: { type: 'api_key', location: 'header', name: 'X-API-Key', value: 'my-api-key-value' },
        },
      });
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(false); // No vault needed for static value
      (clack.confirm as Mock).mockResolvedValueOnce(true); // Show value
      const state = createState(createWorkspaceConfig(authConfig), vault);

      // Act
      await authHandler(['login', 'main'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nProvider: main');
      expect(consola.info).toHaveBeenCalledWith('Location: header');
      expect(consola.info).toHaveBeenCalledWith('Name: X-API-Key');
      expect(consola.info).toHaveBeenCalledWith('Value: my-api-key-value');
      expect(consola.success).toHaveBeenCalledWith('Credential resolved successfully.');
    });

    it('should resolve bearer provider and mask value when not confirmed', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        providers: {
          token: { type: 'bearer', token: 'secret-token-12345678' },
        },
      });
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(false);
      (clack.confirm as Mock).mockResolvedValueOnce(false); // Don't show value
      const state = createState(createWorkspaceConfig(authConfig), vault);

      // Act
      await authHandler(['login', 'token'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nProvider: token');
      expect(consola.info).toHaveBeenCalledWith('Name: Authorization');
      // Value should be masked
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('****'));
      expect(consola.success).toHaveBeenCalledWith('Credential resolved successfully.');
    });

    it('should use active provider when none specified', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        active: 'main',
        providers: {
          main: { type: 'api_key', location: 'query', name: 'key', value: 'test-key' },
        },
      });
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(false);
      (clack.confirm as Mock).mockResolvedValueOnce(false);
      const state = createState(createWorkspaceConfig(authConfig), vault);

      // Act
      await authHandler(['login'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nProvider: main');
      expect(consola.success).toHaveBeenCalledWith('Credential resolved successfully.');
    });

    it('should resolve login_jwt provider and display credential', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        providers: {
          jwt: {
            type: 'login_jwt',
            login: { method: 'POST', url: '/auth/login', body: {} },
            extract: { token: '$.token' },
            // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
            inject: { location: 'header', name: 'Authorization', format: 'Bearer ${token}' },
          },
        },
      });
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(false);
      const state = createState(createWorkspaceConfig(authConfig), vault);

      // Mock login-jwt provider to return a credential
      mockResolveLoginJwtProvider.mockResolvedValue({
        location: 'header',
        name: 'Authorization',
        value: 'Bearer jwt-token-12345',
      });

      // Mock confirm to decline showing value
      (clack.confirm as Mock).mockResolvedValue(false);

      // Act
      await authHandler(['login', 'jwt'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith("Executing login request for provider 'jwt'...");
      expect(mockResolveLoginJwtProvider).toHaveBeenCalled();
      expect(consola.success).toHaveBeenCalledWith('Credential resolved successfully.');
    });

    it('should resolve oauth2_client_credentials provider and display credential', async () => {
      // Arrange
      const authConfig = createAuthConfig({
        providers: {
          oauth: {
            type: 'oauth2_client_credentials',
            tokenUrl: 'https://auth.example.com/oauth/token',
            clientId: 'client-id',
            clientSecret: 'client-secret',
            // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
            inject: { location: 'header', name: 'Authorization', format: 'Bearer ${token}' },
          },
        },
      });
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(false);
      const state = createState(createWorkspaceConfig(authConfig), vault);

      // Mock OAuth2 provider to return credential
      mockResolveOAuth2Provider.mockResolvedValue({
        location: 'header',
        name: 'Authorization',
        value: 'Bearer oauth2-access-token',
      });

      // Mock confirm to decline showing value
      (clack.confirm as Mock).mockResolvedValue(false);

      // Act
      await authHandler(['login', 'oauth'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith("Requesting OAuth2 token for provider 'oauth'...");
      expect(mockResolveOAuth2Provider).toHaveBeenCalled();
      expect(consola.success).toHaveBeenCalledWith('Credential resolved successfully.');
    });
  });

  describe('unknown subcommand', () => {
    it('should show warning for unknown subcommand', async () => {
      // Arrange
      const state = createState(createWorkspaceConfig());

      // Act
      await authHandler(['unknown'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Unknown subcommand: unknown');
      expect(consola.info).toHaveBeenCalledWith(
        'Available: auth list, auth use <provider>, auth login [provider], auth show [provider], auth status',
      );
    });
  });
});

describe('createAuthCommand', () => {
  it('should create command with correct properties', () => {
    // Act
    const command = createAuthCommand();

    // Assert
    expect(command.name).toBe('auth');
    expect(command.description).toBe('Manage authentication providers (list, use, login, status)');
    expect(command.handler).toBe(authHandler);
  });
});
