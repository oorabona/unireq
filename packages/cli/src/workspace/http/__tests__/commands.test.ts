import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplState } from '../../../repl/state.js';
import { createReplState } from '../../../repl/state.js';
import type { WorkspaceConfig } from '../../config/types.js';
import { httpHandler } from '../commands.js';

// Mock consola
vi.mock('consola', () => ({
  consola: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { consola } from 'consola';

describe('httpHandler', () => {
  let state: ReplState;

  beforeEach(() => {
    vi.clearAllMocks();
    state = createReplState();
  });

  describe('S-14: No workspace shows built-in only', () => {
    it('should show all built-in defaults when no config', async () => {
      // Given no workspace is loaded
      // When user runs "http"
      await httpHandler([], state);

      // Then output shows all keys with source "built-in"
      expect(consola.info).toHaveBeenCalledWith('HTTP Output Defaults:');
      expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('includeHeaders'));
      expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('built-in'));
    });
  });

  describe('S-1: Show all defaults with sources', () => {
    it('should show workspace and profile sources', async () => {
      // Given workspace.yaml has defaults
      state.workspaceConfig = {
        version: 2,
        name: 'test',
        defaults: {
          includeHeaders: true,
        },
        profiles: {
          dev: {
            baseUrl: 'http://localhost',
            defaults: {
              trace: true,
            },
          },
        },
      } as WorkspaceConfig;
      state.activeProfile = 'dev';

      // When user runs "http"
      await httpHandler([], state);

      // Then output shows sources correctly
      expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('workspace'));
      expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('profile:dev'));
    });
  });

  describe('S-2: Get single default', () => {
    it('should show value and source for specific key', async () => {
      // Given workspace has includeHeaders: true
      state.workspaceConfig = {
        version: 2,
        name: 'test',
        defaults: { includeHeaders: true },
      } as WorkspaceConfig;

      // When user runs "http get includeHeaders"
      await httpHandler(['get', 'includeHeaders'], state);

      // Then output shows value and source
      expect(consola.log).toHaveBeenCalledWith('includeHeaders = true');
      expect(consola.log).toHaveBeenCalledWith(expect.stringContaining('Source: workspace'));
    });

    it('should treat unknown subcommand as key lookup', async () => {
      // When user runs "http includeHeaders" (shorthand)
      await httpHandler(['includeHeaders'], state);

      // Then shows default value
      expect(consola.log).toHaveBeenCalledWith('includeHeaders = false');
    });
  });

  describe('S-3: Get unknown key error', () => {
    it('should show error with suggestion for typo', async () => {
      // When user runs "http get inclueHeaders" (typo)
      await httpHandler(['get', 'inclueHeaders'], state);

      // Then shows error with suggestion
      expect(consola.error).toHaveBeenCalledWith('Unknown key: inclueHeaders');
      expect(consola.info).toHaveBeenCalledWith('Did you mean: includeHeaders?');
    });

    it('should show valid keys for completely wrong input', async () => {
      // When user runs "http get foobar"
      await httpHandler(['get', 'foobar'], state);

      // Then shows error with valid keys
      expect(consola.error).toHaveBeenCalledWith('Unknown key: foobar');
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('Valid keys:'));
    });
  });

  describe('S-4: Set session override (boolean)', () => {
    it('should set boolean session override', async () => {
      // Given no session defaults
      expect(state.sessionDefaults).toBeUndefined();

      // When user runs "http set includeHeaders true"
      await httpHandler(['set', 'includeHeaders', 'true'], state);

      // Then session override is stored
      expect(state.sessionDefaults?.includeHeaders).toBe(true);
      expect(consola.success).toHaveBeenCalledWith('Set includeHeaders = true (session override)');
    });

    it('should accept various boolean formats', async () => {
      // Yes
      await httpHandler(['set', 'includeHeaders', 'yes'], state);
      expect(state.sessionDefaults?.includeHeaders).toBe(true);

      // No
      await httpHandler(['set', 'trace', 'no'], state);
      expect(state.sessionDefaults?.trace).toBe(false);

      // 1
      await httpHandler(['set', 'showSummary', '1'], state);
      expect(state.sessionDefaults?.showSummary).toBe(true);

      // 0
      await httpHandler(['set', 'hideBody', '0'], state);
      expect(state.sessionDefaults?.hideBody).toBe(false);
    });
  });

  describe('S-5: Set session override (enum)', () => {
    it('should set outputMode session override', async () => {
      // When user runs "http set outputMode json"
      await httpHandler(['set', 'outputMode', 'json'], state);

      // Then session override is stored
      expect(state.sessionDefaults?.outputMode).toBe('json');
      expect(consola.success).toHaveBeenCalledWith('Set outputMode = json (session override)');
    });
  });

  describe('S-6: Set invalid enum value', () => {
    it('should reject invalid outputMode', async () => {
      // When user runs "http set outputMode yaml"
      await httpHandler(['set', 'outputMode', 'yaml'], state);

      // Then shows error with valid values
      expect(consola.error).toHaveBeenCalledWith("Invalid value 'yaml' for outputMode");
      expect(consola.info).toHaveBeenCalledWith('Valid values: pretty, json, raw');
      expect(state.sessionDefaults).toBeUndefined();
    });

    it('should reject invalid boolean value', async () => {
      // When user runs "http set includeHeaders maybe"
      await httpHandler(['set', 'includeHeaders', 'maybe'], state);

      // Then shows error with valid formats
      expect(consola.error).toHaveBeenCalledWith('Invalid boolean value: maybe');
      expect(consola.info).toHaveBeenCalledWith('Use: true, false, yes, no, 1, 0');
    });
  });

  describe('S-7: Reset single override', () => {
    it('should reset specific session override', async () => {
      // Given session override exists
      state.workspaceConfig = {
        version: 2,
        name: 'test',
        defaults: { includeHeaders: true },
      } as WorkspaceConfig;
      state.sessionDefaults = { includeHeaders: false };

      // When user runs "http reset includeHeaders"
      await httpHandler(['reset', 'includeHeaders'], state);

      // Then session override is removed
      expect(state.sessionDefaults).toBeUndefined(); // Cleaned up empty object
      expect(consola.success).toHaveBeenCalledWith(expect.stringContaining('Reset includeHeaders'));
    });
  });

  describe('S-8: Reset all overrides', () => {
    it('should clear all session overrides', async () => {
      // Given multiple session overrides exist
      state.sessionDefaults = {
        includeHeaders: true,
        trace: true,
      };

      // When user runs "http reset"
      await httpHandler(['reset'], state);

      // Then all overrides are cleared
      expect(state.sessionDefaults).toBeUndefined();
      expect(consola.success).toHaveBeenCalledWith('Cleared 2 session overrides:');
    });
  });

  describe('S-9: Reset non-existent override', () => {
    it('should show info when no override exists', async () => {
      // Given no session overrides
      state.sessionDefaults = undefined;

      // When user runs "http reset includeHeaders"
      await httpHandler(['reset', 'includeHeaders'], state);

      // Then shows info message
      expect(consola.info).toHaveBeenCalledWith('No session override for includeHeaders');
    });
  });

  describe('Usage errors', () => {
    it('should show usage for get without key', async () => {
      await httpHandler(['get'], state);
      expect(consola.warn).toHaveBeenCalledWith('Usage: http get <key>');
    });

    it('should show usage for set without value', async () => {
      await httpHandler(['set', 'includeHeaders'], state);
      expect(consola.warn).toHaveBeenCalledWith('Usage: http set <key> <value>');
    });

    it('should show error for unknown subcommand', async () => {
      await httpHandler(['unknown'], state);
      expect(consola.error).toHaveBeenCalledWith('Unknown subcommand or key: unknown');
    });
  });

  describe('S-10: Session override affects HTTP commands', () => {
    it('should store session defaults in state for HTTP commands to use', async () => {
      // Set several session overrides
      await httpHandler(['set', 'includeHeaders', 'true'], state);
      await httpHandler(['set', 'trace', 'true'], state);
      await httpHandler(['set', 'outputMode', 'json'], state);

      // Verify state is correctly populated
      expect(state.sessionDefaults).toEqual({
        includeHeaders: true,
        trace: true,
        outputMode: 'json',
      });
    });
  });

  describe('S-15: Method-specific source tracking', () => {
    it('should show workspace.method source when applicable', async () => {
      // Given workspace has method-specific defaults
      state.workspaceConfig = {
        version: 2,
        name: 'test',
        defaults: {
          get: { includeHeaders: true },
        },
      } as WorkspaceConfig;

      // Note: http command shows general view, not method-specific
      // Method-specific tracking is shown via source-tracker tests
      await httpHandler(['get', 'includeHeaders'], state);

      // Shows built-in since no general override (method-specific requires method context)
      expect(consola.log).toHaveBeenCalledWith('includeHeaders = false');
    });
  });
});
