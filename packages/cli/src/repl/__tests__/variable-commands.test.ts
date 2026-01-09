/**
 * Tests for echo and set commands
 */

import { consola } from 'consola';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplState } from '../state.js';
import { createEchoCommand, createSetCommand, echoHandler, setHandler } from '../variable-commands.js';

// Mock consola
vi.mock('consola', () => ({
  consola: {
    log: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('echoHandler', () => {
  let state: ReplState;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      currentPath: '/',
      running: true,
      lastResponseStatus: 200,
      lastResponseStatusText: 'OK',
      lastResponseHeaders: {
        'content-type': 'application/json',
        'x-request-id': 'abc123',
      },
      lastResponseBody: JSON.stringify({
        data: [{ id: 1, name: 'Alice' }],
        token: 'secret-token',
      }),
      lastResponseTiming: {
        total: 150,
        dns: 10,
        tcp: 20,
        tls: 30,
        ttfb: 40,
        download: 50,
        startTime: 1000,
        endTime: 1150,
      },
      extractedVars: {
        userId: '123',
        token: 'my-token',
      },
    };
  });

  it('displays _.status', async () => {
    await echoHandler(['_.status'], state);
    expect(consola.log).toHaveBeenCalledWith('200');
  });

  it('displays _.statusText', async () => {
    await echoHandler(['_.statusText'], state);
    expect(consola.log).toHaveBeenCalledWith('OK');
  });

  it('displays _.headers', async () => {
    await echoHandler(['_.headers'], state);
    expect(consola.log).toHaveBeenCalledWith(
      JSON.stringify({ 'content-type': 'application/json', 'x-request-id': 'abc123' }, null, 2),
    );
  });

  it('displays _.headers.content-type', async () => {
    await echoHandler(['_.headers.content-type'], state);
    expect(consola.log).toHaveBeenCalledWith('application/json');
  });

  it('displays _.headers case-insensitively', async () => {
    await echoHandler(['_.headers.Content-Type'], state);
    expect(consola.log).toHaveBeenCalledWith('application/json');
  });

  it('displays _.body', async () => {
    await echoHandler(['_.body'], state);
    // Body is parsed as JSON and pretty-printed
    const expectedParsed = JSON.parse(state.lastResponseBody!);
    expect(consola.log).toHaveBeenCalledWith(JSON.stringify(expectedParsed, null, 2));
  });

  it('displays _.body.token using JSONPath', async () => {
    await echoHandler(['_.body.token'], state);
    expect(consola.log).toHaveBeenCalledWith('secret-token');
  });

  it('displays _.body.data[0].name using JSONPath', async () => {
    await echoHandler(['_.body.data[0].name'], state);
    expect(consola.log).toHaveBeenCalledWith('Alice');
  });

  it('displays _.timing', async () => {
    await echoHandler(['_.timing'], state);
    const expected = JSON.stringify(state.lastResponseTiming, null, 2);
    expect(consola.log).toHaveBeenCalledWith(expected);
  });

  it('displays _.timing.total', async () => {
    await echoHandler(['_.timing.total'], state);
    expect(consola.log).toHaveBeenCalledWith('150');
  });

  it('displays variable with $varname', async () => {
    await echoHandler(['$userId'], state);
    expect(consola.log).toHaveBeenCalledWith('123');
  });

  it('displays variable with ${varname}', async () => {
    await echoHandler(['${token}'], state);
    expect(consola.log).toHaveBeenCalledWith('my-token');
  });

  it('shows error when no expression provided', async () => {
    await echoHandler([], state);
    expect(consola.error).toHaveBeenCalledWith('No expression provided');
  });

  it('shows error when variable not found', async () => {
    await echoHandler(['$unknown'], state);
    expect(consola.error).toHaveBeenCalledWith('Variable not found: unknown');
  });

  it('shows error when no response available', async () => {
    const emptyState: ReplState = {
      currentPath: '/',
      running: true,
    };
    await echoHandler(['_.status'], emptyState);
    expect(consola.error).toHaveBeenCalledWith('No response available. Execute an HTTP request first.');
  });

  it('displays plain string as-is', async () => {
    await echoHandler(['hello', 'world'], state);
    expect(consola.log).toHaveBeenCalledWith('hello world');
  });
});

describe('setHandler', () => {
  let state: ReplState;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      currentPath: '/',
      running: true,
      lastResponseStatus: 200,
      lastResponseStatusText: 'OK',
      lastResponseHeaders: {
        'content-type': 'application/json',
      },
      lastResponseBody: JSON.stringify({
        access_token: 'jwt-token-here',
        user: { id: 'user-123' },
      }),
    };
  });

  it('sets variable from _.status', async () => {
    await setHandler(['status', '=', '_.status'], state);
    expect(state.extractedVars?.['status']).toBe('200');
    expect(consola.success).toHaveBeenCalled();
  });

  it('sets variable from _.body.access_token', async () => {
    await setHandler(['token', '=', '_.body.access_token'], state);
    expect(state.extractedVars?.['token']).toBe('jwt-token-here');
  });

  it('sets variable from nested path', async () => {
    await setHandler(['userId', '=', '_.body.user.id'], state);
    expect(state.extractedVars?.['userId']).toBe('user-123');
  });

  it('shows error for invalid variable name', async () => {
    await setHandler(['123invalid', '=', '_.status'], state);
    expect(consola.error).toHaveBeenCalledWith('Invalid variable name: 123invalid');
  });

  it('shows error when missing =', async () => {
    await setHandler(['token', '_.status'], state);
    expect(consola.error).toHaveBeenCalledWith('Usage: set <name> = <expression>');
  });

  it('shows error when missing expression', async () => {
    await setHandler(['token', '='], state);
    expect(consola.error).toHaveBeenCalledWith('Usage: set <name> = <expression>');
  });

  it('shows error when no response available', async () => {
    const emptyState: ReplState = {
      currentPath: '/',
      running: true,
    };
    await setHandler(['token', '=', '_.body.token'], emptyState);
    expect(consola.error).toHaveBeenCalledWith('No response available. Execute an HTTP request first.');
  });

  it('initializes extractedVars if not present', async () => {
    const newState: ReplState = {
      currentPath: '/',
      running: true,
      lastResponseStatus: 200,
    };
    expect(newState.extractedVars).toBeUndefined();
    await setHandler(['status', '=', '_.status'], newState);
    expect(newState.extractedVars).toBeDefined();
    expect(newState.extractedVars?.['status']).toBe('200');
  });

  it('truncates long values in success message', async () => {
    const longBody = JSON.stringify({ longValue: 'a'.repeat(100) });
    state.lastResponseBody = longBody;
    await setHandler(['long', '=', '_.body.longValue'], state);
    expect(consola.success).toHaveBeenCalledWith(expect.stringContaining('...'));
  });
});

describe('createEchoCommand', () => {
  it('creates command with correct metadata', () => {
    const cmd = createEchoCommand();
    expect(cmd.name).toBe('echo');
    expect(cmd.description).toBe('Evaluate and display an expression');
    expect(cmd.handler).toBe(echoHandler);
    expect(cmd.helpText).toContain('_.status');
  });
});

describe('createSetCommand', () => {
  it('creates command with correct metadata', () => {
    const cmd = createSetCommand();
    expect(cmd.name).toBe('set');
    expect(cmd.description).toBe('Set a variable from an expression');
    expect(cmd.handler).toBe(setHandler);
    expect(cmd.helpText).toContain('set <name> = <expression>');
  });
});
