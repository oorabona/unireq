/**
 * @unireq/cookies - Cookie jar tests
 */

import { describe, expect, it, vi } from 'vitest';
import { cookieJar } from '../index.js';

describe('@unireq/cookies - cookieJar policy', () => {
  it('should add cookies from jar to request', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue('session=abc123; user=john'),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    let capturedHeaders: Record<string, unknown> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      };
    });

    expect(mockJar.getCookieString).toHaveBeenCalledWith('https://example.com');
    expect(capturedHeaders['cookie']).toBe('session=abc123; user=john');
  });

  it('should not add cookie header when jar is empty', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue(''),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    let capturedHeaders: Record<string, unknown> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      };
    });

    expect(capturedHeaders['cookie']).toBeUndefined();
  });

  it('should store Set-Cookie headers from response', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue(''),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'set-cookie': 'session=xyz789; Path=/; HttpOnly' },
      data: 'OK',
      ok: true,
    }));

    expect(mockJar.setCookie).toHaveBeenCalledWith('session=xyz789; Path=/; HttpOnly', 'https://example.com');
  });

  it('should store Set-Cookie with capital S', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue(''),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'Set-Cookie': 'token=abc; Secure' },
      data: 'OK',
      ok: true,
    }));

    expect(mockJar.setCookie).toHaveBeenCalledWith('token=abc; Secure', 'https://example.com');
  });

  it('should handle multiple Set-Cookie headers', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue(''),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    await policy(
      { url: 'https://example.com', method: 'GET', headers: {} },
      async () =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {
            'set-cookie': ['session=xyz; Path=/', 'user=john; Path=/'],
          },
          data: 'OK',
          ok: true,
        }) as any,
    );

    expect(mockJar.setCookie).toHaveBeenCalledTimes(2);
    expect(mockJar.setCookie).toHaveBeenCalledWith('session=xyz; Path=/', 'https://example.com');
    expect(mockJar.setCookie).toHaveBeenCalledWith('user=john; Path=/', 'https://example.com');
  });

  it('should reject cookies with CRLF in value', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue('malicious=test\r\nInjection: evil'),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow('Invalid cookie value: contains CRLF characters');
  });

  it('should reject cookies with carriage return', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue('bad=value\r'),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow('Invalid cookie value: contains CRLF characters');
  });

  it('should reject cookies with line feed', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue('bad=value\n'),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow('Invalid cookie value: contains CRLF characters');
  });

  it('should skip invalid Set-Cookie headers with CRLF', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });

    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue(''),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'set-cookie': 'bad=value\r\nInjection: evil' },
      data: 'OK',
      ok: true,
    }));

    expect(mockJar.setCookie).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Skipping invalid Set-Cookie header: contains CRLF characters (potential injection attack)',
    );

    consoleWarnSpy.mockRestore();
  });

  it('should preserve existing headers', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue('session=abc'),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    let capturedHeaders: Record<string, unknown> = {};
    await policy(
      {
        url: 'https://example.com',
        method: 'GET',
        headers: { 'x-custom': 'value' },
      },
      async (ctx) => {
        capturedHeaders = ctx.headers;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: 'OK',
          ok: true,
        };
      },
    );

    expect(capturedHeaders['cookie']).toBe('session=abc');
    expect(capturedHeaders['x-custom']).toBe('value');
  });

  it('should work with synchronous jar methods', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockReturnValue('sync=cookie'),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    let capturedHeaders: Record<string, unknown> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'set-cookie': 'response=cookie' },
        data: 'OK',
        ok: true,
      };
    });

    expect(capturedHeaders['cookie']).toBe('sync=cookie');
    expect(mockJar.setCookie).toHaveBeenCalledWith('response=cookie', 'https://example.com');
  });

  it('should handle response without Set-Cookie', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue(''),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'OK',
      ok: true,
    }));

    expect(mockJar.setCookie).not.toHaveBeenCalled();
  });

  it('should work across multiple requests', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue('session=initial'),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    // First request
    await policy({ url: 'https://example.com/login', method: 'POST', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'set-cookie': 'session=new123' },
      data: 'logged in',
      ok: true,
    }));

    expect(mockJar.setCookie).toHaveBeenCalledWith('session=new123', 'https://example.com/login');

    // Update mock to return new cookie
    mockJar.getCookieString.mockResolvedValue('session=new123');

    // Second request
    let capturedHeaders: Record<string, unknown> = {};
    await policy({ url: 'https://example.com/profile', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'profile data',
        ok: true,
      };
    });

    expect(capturedHeaders['cookie']).toBe('session=new123');
  });

  it('should handle empty string from getCookieString', async () => {
    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue(''),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    let capturedHeaders: Record<string, unknown> = {};
    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
      capturedHeaders = ctx.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      };
    });

    expect(capturedHeaders['cookie']).toBeUndefined();
  });

  it('should validate each cookie in array separately', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });

    const mockJar = {
      getCookieString: vi.fn().mockResolvedValue(''),
      setCookie: vi.fn(),
    };

    const policy = cookieJar(mockJar);

    await policy(
      { url: 'https://example.com', method: 'GET', headers: {} },
      async () =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {
            'set-cookie': ['valid=cookie; Path=/', 'invalid=value\r\nBad: header', 'another=valid; Secure'],
          },
          data: 'OK',
          ok: true,
        }) as any,
    );

    expect(mockJar.setCookie).toHaveBeenCalledTimes(2);
    expect(mockJar.setCookie).toHaveBeenCalledWith('valid=cookie; Path=/', 'https://example.com');
    expect(mockJar.setCookie).toHaveBeenCalledWith('another=valid; Secure', 'https://example.com');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Skipping invalid Set-Cookie header: contains CRLF characters (potential injection attack)',
    );

    consoleWarnSpy.mockRestore();
  });
});
