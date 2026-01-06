/**
 * Tests for Command Schema
 */

import { describe, expect, it } from 'vitest';
import {
  COMMAND_SCHEMAS,
  findFlagSchema,
  getAllFlagNames,
  getCommandSchema,
  getSubcommandNames,
  getSubcommandSchema,
  hasSubcommands,
} from '../command-schema.js';

describe('command-schema', () => {
  describe('COMMAND_SCHEMAS', () => {
    it('contains all expected commands', () => {
      const commandNames = COMMAND_SCHEMAS.map((s) => s.name);

      // Navigation
      expect(commandNames).toContain('cd');
      expect(commandNames).toContain('ls');
      expect(commandNames).toContain('pwd');

      // HTTP methods
      expect(commandNames).toContain('get');
      expect(commandNames).toContain('post');
      expect(commandNames).toContain('put');
      expect(commandNames).toContain('patch');
      expect(commandNames).toContain('delete');
      expect(commandNames).toContain('head');
      expect(commandNames).toContain('options');

      // Workspace
      expect(commandNames).toContain('workspace');
      expect(commandNames).toContain('profile');
      expect(commandNames).toContain('defaults');

      // Collections
      expect(commandNames).toContain('history');
      expect(commandNames).toContain('save');
      expect(commandNames).toContain('run');

      // Security
      expect(commandNames).toContain('secret');
      expect(commandNames).toContain('auth');

      // Utility
      expect(commandNames).toContain('help');
      expect(commandNames).toContain('exit');
    });

    it('has valid flag schemas for HTTP commands', () => {
      const getSchema = getCommandSchema('get');
      expect(getSchema).toBeDefined();
      expect(getSchema?.flags).toBeDefined();
      expect(getSchema?.flags?.length).toBeGreaterThan(0);

      // Check common flags exist
      const flagNames = getAllFlagNames(getSchema!);
      expect(flagNames).toContain('-H');
      expect(flagNames).toContain('--header');
      expect(flagNames).toContain('-o');
      expect(flagNames).toContain('--output');
      expect(flagNames).toContain('--trace');
    });

    it('has body flag only for POST/PUT/PATCH', () => {
      const postFlags = getAllFlagNames(getCommandSchema('post')!);
      const putFlags = getAllFlagNames(getCommandSchema('put')!);
      const patchFlags = getAllFlagNames(getCommandSchema('patch')!);
      const getFlags = getAllFlagNames(getCommandSchema('get')!);
      const deleteFlags = getAllFlagNames(getCommandSchema('delete')!);

      expect(postFlags).toContain('-b');
      expect(postFlags).toContain('--body');
      expect(putFlags).toContain('-b');
      expect(patchFlags).toContain('-b');

      expect(getFlags).not.toContain('-b');
      expect(deleteFlags).not.toContain('-b');
    });
  });

  describe('getCommandSchema', () => {
    it('returns schema for existing command', () => {
      const schema = getCommandSchema('get');
      expect(schema).toBeDefined();
      expect(schema?.name).toBe('get');
    });

    it('returns undefined for unknown command', () => {
      const schema = getCommandSchema('unknowncmd');
      expect(schema).toBeUndefined();
    });

    it('is case-insensitive', () => {
      expect(getCommandSchema('GET')).toBeDefined();
      expect(getCommandSchema('Get')).toBeDefined();
      expect(getCommandSchema('get')).toBeDefined();
    });
  });

  describe('getSubcommandSchema', () => {
    it('returns subcommand schema', () => {
      const schema = getSubcommandSchema('profile', 'create');
      expect(schema).toBeDefined();
      expect(schema?.name).toBe('create');
      expect(schema?.flags).toBeDefined();
    });

    it('returns undefined for unknown subcommand', () => {
      const schema = getSubcommandSchema('profile', 'unknown');
      expect(schema).toBeUndefined();
    });

    it('returns undefined for command without subcommands', () => {
      const schema = getSubcommandSchema('get', 'anything');
      expect(schema).toBeUndefined();
    });

    it('is case-insensitive', () => {
      expect(getSubcommandSchema('Profile', 'Create')).toBeDefined();
    });
  });

  describe('getAllFlagNames', () => {
    it('returns both short and long flag names', () => {
      const schema = getCommandSchema('get')!;
      const flags = getAllFlagNames(schema);

      expect(flags).toContain('-H');
      expect(flags).toContain('--header');
      expect(flags).toContain('-q');
      expect(flags).toContain('--query');
    });

    it('returns only long flags when short is not defined', () => {
      const schema = getCommandSchema('get')!;
      const flags = getAllFlagNames(schema);

      // --trace has no short version
      expect(flags).toContain('--trace');
    });

    it('returns empty array for command without flags', () => {
      const schema = getCommandSchema('pwd')!;
      const flags = getAllFlagNames(schema);
      expect(flags).toEqual([]);
    });
  });

  describe('findFlagSchema', () => {
    it('finds flag by short name', () => {
      const schema = getCommandSchema('get')!;
      const flag = findFlagSchema(schema, '-H');

      expect(flag).toBeDefined();
      expect(flag?.short).toBe('-H');
      expect(flag?.long).toBe('--header');
      expect(flag?.repeatable).toBe(true);
    });

    it('finds flag by long name', () => {
      const schema = getCommandSchema('get')!;
      const flag = findFlagSchema(schema, '--output');

      expect(flag).toBeDefined();
      expect(flag?.short).toBe('-o');
      expect(flag?.takesValue).toBe(true);
      expect(flag?.values).toEqual(['pretty', 'json', 'raw']);
    });

    it('returns undefined for unknown flag', () => {
      const schema = getCommandSchema('get')!;
      const flag = findFlagSchema(schema, '--unknown');
      expect(flag).toBeUndefined();
    });
  });

  describe('hasSubcommands', () => {
    it('returns true for commands with subcommands', () => {
      expect(hasSubcommands('workspace')).toBe(true);
      expect(hasSubcommands('profile')).toBe(true);
      expect(hasSubcommands('auth')).toBe(true);
      expect(hasSubcommands('secret')).toBe(true);
      expect(hasSubcommands('history')).toBe(true);
      expect(hasSubcommands('defaults')).toBe(true);
    });

    it('returns false for commands without subcommands', () => {
      expect(hasSubcommands('get')).toBe(false);
      expect(hasSubcommands('post')).toBe(false);
      expect(hasSubcommands('cd')).toBe(false);
      expect(hasSubcommands('help')).toBe(false);
    });

    it('returns false for unknown commands', () => {
      expect(hasSubcommands('unknowncmd')).toBe(false);
    });
  });

  describe('getSubcommandNames', () => {
    it('returns subcommand names for workspace', () => {
      const names = getSubcommandNames('workspace');
      expect(names).toContain('list');
      expect(names).toContain('init');
      expect(names).toContain('register');
      expect(names).toContain('use');
      expect(names).toContain('current');
      expect(names).toContain('doctor');
    });

    it('returns subcommand names for profile', () => {
      const names = getSubcommandNames('profile');
      expect(names).toContain('list');
      expect(names).toContain('create');
      expect(names).toContain('use');
      expect(names).toContain('show');
      expect(names).toContain('configure');
    });

    it('returns subcommand names for auth', () => {
      const names = getSubcommandNames('auth');
      expect(names).toContain('status');
      expect(names).toContain('list');
      expect(names).toContain('login');
      expect(names).toContain('logout');
      expect(names).toContain('use');
    });

    it('returns empty array for commands without subcommands', () => {
      expect(getSubcommandNames('get')).toEqual([]);
      expect(getSubcommandNames('pwd')).toEqual([]);
    });

    it('returns empty array for unknown commands', () => {
      expect(getSubcommandNames('unknowncmd')).toEqual([]);
    });
  });

  describe('flag properties', () => {
    it('marks header flag as repeatable', () => {
      const schema = getCommandSchema('get')!;
      const headerFlag = findFlagSchema(schema, '-H');
      expect(headerFlag?.repeatable).toBe(true);
    });

    it('marks query flag as repeatable', () => {
      const schema = getCommandSchema('get')!;
      const queryFlag = findFlagSchema(schema, '-q');
      expect(queryFlag?.repeatable).toBe(true);
    });

    it('has enum values for output flag', () => {
      const schema = getCommandSchema('get')!;
      const outputFlag = findFlagSchema(schema, '--output');
      expect(outputFlag?.values).toEqual(['pretty', 'json', 'raw']);
    });

    it('has enum values for export flag', () => {
      const schema = getCommandSchema('get')!;
      const exportFlag = findFlagSchema(schema, '--export');
      expect(exportFlag?.values).toEqual(['curl', 'httpie']);
    });

    it('profile create has clone flags', () => {
      const schema = getSubcommandSchema('profile', 'create');
      expect(schema?.flags).toBeDefined();

      const fromFlag = schema?.flags?.find((f) => f.long === '--from');
      expect(fromFlag).toBeDefined();
      expect(fromFlag?.takesValue).toBe(true);

      const copyVarsFlag = schema?.flags?.find((f) => f.long === '--copy-vars');
      expect(copyVarsFlag).toBeDefined();
      expect(copyVarsFlag?.takesValue).toBeUndefined();
    });
  });
});
