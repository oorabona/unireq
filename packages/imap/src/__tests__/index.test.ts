/**
 * @unireq/imap - IMAP transport tests
 */

import { client } from '@unireq/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type IMAPConnector, type IMAPMessage, type IMAPSession, imap, imapOperation, xoauth2 } from '../index.js';

/**
 * Create a mock IMAP connector for testing
 */
function createMockConnector(): IMAPConnector & { mockSession: IMAPSession } {
  const mockSession: IMAPSession = {
    connected: true,
    host: 'imap.example.com',
    user: 'testuser',
    usable: true,
    secure: true,
  };

  return {
    mockSession,
    capabilities: {
      imap: true,
      xoauth2: true,
      idle: true,
      append: true,
      search: true,
      move: true,
      flags: true,
      expunge: true,
    },
    connect: vi.fn().mockResolvedValue(mockSession),
    request: vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: [],
      ok: true,
    }),
    disconnect: vi.fn(),
  };
}

describe('@unireq/imap - imap() transport', () => {
  describe('transport creation', () => {
    it('should create transport with URI', () => {
      const mockConnector = createMockConnector();
      const { transport, capabilities } = imap('imap://imap.example.com', mockConnector);

      expect(transport).toBeDefined();
      expect(typeof transport).toBe('function');
      expect(capabilities).toEqual({
        imap: true,
        xoauth2: true,
        idle: true,
        append: true,
        search: true,
        move: true,
        flags: true,
        expunge: true,
      });
    });

    it('should create transport without URI', () => {
      const mockConnector = createMockConnector();
      const { transport, capabilities } = imap(undefined, mockConnector);

      expect(transport).toBeDefined();
      expect(capabilities['imap']).toBe(true);
    });

    it('should use default capabilities when no connector provided', () => {
      // This will fail at runtime without imapflow, but we can check the structure
      const { capabilities } = imap('imap://imap.example.com');

      expect(capabilities).toEqual({
        imap: true,
        xoauth2: true,
        idle: true,
        append: true,
        search: true,
        move: true,
        flags: true,
        expunge: true,
      });
    });
  });

  describe('connection handling', () => {
    it('should connect on first request', async () => {
      const mockConnector = createMockConnector();
      const { transport } = imap('imap://user:pass@imap.example.com', mockConnector);

      await transport({
        url: '/',
        method: 'GET',
        headers: {},
        operation: 'fetch',
        mailbox: 'INBOX',
      });

      expect(mockConnector.connect).toHaveBeenCalledWith('imap://user:pass@imap.example.com');
    });

    it('should reuse connection for subsequent requests', async () => {
      const mockConnector = createMockConnector();
      const { transport } = imap('imap://imap.example.com', mockConnector);

      await transport({ url: '/', method: 'GET', headers: {}, operation: 'fetch', mailbox: 'INBOX' });
      await transport({ url: '/', method: 'GET', headers: {}, operation: 'fetch', mailbox: 'Sent' });

      expect(mockConnector.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL handling', () => {
    it('should combine base URI with relative path', async () => {
      const mockConnector = createMockConnector();
      const { transport } = imap('imap://imap.example.com', mockConnector);

      await transport({
        url: '/INBOX',
        method: 'GET',
        headers: {},
        operation: 'fetch',
      });

      expect(mockConnector.request).toHaveBeenCalledWith(
        mockConnector.mockSession,
        expect.objectContaining({
          url: 'imap://imap.example.com/INBOX',
        }),
      );
    });

    it('should use absolute IMAP URL as-is', async () => {
      const mockConnector = createMockConnector();
      const { transport } = imap('imap://base.example.com', mockConnector);

      await transport({
        url: 'imap://other.example.com/INBOX',
        method: 'GET',
        headers: {},
        operation: 'fetch',
      });

      expect(mockConnector.request).toHaveBeenCalledWith(
        mockConnector.mockSession,
        expect.objectContaining({
          url: 'imap://other.example.com/INBOX',
        }),
      );
    });
  });
});

describe('@unireq/imap - imapOperation policy', () => {
  let mockConnector: ReturnType<typeof createMockConnector>;

  beforeEach(() => {
    mockConnector = createMockConnector();
  });

  it('should inject fetch operation', async () => {
    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    await api.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'fetch',
        mailbox: 'INBOX',
      }),
    );
  });

  it('should inject search operation with criteria', async () => {
    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    await api.get(
      '/',
      imapOperation('search', {
        mailbox: 'INBOX',
        criteria: { from: 'sender@example.com' },
      }),
    );

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'search',
        mailbox: 'INBOX',
        criteria: { from: 'sender@example.com' },
      }),
    );
  });

  it('should inject append operation', async () => {
    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    await api.post('/INBOX', 'raw email content', imapOperation('append', { mailbox: 'INBOX' }));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'append',
        mailbox: 'INBOX',
        body: 'raw email content',
      }),
    );
  });

  it('should inject move operation with destination', async () => {
    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    await api.get(
      '/',
      imapOperation('move', {
        mailbox: 'INBOX',
        range: '1:5',
        destination: 'Trash',
      }),
    );

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'move',
        mailbox: 'INBOX',
        range: '1:5',
        destination: 'Trash',
      }),
    );
  });

  it('should inject addFlags operation', async () => {
    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    await api.get(
      '/',
      imapOperation('addFlags', {
        mailbox: 'INBOX',
        range: '1:*',
        flags: ['\\Seen'],
      }),
    );

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'addFlags',
        mailbox: 'INBOX',
        flags: ['\\Seen'],
      }),
    );
  });

  it('should inject removeFlags operation', async () => {
    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    await api.get(
      '/',
      imapOperation('removeFlags', {
        mailbox: 'INBOX',
        range: '1:*',
        flags: ['\\Flagged'],
      }),
    );

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'removeFlags',
        mailbox: 'INBOX',
        flags: ['\\Flagged'],
      }),
    );
  });

  it('should inject idle operation', async () => {
    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    await api.get('/', imapOperation('idle'));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'idle',
      }),
    );
  });

  it('should inject expunge operation', async () => {
    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    await api.get('/', imapOperation('expunge', { mailbox: 'INBOX' }));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'expunge',
        mailbox: 'INBOX',
      }),
    );
  });
});

describe('@unireq/imap - IMAPConnector interface', () => {
  it('should support custom connector implementation', async () => {
    const customConnector: IMAPConnector = {
      capabilities: {
        imap: true,
        xoauth2: false,
        idle: true,
        append: true,
        search: true,
        move: false,
        flags: true,
        expunge: true,
      },
      connect: vi.fn().mockResolvedValue({
        connected: true,
        host: 'custom.example.com',
        user: 'custom',
        usable: true,
        secure: false,
      }),
      request: vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: [
          { seq: 1, uid: 101, envelope: { subject: 'Test' } },
          { seq: 2, uid: 102, envelope: { subject: 'Test 2' } },
        ] as IMAPMessage[],
        ok: true,
      }),
      disconnect: vi.fn(),
    };

    const { transport, capabilities } = imap('imap://custom.example.com', customConnector);
    const api = client(transport);

    const response = await api.get<IMAPMessage[]>('/', imapOperation('fetch', { mailbox: 'INBOX' }));

    expect(capabilities['xoauth2']).toBe(false);
    expect(capabilities['move']).toBe(false);
    expect(response.data).toHaveLength(2);
    expect(response.data?.[0]?.uid).toBe(101);
  });
});

describe('@unireq/imap - response handling', () => {
  it('should return successful response', async () => {
    const mockMessages: IMAPMessage[] = [
      { seq: 1, uid: 100, envelope: { subject: 'Hello' } },
      { seq: 2, uid: 101, envelope: { subject: 'World' } },
    ];

    const mockConnector = createMockConnector();
    (mockConnector.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: mockMessages,
      ok: true,
    });

    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    const response = await api.get<IMAPMessage[]>('/', imapOperation('fetch', { mailbox: 'INBOX' }));

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.data).toEqual(mockMessages);
  });

  it('should return error response', async () => {
    const mockConnector = createMockConnector();
    (mockConnector.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 500,
      statusText: 'Error',
      headers: {},
      data: { error: 'Connection refused' },
      ok: false,
    });

    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    const response = await api.get('/', imapOperation('fetch', { mailbox: 'INBOX' }));

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
    expect((response.data as { error: string }).error).toBe('Connection refused');
  });
});

describe('@unireq/imap - IMAPS support', () => {
  it('should handle IMAPS URI', async () => {
    const mockConnector = createMockConnector();
    const { transport } = imap('imaps://secure.example.com', mockConnector);

    await transport({
      url: '/',
      method: 'GET',
      headers: {},
      operation: 'fetch',
      mailbox: 'INBOX',
    });

    expect(mockConnector.connect).toHaveBeenCalledWith('imaps://secure.example.com');
  });
});

describe('@unireq/imap - xoauth2 policy', () => {
  it('should add xoauth2 token to context', async () => {
    const mockConnector = createMockConnector();
    const tokenSupplier = vi.fn().mockReturnValue('mock-oauth-token');

    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    // Use xoauth2 with imapOperation
    await api.get('/', xoauth2({ tokenSupplier }), imapOperation('fetch', { mailbox: 'INBOX' }));

    expect(tokenSupplier).toHaveBeenCalled();
    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        xoauth2Token: 'mock-oauth-token',
        operation: 'fetch',
        mailbox: 'INBOX',
      }),
    );
  });

  it('should support async token supplier', async () => {
    const mockConnector = createMockConnector();
    const asyncTokenSupplier = vi.fn().mockResolvedValue('async-oauth-token');

    const { transport } = imap('imap://imap.example.com', mockConnector);
    const api = client(transport);

    await api.get('/', xoauth2({ tokenSupplier: asyncTokenSupplier }), imapOperation('fetch', { mailbox: 'INBOX' }));

    expect(asyncTokenSupplier).toHaveBeenCalled();
    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        xoauth2Token: 'async-oauth-token',
      }),
    );
  });

  it('should preserve existing context properties', async () => {
    const tokenSupplier = vi.fn().mockReturnValue('token');
    const policyFn = xoauth2({ tokenSupplier });

    let capturedContext: Record<string, unknown> | null = null;
    await policyFn(
      {
        url: 'imap://imap.example.com',
        method: 'GET',
        headers: { 'x-custom': 'value' },
        body: 'data',
      },
      async (ctx) => {
        capturedContext = ctx as Record<string, unknown>;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: 'OK',
          ok: true,
        };
      },
    );

    expect(capturedContext).not.toBeNull();
    expect(capturedContext?.['url']).toBe('imap://imap.example.com');
    expect(capturedContext?.['method']).toBe('GET');
    expect(capturedContext?.['headers']).toEqual({ 'x-custom': 'value' });
    expect(capturedContext?.['body']).toBe('data');
    expect(capturedContext?.['xoauth2Token']).toBe('token');
  });

  it('should call token supplier each time policy is invoked', async () => {
    const tokenSupplier = vi.fn().mockReturnValue('token-1');
    const policyFn = xoauth2({ tokenSupplier });

    const mockNext = async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'OK',
      ok: true,
    });

    await policyFn({ url: 'imap://imap.example.com', method: 'GET', headers: {} }, mockNext);
    expect(tokenSupplier).toHaveBeenCalledTimes(1);

    tokenSupplier.mockReturnValue('token-2');

    await policyFn({ url: 'imap://imap.example.com', method: 'GET', headers: {} }, mockNext);
    expect(tokenSupplier).toHaveBeenCalledTimes(2);
  });

  it('should handle token supplier errors', async () => {
    const tokenSupplier = vi.fn().mockRejectedValue(new Error('Token expired'));
    const policyFn = xoauth2({ tokenSupplier });

    await expect(
      policyFn({ url: 'imap://imap.example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow('Token expired');
  });
});
