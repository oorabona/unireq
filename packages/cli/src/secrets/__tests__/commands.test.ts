/**
 * Tests for secret management REPL commands
 * Following AAA pattern for unit tests
 */

import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { ReplState } from '../../repl/state.js';
import { createSecretCommand, secretHandler } from '../commands.js';
import type { IVault, VaultState } from '../types.js';

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
  isCancel: vi.fn(() => false),
}));

// Import mocked modules
import * as clack from '@clack/prompts';

/**
 * Create a mock vault for testing
 */
function createMockVault(overrides: Partial<IVault> = {}): IVault {
  const secrets: Map<string, string> = new Map();
  let state: VaultState = 'not_initialized';

  return {
    getState: vi.fn(() => state),
    exists: vi.fn(async () => state !== 'not_initialized'),
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
 * Create ReplState with optional vault
 */
function createState(vault?: IVault): ReplState {
  return {
    currentPath: '/',
    running: true,
    vault,
  };
}

describe('secretHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('secret status', () => {
    it('should show vault status when no vault loaded', async () => {
      // Arrange
      const state = createState();

      // Act
      await secretHandler(['status'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nVault status: not_initialized');
    });

    it('should show unlocked status with secret count', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.list as Mock).mockReturnValue(['api_key', 'secret_token']);
      const state = createState(vault);

      // Act
      await secretHandler(['status'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nVault status: unlocked');
      expect(consola.info).toHaveBeenCalledWith('Secrets stored: 2');
    });

    it('should default to status when no subcommand', async () => {
      // Arrange
      const state = createState();

      // Act
      await secretHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Vault status:'));
    });
  });

  describe('secret init', () => {
    it('should warn if vault already exists', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(true);
      const state = createState(vault);

      // Act
      await secretHandler(['init'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Vault already exists.');
      expect(consola.info).toHaveBeenCalledWith("Use 'secret unlock' to access it.");
    });

    it('should initialize vault with valid passphrase', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(false);
      (clack.password as Mock).mockResolvedValueOnce('mypassphrase').mockResolvedValueOnce('mypassphrase');
      const state = createState(vault);

      // Act
      await secretHandler(['init'], state);

      // Assert
      expect(vault.initialize).toHaveBeenCalledWith('mypassphrase');
      expect(consola.success).toHaveBeenCalledWith('Vault initialized and unlocked.');
    });

    it('should reject mismatched passphrases', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(false);
      (clack.password as Mock).mockResolvedValueOnce('passphrase1').mockResolvedValueOnce('passphrase2');
      const state = createState(vault);

      // Act
      await secretHandler(['init'], state);

      // Assert
      expect(vault.initialize).not.toHaveBeenCalled();
      expect(consola.error).toHaveBeenCalledWith('Passphrases do not match.');
    });

    it('should handle cancellation during passphrase entry', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(false);
      (clack.password as Mock).mockResolvedValueOnce(Symbol('cancel'));
      (clack.isCancel as Mock).mockReturnValueOnce(true);
      const state = createState(vault);

      // Act
      await secretHandler(['init'], state);

      // Assert
      expect(vault.initialize).not.toHaveBeenCalled();
      expect(consola.info).toHaveBeenCalledWith('Cancelled.');
    });
  });

  describe('secret unlock', () => {
    it('should show message if already unlocked', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      const state = createState(vault);

      // Act
      await secretHandler(['unlock'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('Vault is already unlocked.');
    });

    it('should warn if vault not initialized', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.exists as Mock).mockResolvedValue(false);
      const state = createState(vault);

      // Act
      await secretHandler(['unlock'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Vault not initialized.');
      expect(consola.info).toHaveBeenCalledWith("Use 'secret init' to create a new vault.");
    });

    it('should unlock vault with correct passphrase', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('locked');
      (vault.exists as Mock).mockResolvedValue(true);
      (clack.password as Mock).mockResolvedValueOnce('correct-pass');
      const state = createState(vault);

      // Act
      await secretHandler(['unlock'], state);

      // Assert
      expect(vault.unlock).toHaveBeenCalledWith('correct-pass');
      expect(consola.success).toHaveBeenCalledWith('Vault unlocked.');
    });
  });

  describe('secret lock', () => {
    it('should lock unlocked vault', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      const state = createState(vault);

      // Act
      await secretHandler(['lock'], state);

      // Assert
      expect(vault.lock).toHaveBeenCalled();
      expect(consola.success).toHaveBeenCalledWith('Vault locked.');
    });

    it('should show message if already locked', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('locked');
      const state = createState(vault);

      // Act
      await secretHandler(['lock'], state);

      // Assert
      expect(vault.lock).not.toHaveBeenCalled();
      expect(consola.info).toHaveBeenCalledWith('Vault is already locked.');
    });

    it('should show message if no vault loaded', async () => {
      // Arrange
      const state = createState();

      // Act
      await secretHandler(['lock'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('Vault not loaded.');
    });
  });

  describe('secret set', () => {
    it('should warn if no name provided', async () => {
      // Arrange
      const state = createState();

      // Act
      await secretHandler(['set'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Usage: secret set <name> [value]');
    });

    it('should set secret with inline value', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      const state = createState(vault);

      // Act
      await secretHandler(['set', 'api_key', 'my-secret-value'], state);

      // Assert
      expect(vault.set).toHaveBeenCalledWith('api_key', 'my-secret-value');
      expect(consola.success).toHaveBeenCalledWith("Secret 'api_key' saved.");
    });

    it('should prompt for value if not provided', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (clack.password as Mock).mockResolvedValueOnce('prompted-value');
      const state = createState(vault);

      // Act
      await secretHandler(['set', 'token'], state);

      // Assert
      expect(clack.password).toHaveBeenCalledWith({
        message: "Enter value for 'token':",
        mask: '*',
      });
      expect(vault.set).toHaveBeenCalledWith('token', 'prompted-value');
    });

    it('should unlock vault before setting if locked', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValueOnce('locked').mockReturnValue('unlocked');
      (vault.exists as Mock).mockResolvedValue(true);
      (clack.password as Mock)
        .mockResolvedValueOnce('passphrase') // Unlock
        .mockResolvedValueOnce('secret-value'); // Value prompt
      const state = createState(vault);

      // Act
      await secretHandler(['set', 'mykey'], state);

      // Assert
      expect(vault.unlock).toHaveBeenCalledWith('passphrase');
      expect(vault.set).toHaveBeenCalledWith('mykey', 'secret-value');
    });
  });

  describe('secret get', () => {
    it('should warn if no name provided', async () => {
      // Arrange
      const state = createState();

      // Act
      await secretHandler(['get'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Usage: secret get <name>');
    });

    it('should warn if secret not found', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.get as Mock).mockReturnValue(undefined);
      const state = createState(vault);

      // Act
      await secretHandler(['get', 'nonexistent'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith("Secret 'nonexistent' not found.");
    });

    it('should show secret value when confirmed', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.get as Mock).mockReturnValue('my-secret');
      (clack.confirm as Mock).mockResolvedValueOnce(true);
      const state = createState(vault);

      // Act
      await secretHandler(['get', 'api_key'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('api_key: my-secret');
    });

    it('should not show value when confirmation declined', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.get as Mock).mockReturnValue('my-secret');
      (clack.confirm as Mock).mockResolvedValueOnce(false);
      const state = createState(vault);

      // Act
      await secretHandler(['get', 'api_key'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('Secret exists but value not shown.');
    });
  });

  describe('secret list', () => {
    it('should show message when no secrets stored', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.list as Mock).mockReturnValue([]);
      const state = createState(vault);

      // Act
      await secretHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No secrets stored.');
    });

    it('should list all secret names', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.list as Mock).mockReturnValue(['api_key', 'token', 'password']);
      const state = createState(vault);

      // Act
      await secretHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('\nSecrets (3):');
      expect(consola.info).toHaveBeenCalledWith('  api_key');
      expect(consola.info).toHaveBeenCalledWith('  token');
      expect(consola.info).toHaveBeenCalledWith('  password');
    });
  });

  describe('secret delete', () => {
    it('should warn if no name provided', async () => {
      // Arrange
      const state = createState();

      // Act
      await secretHandler(['delete'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Usage: secret delete <name>');
    });

    it('should warn if secret not found', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.get as Mock).mockReturnValue(undefined);
      const state = createState(vault);

      // Act
      await secretHandler(['delete', 'nonexistent'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith("Secret 'nonexistent' not found.");
    });

    it('should delete secret when confirmed', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.get as Mock).mockReturnValue('value');
      (clack.confirm as Mock).mockResolvedValueOnce(true);
      const state = createState(vault);

      // Act
      await secretHandler(['delete', 'api_key'], state);

      // Assert
      expect(vault.delete).toHaveBeenCalledWith('api_key');
      expect(consola.success).toHaveBeenCalledWith("Secret 'api_key' deleted.");
    });

    it('should not delete when confirmation declined', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.get as Mock).mockReturnValue('value');
      (clack.confirm as Mock).mockResolvedValueOnce(false);
      const state = createState(vault);

      // Act
      await secretHandler(['delete', 'api_key'], state);

      // Assert
      expect(vault.delete).not.toHaveBeenCalled();
      expect(consola.info).toHaveBeenCalledWith('Cancelled.');
    });

    it('should accept rm as alias for delete', async () => {
      // Arrange
      const vault = createMockVault();
      (vault.getState as Mock).mockReturnValue('unlocked');
      (vault.get as Mock).mockReturnValue('value');
      (clack.confirm as Mock).mockResolvedValueOnce(true);
      const state = createState(vault);

      // Act
      await secretHandler(['rm', 'api_key'], state);

      // Assert
      expect(vault.delete).toHaveBeenCalledWith('api_key');
    });
  });

  describe('unknown subcommand', () => {
    it('should show warning for unknown subcommand', async () => {
      // Arrange
      const state = createState();

      // Act
      await secretHandler(['unknown'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Unknown subcommand: unknown');
      expect(consola.info).toHaveBeenCalledWith('Available: secret init, unlock, lock, set, get, list, delete, status');
    });
  });
});

describe('createSecretCommand', () => {
  it('should create command with correct properties', () => {
    // Act
    const command = createSecretCommand();

    // Assert
    expect(command.name).toBe('secret');
    expect(command.description).toBe('Manage secrets vault (init, set, get, list, delete)');
    expect(command.handler).toBe(secretHandler);
  });
});
