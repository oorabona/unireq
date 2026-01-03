import { describe, expect, it } from 'vitest';
import type { HttpDefaults, HttpOutputDefaults } from '../../config/types.js';
import { BUILT_IN_DEFAULTS, getSourceDescription, resolveDefaultsWithSource } from '../source-tracker.js';

describe('source-tracker', () => {
  describe('BUILT_IN_DEFAULTS', () => {
    it('should have all default keys defined', () => {
      expect(BUILT_IN_DEFAULTS).toEqual({
        includeHeaders: false,
        outputMode: 'pretty',
        showSummary: false,
        trace: false,
        showSecrets: false,
        hideBody: false,
      });
    });
  });

  describe('resolveDefaultsWithSource', () => {
    describe('S-14: No workspace shows built-in only', () => {
      it('should return all built-in defaults when no config provided', () => {
        // Given no workspace is loaded
        // When user runs "defaults"
        const result = resolveDefaultsWithSource(undefined, undefined, undefined, undefined, undefined);

        // Then output shows all keys with source "built-in"
        expect(result.includeHeaders).toEqual({ key: 'includeHeaders', value: false, source: 'built-in' });
        expect(result.outputMode).toEqual({ key: 'outputMode', value: 'pretty', source: 'built-in' });
        expect(result.showSummary).toEqual({ key: 'showSummary', value: false, source: 'built-in' });
        expect(result.trace).toEqual({ key: 'trace', value: false, source: 'built-in' });
        expect(result.showSecrets).toEqual({ key: 'showSecrets', value: false, source: 'built-in' });
        expect(result.hideBody).toEqual({ key: 'hideBody', value: false, source: 'built-in' });
      });
    });

    describe('S-1: Show all defaults with sources', () => {
      it('should track source from workspace and profile', () => {
        // Given workspace.yaml contains defaults.includeHeaders and profile.dev.defaults.trace
        const workspaceDefaults: HttpDefaults = {
          includeHeaders: true,
        };
        const profileDefaults: HttpDefaults = {
          trace: true,
        };

        // When resolving defaults with profile "dev" active
        const result = resolveDefaultsWithSource(undefined, workspaceDefaults, profileDefaults, 'dev', undefined);

        // Then sources are correctly tracked
        expect(result.includeHeaders).toEqual({ key: 'includeHeaders', value: true, source: 'workspace' });
        expect(result.trace).toEqual({ key: 'trace', value: true, source: 'profile:dev' });
        expect(result.outputMode).toEqual({ key: 'outputMode', value: 'pretty', source: 'built-in' });
        expect(result.showSummary).toEqual({ key: 'showSummary', value: false, source: 'built-in' });
      });
    });

    describe('S-15: Method-specific source tracking', () => {
      it('should show workspace.method as source for method-specific defaults', () => {
        // Given workspace.yaml contains defaults.get.includeHeaders: true
        const workspaceDefaults: HttpDefaults = {
          get: {
            includeHeaders: true,
          },
        };

        // When resolving for GET method
        const result = resolveDefaultsWithSource('get', workspaceDefaults, undefined, undefined, undefined);

        // Then includeHeaders shows source "workspace.get"
        expect(result.includeHeaders).toEqual({ key: 'includeHeaders', value: true, source: 'workspace.get' });
      });

      it('should show profile.method as source for profile method-specific defaults', () => {
        // Given profile.dev.defaults.post.trace: true
        const profileDefaults: HttpDefaults = {
          post: {
            trace: true,
          },
        };

        // When resolving for POST method with profile dev
        const result = resolveDefaultsWithSource('post', undefined, profileDefaults, 'dev', undefined);

        // Then trace shows source "profile:dev.post"
        expect(result.trace).toEqual({ key: 'trace', value: true, source: 'profile:dev.post' });
      });
    });

    describe('S-4/S-5: Session override source tracking', () => {
      it('should show session as source for session overrides', () => {
        // Given workspace has defaults and session override exists
        const workspaceDefaults: HttpDefaults = {
          includeHeaders: true,
        };
        const sessionDefaults: HttpOutputDefaults = {
          includeHeaders: false,
        };

        // When resolving with session override
        const result = resolveDefaultsWithSource(undefined, workspaceDefaults, undefined, undefined, sessionDefaults);

        // Then source is "session"
        expect(result.includeHeaders).toEqual({ key: 'includeHeaders', value: false, source: 'session' });
      });

      it('should handle multiple session overrides', () => {
        const sessionDefaults: HttpOutputDefaults = {
          includeHeaders: true,
          outputMode: 'json',
          trace: true,
        };

        const result = resolveDefaultsWithSource(undefined, undefined, undefined, undefined, sessionDefaults);

        expect(result.includeHeaders.source).toBe('session');
        expect(result.outputMode.source).toBe('session');
        expect(result.trace.source).toBe('session');
        // Non-overridden values remain built-in
        expect(result.showSummary.source).toBe('built-in');
      });
    });

    describe('Priority order', () => {
      it('should prioritize session over profile over workspace over built-in', () => {
        // Full 5-level test
        const workspaceDefaults: HttpDefaults = {
          includeHeaders: true, // Layer 1
          outputMode: 'json', // Layer 1 (will be overridden)
          showSummary: true, // Layer 1 (will be overridden)
          trace: true, // Layer 1 (will be overridden)
          hideBody: true, // Layer 1 (will be overridden)
          get: {
            outputMode: 'raw', // Layer 2 (will be overridden)
            showSummary: false, // Layer 2 (will be overridden)
            trace: false, // Layer 2 (will be overridden)
          },
        };
        const profileDefaults: HttpDefaults = {
          showSummary: true, // Layer 3 (will be overridden)
          trace: true, // Layer 3 (will be overridden)
          get: {
            trace: false, // Layer 4 (will be overridden)
          },
        };
        const sessionDefaults: HttpOutputDefaults = {
          trace: true, // Layer 5 (wins)
        };

        const result = resolveDefaultsWithSource('get', workspaceDefaults, profileDefaults, 'dev', sessionDefaults);

        // Verify each layer
        expect(result.includeHeaders).toEqual({ key: 'includeHeaders', value: true, source: 'workspace' });
        expect(result.outputMode).toEqual({ key: 'outputMode', value: 'raw', source: 'workspace.get' });
        expect(result.showSummary).toEqual({ key: 'showSummary', value: true, source: 'profile:dev' });
        expect(result.trace).toEqual({ key: 'trace', value: true, source: 'session' });
        expect(result.hideBody).toEqual({ key: 'hideBody', value: true, source: 'workspace' });
        expect(result.showSecrets).toEqual({ key: 'showSecrets', value: false, source: 'built-in' });
      });

      it('should handle profile without method-specific when method provided', () => {
        const profileDefaults: HttpDefaults = {
          includeHeaders: true,
          // No get-specific defaults
        };

        const result = resolveDefaultsWithSource('get', undefined, profileDefaults, 'prod', undefined);

        expect(result.includeHeaders).toEqual({ key: 'includeHeaders', value: true, source: 'profile:prod' });
      });
    });

    describe('Edge cases', () => {
      it('should handle empty workspace defaults', () => {
        const workspaceDefaults: HttpDefaults = {};
        const result = resolveDefaultsWithSource(undefined, workspaceDefaults, undefined, undefined, undefined);

        // All should remain built-in
        expect(result.includeHeaders.source).toBe('built-in');
        expect(result.outputMode.source).toBe('built-in');
      });

      it('should handle empty profile defaults', () => {
        const profileDefaults: HttpDefaults = {};
        const result = resolveDefaultsWithSource(undefined, undefined, profileDefaults, 'empty', undefined);

        // All should remain built-in
        expect(result.includeHeaders.source).toBe('built-in');
      });

      it('should handle profile defaults without profile name', () => {
        // Edge case: profile defaults provided but no name (should not apply)
        const profileDefaults: HttpDefaults = {
          includeHeaders: true,
        };
        const result = resolveDefaultsWithSource(undefined, undefined, profileDefaults, undefined, undefined);

        // Profile should NOT apply without name
        expect(result.includeHeaders).toEqual({ key: 'includeHeaders', value: false, source: 'built-in' });
      });

      it('should handle method with no method-specific config', () => {
        const workspaceDefaults: HttpDefaults = {
          includeHeaders: true,
          // No get-specific
        };

        const result = resolveDefaultsWithSource('get', workspaceDefaults, undefined, undefined, undefined);

        // Should use workspace general, not workspace.get
        expect(result.includeHeaders).toEqual({ key: 'includeHeaders', value: true, source: 'workspace' });
      });

      it('should handle empty session defaults', () => {
        const sessionDefaults: HttpOutputDefaults = {};
        const result = resolveDefaultsWithSource(undefined, undefined, undefined, undefined, sessionDefaults);

        // All should remain built-in
        expect(result.includeHeaders.source).toBe('built-in');
      });
    });
  });

  describe('getSourceDescription', () => {
    it('should describe built-in source', () => {
      expect(getSourceDescription('built-in')).toBe('Hardcoded default');
    });

    it('should describe workspace source', () => {
      expect(getSourceDescription('workspace')).toBe('workspace.yaml \u2192 defaults');
    });

    it('should describe workspace.method source', () => {
      expect(getSourceDescription('workspace.get')).toBe('workspace.yaml \u2192 defaults.get');
      expect(getSourceDescription('workspace.post')).toBe('workspace.yaml \u2192 defaults.post');
    });

    it('should describe session source', () => {
      expect(getSourceDescription('session')).toBe('Session override (ephemeral)');
    });

    it('should describe profile source', () => {
      expect(getSourceDescription('profile:dev')).toBe('workspace.yaml \u2192 profiles.dev.defaults');
      expect(getSourceDescription('profile:production')).toBe('workspace.yaml \u2192 profiles.production.defaults');
    });

    it('should describe profile.method source', () => {
      expect(getSourceDescription('profile:dev.get')).toBe('workspace.yaml \u2192 profiles.dev.defaults.get');
      expect(getSourceDescription('profile:prod.post')).toBe('workspace.yaml \u2192 profiles.prod.defaults.post');
    });
  });
});
