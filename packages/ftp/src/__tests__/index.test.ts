/**
 * @unireq/ftp - FTP transport tests
 */

import { client } from '@unireq/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type FTPConnector, type FTPFileEntry, type FTPSession, ftp, ftpOperation } from '../index.js';

/**
 * Create a mock FTP connector for testing
 */
function createMockConnector(): FTPConnector & { mockSession: FTPSession } {
  const mockSession: FTPSession = {
    connected: true,
    host: 'ftp.example.com',
    user: 'testuser',
    secure: false,
  };

  return {
    mockSession,
    capabilities: {
      ftp: true,
      ftps: true,
      delete: true,
      rename: true,
      mkdir: true,
      rmdir: true,
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

describe('@unireq/ftp - ftp() transport', () => {
  describe('transport creation', () => {
    it('should create transport with URI', () => {
      const mockConnector = createMockConnector();
      const { transport, capabilities } = ftp('ftp://ftp.example.com', mockConnector);

      expect(transport).toBeDefined();
      expect(typeof transport).toBe('function');
      expect(capabilities).toEqual({
        ftp: true,
        ftps: true,
        delete: true,
        rename: true,
        mkdir: true,
        rmdir: true,
      });
    });

    it('should create transport without URI', () => {
      const mockConnector = createMockConnector();
      const { transport, capabilities } = ftp(undefined, mockConnector);

      expect(transport).toBeDefined();
      expect(capabilities['ftp']).toBe(true);
    });

    it('should use default capabilities when no connector provided', () => {
      // This will fail at runtime without basic-ftp, but we can check the structure
      const { capabilities } = ftp('ftp://ftp.example.com');

      expect(capabilities).toEqual({
        ftp: true,
        ftps: true,
        delete: true,
        rename: true,
        mkdir: true,
        rmdir: true,
      });
    });
  });

  describe('connection handling', () => {
    it('should connect on first request', async () => {
      const mockConnector = createMockConnector();
      const { transport } = ftp('ftp://user:pass@ftp.example.com', mockConnector);

      await transport({
        url: '/path',
        method: 'GET',
        headers: {},
        operation: 'list',
      });

      expect(mockConnector.connect).toHaveBeenCalledWith('ftp://user:pass@ftp.example.com');
    });

    it('should reuse connection for subsequent requests', async () => {
      const mockConnector = createMockConnector();
      const { transport } = ftp('ftp://ftp.example.com', mockConnector);

      await transport({ url: '/path1', method: 'GET', headers: {}, operation: 'list' });
      await transport({ url: '/path2', method: 'GET', headers: {}, operation: 'list' });

      expect(mockConnector.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL handling', () => {
    it('should combine base URI with relative path', async () => {
      const mockConnector = createMockConnector();
      const { transport } = ftp('ftp://ftp.example.com', mockConnector);

      await transport({
        url: '/documents/file.txt',
        method: 'GET',
        headers: {},
        operation: 'get',
      });

      expect(mockConnector.request).toHaveBeenCalledWith(
        mockConnector.mockSession,
        expect.objectContaining({
          url: 'ftp://ftp.example.com/documents/file.txt',
        }),
      );
    });

    it('should use absolute FTP URL as-is', async () => {
      const mockConnector = createMockConnector();
      const { transport } = ftp('ftp://base.example.com', mockConnector);

      await transport({
        url: 'ftp://other.example.com/file.txt',
        method: 'GET',
        headers: {},
        operation: 'get',
      });

      expect(mockConnector.request).toHaveBeenCalledWith(
        mockConnector.mockSession,
        expect.objectContaining({
          url: 'ftp://other.example.com/file.txt',
        }),
      );
    });
  });
});

describe('@unireq/ftp - ftpOperation policy', () => {
  let mockConnector: ReturnType<typeof createMockConnector>;

  beforeEach(() => {
    mockConnector = createMockConnector();
  });

  it('should inject list operation', async () => {
    const { transport } = ftp('ftp://ftp.example.com', mockConnector);
    const api = client(transport);

    await api.get('/directory', ftpOperation('list'));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'list',
      }),
    );
  });

  it('should inject get operation', async () => {
    const { transport } = ftp('ftp://ftp.example.com', mockConnector);
    const api = client(transport);

    await api.get('/file.txt', ftpOperation('get'));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'get',
      }),
    );
  });

  it('should inject put operation', async () => {
    const { transport } = ftp('ftp://ftp.example.com', mockConnector);
    const api = client(transport);

    await api.put('/upload.txt', 'file content', ftpOperation('put'));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'put',
        body: 'file content',
      }),
    );
  });

  it('should inject delete operation', async () => {
    const { transport } = ftp('ftp://ftp.example.com', mockConnector);
    const api = client(transport);

    await api.delete('/old-file.txt', ftpOperation('delete'));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'delete',
      }),
    );
  });

  it('should inject rename operation with destination', async () => {
    const { transport } = ftp('ftp://ftp.example.com', mockConnector);
    const api = client(transport);

    await api.get('/old-name.txt', ftpOperation('rename', { destination: '/new-name.txt' }));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'rename',
        destination: '/new-name.txt',
      }),
    );
  });

  it('should inject mkdir operation', async () => {
    const { transport } = ftp('ftp://ftp.example.com', mockConnector);
    const api = client(transport);

    await api.get('/new-folder', ftpOperation('mkdir'));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'mkdir',
      }),
    );
  });

  it('should inject rmdir operation', async () => {
    const { transport } = ftp('ftp://ftp.example.com', mockConnector);
    const api = client(transport);

    await api.get('/old-folder', ftpOperation('rmdir'));

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        operation: 'rmdir',
      }),
    );
  });
});

describe('@unireq/ftp - FTPConnector interface', () => {
  it('should support custom connector implementation', async () => {
    const customConnector: FTPConnector = {
      capabilities: {
        ftp: true,
        ftps: false,
        delete: true,
        rename: false,
        mkdir: true,
        rmdir: false,
      },
      connect: vi.fn().mockResolvedValue({
        connected: true,
        host: 'custom.example.com',
        user: 'custom',
        secure: false,
      }),
      request: vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: [{ name: 'custom-file.txt', type: 0, size: 100 }] as FTPFileEntry[],
        ok: true,
      }),
      disconnect: vi.fn(),
    };

    const { transport, capabilities } = ftp('ftp://custom.example.com', customConnector);
    const api = client(transport);

    const response = await api.get<FTPFileEntry[]>('/path', ftpOperation('list'));

    expect(capabilities['ftps']).toBe(false);
    expect(capabilities['rename']).toBe(false);
    expect(response.data).toHaveLength(1);
    expect(response.data?.[0]?.name).toBe('custom-file.txt');
  });
});

describe('@unireq/ftp - response handling', () => {
  it('should return successful response', async () => {
    const mockFiles: FTPFileEntry[] = [
      { name: 'file1.txt', type: 0, size: 1024 },
      { name: 'folder', type: 1 },
    ];

    const mockConnector = createMockConnector();
    (mockConnector.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: mockFiles,
      ok: true,
    });

    const { transport } = ftp('ftp://ftp.example.com', mockConnector);
    const api = client(transport);

    const response = await api.get<FTPFileEntry[]>('/directory', ftpOperation('list'));

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.data).toEqual(mockFiles);
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

    const { transport } = ftp('ftp://ftp.example.com', mockConnector);
    const api = client(transport);

    const response = await api.get('/path', ftpOperation('list'));

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
    expect((response.data as { error: string }).error).toBe('Connection refused');
  });
});

describe('@unireq/ftp - FTPS support', () => {
  it('should handle FTPS URI', async () => {
    const mockConnector = createMockConnector();
    const { transport } = ftp('ftps://secure.example.com', mockConnector);

    await transport({
      url: '/secure-file.txt',
      method: 'GET',
      headers: {},
      operation: 'get',
    });

    expect(mockConnector.connect).toHaveBeenCalledWith('ftps://secure.example.com');
  });
});
