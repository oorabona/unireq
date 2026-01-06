/**
 * Tests for Autocomplete Hook
 */

import { describe, expect, it } from 'vitest';
import type { PathInfo } from '../useAutocomplete.js';
import {
  completeInput,
  computeSuggestions,
  matchFlags,
  matchFlagValues,
  matchSubcommands,
  parseInputContext,
  parseUsedFlags,
} from '../useAutocomplete.js';
import { getCommandSchema } from '../../../repl/command-schema.js';

const mockPaths: PathInfo[] = [
  { path: '/users', methods: ['GET', 'POST'], description: 'User management' },
  { path: '/users/{id}', methods: ['GET', 'PUT', 'DELETE'], description: 'Single user' },
  { path: '/products', methods: ['GET'], description: 'Product list' },
  { path: '/orders', methods: ['GET', 'POST'] },
];

describe('computeSuggestions', () => {
  describe('Command suggestions', () => {
    it('should suggest built-in commands matching prefix', () => {
      // 'hel' matches 'help' and 'headers' but not 'head' (method)
      const suggestions = computeSuggestions('hel');

      expect(suggestions.some((s) => s.value === 'help')).toBe(true);
    });

    it('should suggest custom commands', () => {
      const suggestions = computeSuggestions('cus', { commands: ['custom-cmd'] });

      expect(suggestions.some((s) => s.value === 'custom-cmd')).toBe(true);
    });

    it('should include methods in command suggestions', () => {
      const suggestions = computeSuggestions('g');

      expect(suggestions.some((s) => s.value === 'get')).toBe(true);
    });

    it('should mark commands as command type', () => {
      const suggestions = computeSuggestions('hel');
      const helpSuggestion = suggestions.find((s) => s.value === 'help');

      expect(helpSuggestion?.type).toBe('command');
    });
  });

  describe('Method suggestions', () => {
    it('should suggest HTTP methods', () => {
      const suggestions = computeSuggestions('po');

      expect(suggestions.some((s) => s.value === 'post')).toBe(true);
    });

    it('should mark methods as method type', () => {
      const suggestions = computeSuggestions('ge');
      const getSuggestion = suggestions.find((s) => s.value === 'get');

      expect(getSuggestion?.type).toBe('method');
    });

    it('should suggest all methods for empty input with minChars=0', () => {
      const suggestions = computeSuggestions('', { minChars: 0 });

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Path suggestions', () => {
    it('should suggest paths after method', () => {
      const suggestions = computeSuggestions('get /us', { paths: mockPaths });

      expect(suggestions.some((s) => s.value === '/users')).toBe(true);
      expect(suggestions.some((s) => s.value === '/users/{id}')).toBe(true);
    });

    it('should suggest paths starting with /', () => {
      const suggestions = computeSuggestions('/prod', { paths: mockPaths });

      expect(suggestions.some((s) => s.value === '/products')).toBe(true);
    });

    it('should include path descriptions', () => {
      const suggestions = computeSuggestions('/users', { paths: mockPaths });
      const userSuggestion = suggestions.find((s) => s.value === '/users');

      expect(userSuggestion?.description).toBe('User management');
    });

    it('should show methods in description when no description', () => {
      const suggestions = computeSuggestions('/orders', { paths: mockPaths });
      const orderSuggestion = suggestions.find((s) => s.value === '/orders');

      expect(orderSuggestion?.description).toContain('GET');
      expect(orderSuggestion?.description).toContain('POST');
    });

    it('should mark paths as path type', () => {
      const suggestions = computeSuggestions('/users', { paths: mockPaths });

      expect(suggestions[0]?.type).toBe('path');
    });
  });

  describe('Configuration', () => {
    it('should return empty when input too short', () => {
      const suggestions = computeSuggestions('h', { minChars: 2 });

      expect(suggestions).toHaveLength(0);
    });

    it('should respect minChars', () => {
      const suggestions1 = computeSuggestions('he', { minChars: 3 });
      expect(suggestions1).toHaveLength(0);

      const suggestions2 = computeSuggestions('hel', { minChars: 3 });
      expect(suggestions2.length).toBeGreaterThan(0);
    });

    it('should respect maxSuggestions', () => {
      const suggestions = computeSuggestions('h', { maxSuggestions: 2 });

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('No matches', () => {
    it('should return empty array for no matches', () => {
      const suggestions = computeSuggestions('xyz123nonexistent');

      expect(suggestions).toHaveLength(0);
    });
  });
});

describe('completeInput', () => {
  it('should complete command and add space', () => {
    const result = completeInput('hel', 'help');

    expect(result).toBe('help ');
  });

  it('should complete method and add space', () => {
    const result = completeInput('ge', 'get');

    expect(result).toBe('get ');
  });

  it('should complete path after method', () => {
    const result = completeInput('get /us', '/users');

    expect(result).toBe('get /users');
  });

  it('should complete path starting with /', () => {
    const result = completeInput('/us', '/users');

    expect(result).toBe('/users');
  });

  // Note: Full arg completion (headers, body params) is not yet implemented
  // The current implementation focuses on command/method/path completion

  it('should complete subcommand and add space', () => {
    const result = completeInput('profile lis', 'list');

    expect(result).toBe('profile list ');
  });

  it('should complete flag and add space', () => {
    const result = completeInput('get --hea', '--header');

    expect(result).toBe('get --header ');
  });

  it('should complete flag value and add space', () => {
    const result = completeInput('get --output pre', 'pretty');

    expect(result).toBe('get --output pretty ');
  });
});

describe('parseInputContext', () => {
  describe('command context', () => {
    it('should return command context for single word', () => {
      const context = parseInputContext('help');
      expect(context.type).toBe('command');
      expect(context.value).toBe('help');
    });

    it('should return command context for empty input', () => {
      const context = parseInputContext('');
      expect(context.type).toBe('command');
      expect(context.value).toBe('');
    });
  });

  describe('method context', () => {
    it('should return method context for GET prefix', () => {
      const context = parseInputContext('ge');
      expect(context.type).toBe('method');
      expect(context.value).toBe('ge');
    });
  });

  describe('subcommand context', () => {
    it('should return subcommand context for "profile "', () => {
      const context = parseInputContext('profile ');
      expect(context.type).toBe('subcommand');
      expect(context.command).toBe('profile');
      expect(context.value).toBe('');
    });

    it('should return subcommand context for "profile lis"', () => {
      const context = parseInputContext('profile lis');
      expect(context.type).toBe('subcommand');
      expect(context.command).toBe('profile');
      expect(context.value).toBe('lis');
    });

    it('should return subcommand context for "workspace "', () => {
      const context = parseInputContext('workspace ');
      expect(context.type).toBe('subcommand');
      expect(context.command).toBe('workspace');
    });

    it('should return subcommand context for "auth "', () => {
      const context = parseInputContext('auth ');
      expect(context.type).toBe('subcommand');
      expect(context.command).toBe('auth');
    });
  });

  describe('flag context', () => {
    it('should return flag context for "get -"', () => {
      const context = parseInputContext('get -');
      expect(context.type).toBe('flag');
      expect(context.command).toBe('get');
      expect(context.value).toBe('-');
    });

    it('should return flag context for "get --he"', () => {
      const context = parseInputContext('get --he');
      expect(context.type).toBe('flag');
      expect(context.command).toBe('get');
      expect(context.value).toBe('--he');
    });

    it('should return flag context for "get /users --"', () => {
      const context = parseInputContext('get /users --');
      expect(context.type).toBe('flag');
      expect(context.command).toBe('get');
      expect(context.value).toBe('--');
    });

    it('should return flag context for "profile create --"', () => {
      const context = parseInputContext('profile create --');
      expect(context.type).toBe('flag');
      expect(context.command).toBe('profile');
      expect(context.subcommand).toBe('create');
      expect(context.value).toBe('--');
    });

    it('should track used flags', () => {
      const context = parseInputContext('get -H "X-Custom: value" --');
      expect(context.type).toBe('flag');
      expect(context.usedFlags).toContain('-H');
    });
  });

  describe('flag_value context', () => {
    it('should return flag_value context for "get --output "', () => {
      const context = parseInputContext('get --output ');
      expect(context.type).toBe('flag_value');
      expect(context.command).toBe('get');
      expect(context.pendingFlag).toBe('--output');
      expect(context.value).toBe('');
    });

    it('should return flag_value context for "get --output pre"', () => {
      const context = parseInputContext('get --output pre');
      expect(context.type).toBe('flag_value');
      expect(context.command).toBe('get');
      expect(context.pendingFlag).toBe('--output');
      expect(context.value).toBe('pre');
    });

    it('should return flag_value context for "get -o "', () => {
      const context = parseInputContext('get -o ');
      expect(context.type).toBe('flag_value');
      expect(context.pendingFlag).toBe('-o');
    });
  });

  describe('path context after method', () => {
    it('should return path context for "get /us"', () => {
      const context = parseInputContext('get /us');
      expect(context.type).toBe('path');
      expect(context.value).toBe('/us');
    });

    it('should return path context for empty path after method', () => {
      const context = parseInputContext('get ');
      expect(context.type).toBe('path');
      expect(context.value).toBe('');
    });
  });
});

describe('parseUsedFlags', () => {
  it('should parse single short flag', () => {
    const flags = parseUsedFlags(['get', '/users', '-i']);
    expect(flags).toContain('-i');
  });

  it('should parse single long flag', () => {
    const flags = parseUsedFlags(['get', '/users', '--include']);
    expect(flags).toContain('--include');
  });

  it('should parse multiple flags', () => {
    const flags = parseUsedFlags(['get', '/users', '-H', 'X-Custom: value', '-q', 'foo=bar', '--trace']);
    expect(flags).toContain('-H');
    expect(flags).toContain('-q');
    expect(flags).toContain('--trace');
  });

  it('should handle --flag=value syntax', () => {
    const flags = parseUsedFlags(['get', '/users', '--output=json']);
    expect(flags).toContain('--output');
  });

  it('should return empty array when no flags', () => {
    const flags = parseUsedFlags(['get', '/users']);
    expect(flags).toHaveLength(0);
  });
});

describe('matchSubcommands', () => {
  it('should return all subcommands for empty input', () => {
    const suggestions = matchSubcommands('', 'profile');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.value === 'list')).toBe(true);
    expect(suggestions.some((s) => s.value === 'create')).toBe(true);
    expect(suggestions.some((s) => s.value === 'use')).toBe(true);
  });

  it('should filter subcommands by prefix', () => {
    const suggestions = matchSubcommands('lis', 'profile');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.value).toBe('list');
  });

  it('should include descriptions', () => {
    const suggestions = matchSubcommands('list', 'profile');
    expect(suggestions[0]?.description).toBeDefined();
  });

  it('should return empty for unknown command', () => {
    const suggestions = matchSubcommands('', 'unknowncmd');
    expect(suggestions).toHaveLength(0);
  });

  it('should be case-insensitive', () => {
    const suggestions = matchSubcommands('LIS', 'profile');
    expect(suggestions.some((s) => s.value === 'list')).toBe(true);
  });
});

describe('matchFlags', () => {
  it('should return all flags for empty input', () => {
    const schema = getCommandSchema('get')!;
    const suggestions = matchFlags('', schema, []);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('should match short flags', () => {
    const schema = getCommandSchema('get')!;
    const suggestions = matchFlags('-H', schema, []);
    expect(suggestions.some((s) => s.value === '-H')).toBe(true);
  });

  it('should match long flags', () => {
    const schema = getCommandSchema('get')!;
    const suggestions = matchFlags('--he', schema, []);
    expect(suggestions.some((s) => s.value === '--header')).toBe(true);
  });

  it('should exclude used non-repeatable flags', () => {
    const schema = getCommandSchema('get')!;
    const suggestions = matchFlags('-', schema, ['-i']); // -i/--include is not repeatable
    expect(suggestions.some((s) => s.value === '-i')).toBe(false);
    expect(suggestions.some((s) => s.value === '--include')).toBe(false);
  });

  it('should include used repeatable flags', () => {
    const schema = getCommandSchema('get')!;
    const suggestions = matchFlags('-', schema, ['-H']); // -H/--header is repeatable
    expect(suggestions.some((s) => s.value === '-H')).toBe(true);
  });

  it('should sort short flags before long flags', () => {
    const schema = getCommandSchema('get')!;
    const suggestions = matchFlags('-', schema, []);
    const firstShortIndex = suggestions.findIndex((s) => s.value.length === 2);
    const firstLongIndex = suggestions.findIndex((s) => s.value.startsWith('--'));
    expect(firstShortIndex).toBeLessThan(firstLongIndex);
  });

  it('should include flag descriptions', () => {
    const schema = getCommandSchema('get')!;
    const suggestions = matchFlags('--header', schema, []);
    expect(suggestions[0]?.description).toBeDefined();
  });
});

describe('matchFlagValues', () => {
  it('should return enum values for --output flag', () => {
    const schema = getCommandSchema('get')!;
    const flagSchema = schema.flags?.find((f) => f.long === '--output');
    expect(flagSchema).toBeDefined();

    const suggestions = matchFlagValues('', flagSchema!);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.some((s) => s.value === 'pretty')).toBe(true);
    expect(suggestions.some((s) => s.value === 'json')).toBe(true);
    expect(suggestions.some((s) => s.value === 'raw')).toBe(true);
  });

  it('should filter values by prefix', () => {
    const schema = getCommandSchema('get')!;
    const flagSchema = schema.flags?.find((f) => f.long === '--output');
    const suggestions = matchFlagValues('pre', flagSchema!);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.value).toBe('pretty');
  });

  it('should return empty for flag without values', () => {
    const schema = getCommandSchema('get')!;
    const flagSchema = schema.flags?.find((f) => f.long === '--trace');
    const suggestions = matchFlagValues('', flagSchema!);
    expect(suggestions).toHaveLength(0);
  });
});

describe('computeSuggestions - Extended', () => {
  describe('Subcommand suggestions', () => {
    it('should suggest subcommands for "profile "', () => {
      const suggestions = computeSuggestions('profile ');
      expect(suggestions.some((s) => s.value === 'list')).toBe(true);
      expect(suggestions.some((s) => s.value === 'create')).toBe(true);
      expect(suggestions.some((s) => s.value === 'use')).toBe(true);
    });

    it('should filter subcommands for "profile con"', () => {
      const suggestions = computeSuggestions('profile con');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.value).toBe('configure');
    });

    it('should suggest subcommands for "auth "', () => {
      const suggestions = computeSuggestions('auth ');
      expect(suggestions.some((s) => s.value === 'login')).toBe(true);
      expect(suggestions.some((s) => s.value === 'logout')).toBe(true);
      expect(suggestions.some((s) => s.value === 'status')).toBe(true);
    });
  });

  describe('Flag suggestions', () => {
    it('should suggest flags for "get "', () => {
      // "get " with empty arg suggests paths, but with explicit Tab could show flags
      // Let's test "get -" which clearly indicates flag context
      const suggestions = computeSuggestions('get -');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.value === '-H')).toBe(true);
    });

    it('should suggest flags for "get --he"', () => {
      const suggestions = computeSuggestions('get --he');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.value).toBe('--header');
    });

    it('should suggest flags for "post -b"', () => {
      const suggestions = computeSuggestions('post -b');
      expect(suggestions.some((s) => s.value === '-b')).toBe(true);
    });
  });

  describe('Flag value suggestions', () => {
    it('should suggest values for "get --output "', () => {
      const suggestions = computeSuggestions('get --output ');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.value === 'pretty')).toBe(true);
      expect(suggestions.some((s) => s.value === 'json')).toBe(true);
      expect(suggestions.some((s) => s.value === 'raw')).toBe(true);
    });

    it('should filter values for "get --output pre"', () => {
      const suggestions = computeSuggestions('get --output pre');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.value).toBe('pretty');
    });

    it('should suggest export formats for "get --export "', () => {
      const suggestions = computeSuggestions('get --export ');
      expect(suggestions.some((s) => s.value === 'curl')).toBe(true);
      expect(suggestions.some((s) => s.value === 'httpie')).toBe(true);
    });
  });

  describe('Used flags exclusion', () => {
    it('should not suggest non-repeatable flag already used', () => {
      const suggestions = computeSuggestions('get /users -i -');
      expect(suggestions.some((s) => s.value === '-i')).toBe(false);
      expect(suggestions.some((s) => s.value === '--include')).toBe(false);
    });

    it('should still suggest repeatable flag already used', () => {
      const suggestions = computeSuggestions('get /users -H "X-Custom: val" -');
      expect(suggestions.some((s) => s.value === '-H')).toBe(true);
    });
  });

  describe('Profile create flags', () => {
    it('should suggest flags for "profile create "', () => {
      const suggestions = computeSuggestions('profile create --');
      expect(suggestions.some((s) => s.value === '--from')).toBe(true);
      expect(suggestions.some((s) => s.value === '--copy-vars')).toBe(true);
    });
  });
});
