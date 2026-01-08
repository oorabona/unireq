/**
 * Tests for shared HTTP options parser
 */

import { describe, expect, it } from 'vitest';
import {
  generateHttpOptionsHelp,
  HTTP_METHODS,
  HTTP_OPTIONS,
  isHttpMethod,
  parseHttpCommand,
  parseHttpOptions,
  resolveHttpDefaults,
} from '../http-options.js';

describe('parseHttpOptions', () => {
  describe('header flags', () => {
    it('should parse single header with -H', () => {
      // Arrange
      const args = ['-H', 'Content-Type:application/json'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.headers).toEqual(['Content-Type:application/json']);
    });

    it('should parse single header with --header', () => {
      // Arrange
      const args = ['--header', 'Authorization:Bearer token'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.headers).toEqual(['Authorization:Bearer token']);
    });

    it('should parse multiple headers', () => {
      // Arrange
      const args = ['-H', 'Content-Type:application/json', '-H', 'Authorization:Bearer token'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.headers).toEqual(['Content-Type:application/json', 'Authorization:Bearer token']);
    });

    it('should reject header without colon', () => {
      // Arrange
      const args = ['-H', 'InvalidHeader'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow("Invalid header format: expected 'key:value', got 'InvalidHeader'");
    });
  });

  describe('query flags', () => {
    it('should parse single query with -q', () => {
      // Arrange
      const args = ['-q', 'page=1'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.query).toEqual(['page=1']);
    });

    it('should parse single query with --query', () => {
      // Arrange
      const args = ['--query', 'limit=10'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.query).toEqual(['limit=10']);
    });

    it('should parse multiple query params', () => {
      // Arrange
      const args = ['-q', 'page=1', '-q', 'limit=10'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.query).toEqual(['page=1', 'limit=10']);
    });

    it('should reject query without equals', () => {
      // Arrange
      const args = ['-q', 'invalid'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow("Invalid query format: expected 'key=value', got 'invalid'");
    });
  });

  describe('body flag', () => {
    it('should parse body with -b', () => {
      // Arrange
      const args = ['-b', '{"name":"Alice"}'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.body).toBe('{"name":"Alice"}');
    });

    it('should parse body with --body', () => {
      // Arrange
      const args = ['--body', '{"id":1}'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.body).toBe('{"id":1}');
    });

    it('should parse inline JSON body', () => {
      // Arrange
      const args = ['{"name":"Bob"}'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.body).toBe('{"name":"Bob"}');
    });

    it('should reject invalid inline JSON', () => {
      // Arrange
      const args = ['{invalid json}'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow('Invalid JSON body');
    });

    it('should reject multiple body arguments', () => {
      // Arrange
      const args = ['{"a":1}', '{"b":2}'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow('Multiple body arguments provided');
    });
  });

  describe('timeout flag', () => {
    it('should parse timeout with -t', () => {
      // Arrange
      const args = ['-t', '5000'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.timeout).toBe(5000);
    });

    it('should parse timeout with --timeout', () => {
      // Arrange
      const args = ['--timeout', '10000'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.timeout).toBe(10000);
    });

    it('should reject non-numeric timeout', () => {
      // Arrange
      const args = ['-t', 'abc'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow('Invalid number for -t: abc');
    });
  });

  describe('output mode flag', () => {
    it('should parse output mode with -o', () => {
      // Arrange
      const args = ['-o', 'json'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.outputMode).toBe('json');
    });

    it('should parse output mode with --output', () => {
      // Arrange
      const args = ['--output', 'raw'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.outputMode).toBe('raw');
    });
  });

  describe('boolean flags', () => {
    it('should parse -i flag', () => {
      // Arrange
      const args = ['-i'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.includeHeaders).toBe(true);
    });

    it('should parse --include flag', () => {
      // Arrange
      const args = ['--include'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.includeHeaders).toBe(true);
    });

    it('should parse -S flag', () => {
      // Arrange
      const args = ['-S'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.showSummary).toBe(true);
    });

    it('should parse --summary flag', () => {
      // Arrange
      const args = ['--summary'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.showSummary).toBe(true);
    });

    it('should parse --no-redact flag', () => {
      // Arrange
      const args = ['--no-redact'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.showSecrets).toBe(true);
    });

    it('should parse --trace flag', () => {
      // Arrange
      const args = ['--trace'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.trace).toBe(true);
    });

    it('should parse --isolate flag', () => {
      // Arrange
      const args = ['--isolate'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.isolate).toBe(true);
    });
  });

  describe('export flag', () => {
    it('should parse export with -e', () => {
      // Arrange
      const args = ['-e', 'curl'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.exportFormat).toBe('curl');
    });

    it('should parse export with --export', () => {
      // Arrange
      const args = ['--export', 'httpie'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.exportFormat).toBe('httpie');
    });
  });

  describe('combined flags', () => {
    it('should parse multiple different flags', () => {
      // Arrange
      const args = ['-H', 'Auth:Bearer x', '-q', 'page=1', '-i', '-S', '-o', 'json'];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.headers).toEqual(['Auth:Bearer x']);
      expect(options.query).toEqual(['page=1']);
      expect(options.includeHeaders).toBe(true);
      expect(options.showSummary).toBe(true);
      expect(options.outputMode).toBe('json');
    });
  });

  describe('error handling', () => {
    it('should reject unknown short flag', () => {
      // Arrange
      const args = ['-x'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow("Unknown flag: -x. Type 'help <command>' for available options.");
    });

    it('should reject unknown long flag', () => {
      // Arrange
      const args = ['--unknown'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow(
        "Unknown flag: --unknown. Type 'help <command>' for available options.",
      );
    });

    it('should reject missing value for string flag', () => {
      // Arrange
      const args = ['-H'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow('Missing value for -H');
    });

    it('should reject missing value when next arg is flag', () => {
      // Arrange
      const args = ['-H', '-i'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow('Missing value for -H');
    });

    it('should reject unexpected non-flag argument', () => {
      // Arrange
      const args = ['unexpected'];

      // Act & Assert
      expect(() => parseHttpOptions(args)).toThrow('Unexpected argument: unexpected');
    });
  });

  describe('empty input', () => {
    it('should return defaults for empty args', () => {
      // Arrange
      const args: string[] = [];

      // Act
      const options = parseHttpOptions(args);

      // Assert
      expect(options.headers).toEqual([]);
      expect(options.query).toEqual([]);
      expect(options.body).toBeUndefined();
      expect(options.timeout).toBeUndefined();
      expect(options.outputMode).toBeUndefined();
      expect(options.includeHeaders).toBeUndefined();
      expect(options.showSecrets).toBeUndefined();
      expect(options.showSummary).toBeUndefined();
      expect(options.trace).toBeUndefined();
      expect(options.exportFormat).toBeUndefined();
    });
  });
});

describe('parseHttpCommand', () => {
  it('should parse URL only', () => {
    // Arrange
    const args = ['/users'];

    // Act
    const request = parseHttpCommand('GET', args);

    // Assert
    expect(request.method).toBe('GET');
    expect(request.url).toBe('/users');
    expect(request.headers).toEqual([]);
    expect(request.query).toEqual([]);
  });

  it('should parse URL with options', () => {
    // Arrange
    const args = ['/users', '-H', 'Auth:Bearer x', '-i', '-S'];

    // Act
    const request = parseHttpCommand('POST', args);

    // Assert
    expect(request.method).toBe('POST');
    expect(request.url).toBe('/users');
    expect(request.headers).toEqual(['Auth:Bearer x']);
    expect(request.includeHeaders).toBe(true);
    expect(request.showSummary).toBe(true);
  });

  it('should throw for empty args', () => {
    // Arrange
    const args: string[] = [];

    // Act & Assert
    expect(() => parseHttpCommand('GET', args)).toThrow('URL is required');
  });

  it('should throw when only flags provided (no URL)', () => {
    // Arrange
    const args = ['-i'];

    // Act & Assert
    expect(() => parseHttpCommand('GET', args)).toThrow('URL is required');
  });

  describe('flag ordering (curl-like)', () => {
    it('should parse flags before URL', () => {
      // Arrange - curl-style: get -L https://...
      const args = ['-L', 'https://example.com'];

      // Act
      const request = parseHttpCommand('GET', args);

      // Assert
      expect(request.url).toBe('https://example.com');
      expect(request.followRedirects).toBe(true);
    });

    it('should parse flags after URL', () => {
      // Arrange - traditional style: get https://... -L
      const args = ['https://example.com', '-L'];

      // Act
      const request = parseHttpCommand('GET', args);

      // Assert
      expect(request.url).toBe('https://example.com');
      expect(request.followRedirects).toBe(true);
    });

    it('should parse flags mixed before and after URL', () => {
      // Arrange - mixed: get -i https://... -L -S
      const args = ['-i', 'https://example.com', '-L', '-S'];

      // Act
      const request = parseHttpCommand('GET', args);

      // Assert
      expect(request.url).toBe('https://example.com');
      expect(request.includeHeaders).toBe(true);
      expect(request.followRedirects).toBe(true);
      expect(request.showSummary).toBe(true);
    });

    it('should parse value flags before URL', () => {
      // Arrange - get -H "Auth:token" https://...
      const args = ['-H', 'Authorization:Bearer token', 'https://example.com'];

      // Act
      const request = parseHttpCommand('GET', args);

      // Assert
      expect(request.url).toBe('https://example.com');
      expect(request.headers).toEqual(['Authorization:Bearer token']);
    });

    it('should parse multiple value flags before URL', () => {
      // Arrange - get -H "H1:v1" -q "p=1" https://...
      const args = ['-H', 'Content-Type:application/json', '-q', 'page=1', 'https://example.com', '-i'];

      // Act
      const request = parseHttpCommand('GET', args);

      // Assert
      expect(request.url).toBe('https://example.com');
      expect(request.headers).toEqual(['Content-Type:application/json']);
      expect(request.query).toEqual(['page=1']);
      expect(request.includeHeaders).toBe(true);
    });

    it('should handle inline JSON body with flags before URL', () => {
      // Arrange - post -H "CT:json" https://... {"name":"test"}
      const args = ['-H', 'Content-Type:application/json', 'https://example.com', '{"name":"test"}'];

      // Act
      const request = parseHttpCommand('POST', args);

      // Assert
      expect(request.url).toBe('https://example.com');
      expect(request.headers).toEqual(['Content-Type:application/json']);
      expect(request.body).toBe('{"name":"test"}');
    });

    it('should reject extra positional arguments', () => {
      // Arrange - two URLs
      const args = ['https://example.com', 'https://other.com'];

      // Act & Assert
      expect(() => parseHttpCommand('GET', args)).toThrow('Unexpected argument: https://other.com');
    });
  });
});

describe('generateHttpOptionsHelp', () => {
  it('should include command name in usage', () => {
    // Act
    const help = generateHttpOptionsHelp('get');

    // Assert
    expect(help).toContain('Usage: get <url> [options]');
  });

  it('should list all options', () => {
    // Act
    const help = generateHttpOptionsHelp('get');

    // Assert
    expect(help).toContain('-H, --header');
    expect(help).toContain('-q, --query');
    expect(help).toContain('-i, --include');
    expect(help).toContain('-S, --summary');
    expect(help).toContain('--no-redact');
    expect(help).toContain('--trace');
    expect(help).toContain('--isolate');
  });

  it('should include examples', () => {
    // Act
    const help = generateHttpOptionsHelp('post');

    // Assert
    expect(help).toContain('Examples:');
    expect(help).toContain('post /users');
  });
});

describe('isHttpMethod', () => {
  it('should return true for valid methods', () => {
    expect(isHttpMethod('get')).toBe(true);
    expect(isHttpMethod('GET')).toBe(true);
    expect(isHttpMethod('post')).toBe(true);
    expect(isHttpMethod('POST')).toBe(true);
    expect(isHttpMethod('put')).toBe(true);
    expect(isHttpMethod('patch')).toBe(true);
    expect(isHttpMethod('delete')).toBe(true);
    expect(isHttpMethod('head')).toBe(true);
    expect(isHttpMethod('options')).toBe(true);
  });

  it('should return false for invalid methods', () => {
    expect(isHttpMethod('foo')).toBe(false);
    expect(isHttpMethod('TRACE')).toBe(false);
    expect(isHttpMethod('')).toBe(false);
  });
});

describe('HTTP_OPTIONS', () => {
  it('should have unique short flags', () => {
    const shorts = HTTP_OPTIONS.filter((o) => o.short).map((o) => o.short);
    expect(shorts.length).toBe(new Set(shorts).size);
  });

  it('should have unique long flags', () => {
    const longs = HTTP_OPTIONS.map((o) => o.long);
    expect(longs.length).toBe(new Set(longs).size);
  });

  it('should have descriptions for all options', () => {
    for (const opt of HTTP_OPTIONS) {
      expect(opt.description).toBeTruthy();
    }
  });
});

describe('HTTP_METHODS', () => {
  it('should include all standard HTTP methods', () => {
    expect(HTTP_METHODS).toContain('get');
    expect(HTTP_METHODS).toContain('post');
    expect(HTTP_METHODS).toContain('put');
    expect(HTTP_METHODS).toContain('patch');
    expect(HTTP_METHODS).toContain('delete');
    expect(HTTP_METHODS).toContain('head');
    expect(HTTP_METHODS).toContain('options');
  });

  it('should have 7 methods', () => {
    expect(HTTP_METHODS).toHaveLength(7);
  });
});

describe('resolveHttpDefaults', () => {
  describe('S-1: Workspace defaults apply to all commands', () => {
    it('should apply workspace-level includeHeaders to any method', () => {
      // Arrange
      const workspaceDefaults = { includeHeaders: true };

      // Act
      const getDefaults = resolveHttpDefaults('get', workspaceDefaults);
      const postDefaults = resolveHttpDefaults('post', workspaceDefaults);

      // Assert
      expect(getDefaults.includeHeaders).toBe(true);
      expect(postDefaults.includeHeaders).toBe(true);
    });
  });

  describe('S-2: Profile defaults override workspace defaults', () => {
    it('should override workspace defaults with profile defaults', () => {
      // Arrange
      const workspaceDefaults = { includeHeaders: true, showSummary: true };
      const profileDefaults = { includeHeaders: false };

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults, profileDefaults);

      // Assert
      expect(defaults.includeHeaders).toBe(false); // profile override
      expect(defaults.showSummary).toBe(true); // inherited from workspace
    });
  });

  describe('S-4: Missing defaults uses built-in values', () => {
    it('should return empty object when no defaults configured', () => {
      // Act
      const defaults = resolveHttpDefaults('get', undefined, undefined);

      // Assert
      expect(defaults).toEqual({});
    });
  });

  describe('S-5: Empty defaults object is valid', () => {
    it('should return empty object for empty defaults', () => {
      // Arrange
      const workspaceDefaults = {};

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults);

      // Assert
      expect(defaults).toEqual({});
    });
  });

  describe('S-8: Complex merge scenario', () => {
    it('should merge workspace and profile correctly', () => {
      // Arrange
      const workspaceDefaults = {
        includeHeaders: true,
        showSummary: true,
        trace: false,
      };
      const profileDefaults = {
        trace: true,
        outputMode: 'json' as const,
      };

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults, profileDefaults);

      // Assert
      expect(defaults.includeHeaders).toBe(true); // from workspace
      expect(defaults.showSummary).toBe(true); // from workspace
      expect(defaults.trace).toBe(true); // profile overrides workspace
      expect(defaults.outputMode).toBe('json'); // from profile
    });
  });

  describe('S-11: Method-specific defaults apply only to that method', () => {
    it('should apply get-specific defaults only to GET', () => {
      // Arrange
      const workspaceDefaults = {
        showSummary: true,
        get: { includeHeaders: true },
      };

      // Act
      const getDefaults = resolveHttpDefaults('get', workspaceDefaults);
      const postDefaults = resolveHttpDefaults('post', workspaceDefaults);

      // Assert
      expect(getDefaults.includeHeaders).toBe(true); // get-specific
      expect(getDefaults.showSummary).toBe(true); // general
      expect(postDefaults.includeHeaders).toBeUndefined(); // not applied
      expect(postDefaults.showSummary).toBe(true); // general still applies
    });
  });

  describe('S-12: Method-specific overrides general at same level', () => {
    it('should override general with method-specific at workspace level', () => {
      // Arrange
      const workspaceDefaults = {
        includeHeaders: false,
        trace: true,
        get: {
          includeHeaders: true,
          trace: false,
        },
      };

      // Act
      const getDefaults = resolveHttpDefaults('get', workspaceDefaults);
      const postDefaults = resolveHttpDefaults('post', workspaceDefaults);

      // Assert
      expect(getDefaults.includeHeaders).toBe(true); // get overrides general
      expect(getDefaults.trace).toBe(false); // get overrides general
      expect(postDefaults.includeHeaders).toBe(false); // general
      expect(postDefaults.trace).toBe(true); // general
    });
  });

  describe('S-13: Full 4-level merge', () => {
    it('should apply all 4 layers in correct priority order', () => {
      // Arrange
      const workspaceDefaults = {
        showSummary: true, // Level 1: workspace general
        get: {
          includeHeaders: true, // Level 2: workspace.get
        },
      };
      const profileDefaults = {
        trace: true, // Level 3: profile general
        get: {
          outputMode: 'json' as const, // Level 4: profile.get
        },
      };

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults, profileDefaults);

      // Assert
      expect(defaults.showSummary).toBe(true); // workspace general
      expect(defaults.includeHeaders).toBe(true); // workspace.get
      expect(defaults.trace).toBe(true); // profile general
      expect(defaults.outputMode).toBe('json'); // profile.get
    });

    it('should allow profile.method to override workspace.method', () => {
      // Arrange
      const workspaceDefaults = {
        get: { includeHeaders: true },
      };
      const profileDefaults = {
        get: { includeHeaders: false },
      };

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults, profileDefaults);

      // Assert
      expect(defaults.includeHeaders).toBe(false); // profile.get wins
    });
  });

  describe('S-14: Different methods get different defaults', () => {
    it('should resolve different defaults per method', () => {
      // Arrange
      const workspaceDefaults = {
        showSummary: true,
        get: { includeHeaders: true },
        post: { trace: true },
        delete: { outputMode: 'json' as const },
      };

      // Act
      const getDefaults = resolveHttpDefaults('get', workspaceDefaults);
      const postDefaults = resolveHttpDefaults('post', workspaceDefaults);
      const deleteDefaults = resolveHttpDefaults('delete', workspaceDefaults);

      // Assert
      expect(getDefaults.includeHeaders).toBe(true);
      expect(getDefaults.trace).toBeUndefined();

      expect(postDefaults.trace).toBe(true);
      expect(postDefaults.includeHeaders).toBeUndefined();

      expect(deleteDefaults.outputMode).toBe('json');
      expect(deleteDefaults.includeHeaders).toBeUndefined();

      // All have showSummary
      expect(getDefaults.showSummary).toBe(true);
      expect(postDefaults.showSummary).toBe(true);
      expect(deleteDefaults.showSummary).toBe(true);
    });
  });

  describe('S-15: Empty method-specific defaults is valid', () => {
    it('should inherit general when method defaults is empty', () => {
      // Arrange
      const workspaceDefaults = {
        includeHeaders: true,
        get: {},
      };

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults);

      // Assert
      expect(defaults.includeHeaders).toBe(true); // inherited from general
    });
  });

  describe('all output defaults fields', () => {
    it('should handle all HttpOutputDefaults fields', () => {
      // Arrange
      const workspaceDefaults = {
        includeHeaders: true,
        outputMode: 'json' as const,
        showSummary: true,
        trace: true,
        showSecrets: true,
        hideBody: true,
      };

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults);

      // Assert
      expect(defaults.includeHeaders).toBe(true);
      expect(defaults.outputMode).toBe('json');
      expect(defaults.showSummary).toBe(true);
      expect(defaults.trace).toBe(true);
      expect(defaults.showSecrets).toBe(true);
      expect(defaults.hideBody).toBe(true);
    });
  });

  describe('Session defaults (S-10 from WORKSPACE-DEFAULTS-COMMAND-SPEC)', () => {
    it('should apply session defaults with highest priority', () => {
      // Arrange
      const workspaceDefaults = { includeHeaders: true, trace: false };
      const profileDefaults = { includeHeaders: false };
      const sessionDefaults = { includeHeaders: true };

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults, profileDefaults, sessionDefaults);

      // Assert
      expect(defaults.includeHeaders).toBe(true); // session wins over profile
    });

    it('should allow session to override all layers', () => {
      // Arrange - full 5-level stack
      const workspaceDefaults = {
        showSummary: true,
        trace: true,
        get: { includeHeaders: true },
      };
      const profileDefaults = {
        trace: false,
        get: { outputMode: 'json' as const },
      };
      const sessionDefaults = {
        trace: true, // override profile's false
        outputMode: 'raw' as const, // override profile.get's json
      };

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults, profileDefaults, sessionDefaults);

      // Assert
      expect(defaults.showSummary).toBe(true); // workspace
      expect(defaults.includeHeaders).toBe(true); // workspace.get
      expect(defaults.trace).toBe(true); // session wins
      expect(defaults.outputMode).toBe('raw'); // session wins over profile.get
    });

    it('should not affect other values when session only sets some', () => {
      // Arrange
      const workspaceDefaults = { includeHeaders: true, showSummary: true };
      const sessionDefaults = { trace: true };

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults, undefined, sessionDefaults);

      // Assert
      expect(defaults.includeHeaders).toBe(true); // from workspace
      expect(defaults.showSummary).toBe(true); // from workspace
      expect(defaults.trace).toBe(true); // from session
    });

    it('should work with empty session defaults', () => {
      // Arrange
      const workspaceDefaults = { includeHeaders: true };
      const sessionDefaults = {};

      // Act
      const defaults = resolveHttpDefaults('get', workspaceDefaults, undefined, sessionDefaults);

      // Assert
      expect(defaults.includeHeaders).toBe(true); // workspace unchanged
    });
  });
});

describe('parseHttpOptions with defaults', () => {
  describe('S-3: CLI flag overrides all defaults', () => {
    it('should override defaults with CLI flags', () => {
      // Arrange
      const defaults = { includeHeaders: true, showSummary: false };
      const args = ['-S']; // enable summary

      // Act
      const options = parseHttpOptions(args, defaults);

      // Assert
      expect(options.includeHeaders).toBe(true); // from defaults
      expect(options.showSummary).toBe(true); // CLI override
    });

    it('should apply defaults when no CLI flags provided', () => {
      // Arrange
      const defaults = { includeHeaders: true, outputMode: 'json' as const };
      const args: string[] = [];

      // Act
      const options = parseHttpOptions(args, defaults);

      // Assert
      expect(options.includeHeaders).toBe(true);
      expect(options.outputMode).toBe('json');
    });
  });

  it('should merge defaults with parsed CLI args', () => {
    // Arrange
    const defaults = { trace: true, showSummary: true };
    const args = ['-H', 'Auth:Bearer token', '-o', 'raw'];

    // Act
    const options = parseHttpOptions(args, defaults);

    // Assert
    expect(options.headers).toEqual(['Auth:Bearer token']);
    expect(options.outputMode).toBe('raw'); // CLI override
    expect(options.trace).toBe(true); // from defaults
    expect(options.showSummary).toBe(true); // from defaults
  });
});

describe('parseHttpCommand with defaults', () => {
  it('should pass defaults to parser', () => {
    // Arrange
    const defaults = { includeHeaders: true };
    const args = ['/users'];

    // Act
    const request = parseHttpCommand('GET', args, defaults);

    // Assert
    expect(request.includeHeaders).toBe(true);
  });

  it('should allow CLI to override defaults', () => {
    // Arrange
    const defaults = { includeHeaders: true, trace: false };
    const args = ['/users', '--trace'];

    // Act
    const request = parseHttpCommand('GET', args, defaults);

    // Assert
    expect(request.includeHeaders).toBe(true); // from defaults
    expect(request.trace).toBe(true); // CLI override
  });
});
