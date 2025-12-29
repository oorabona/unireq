import type { Policy, RequestContext, Response } from '@unireq/core';
import type { FTPConnector, FTPSession } from '@unireq/ftp';
import type { IMAPConnector, IMAPSession } from '@unireq/imap';
import { describe, expect, it, vi } from 'vitest';
import { preset } from '../builder.js';
import { FtpFacadeBuilder, ftpPreset } from '../ftp-facade.js';
import { H2FacadeBuilder, h2Preset } from '../h2-facade.js';
import { ImapFacadeBuilder, imapPreset } from '../imap-facade.js';

/**
 * Create a mock IMAP connector matching the IMAPConnector interface
 */
function createMockImapConnector(): IMAPConnector {
  const mockSession: IMAPSession = {
    connected: true,
    host: 'imap.example.com',
    user: 'testuser',
    usable: true,
    secure: true,
  };

  return {
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

/**
 * Create a mock FTP connector matching the FTPConnector interface
 */
function createMockFtpConnector(): FTPConnector {
  const mockSession: FTPSession = {
    connected: true,
    host: 'ftp.example.com',
    user: 'testuser',
    secure: false,
  };

  return {
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

/**
 * Create a mock Policy (policies are functions, not objects)
 */
function createMockPolicy(): Policy {
  const policy: Policy = async (ctx: RequestContext, next: (ctx: RequestContext) => Promise<Response>) => {
    return next(ctx);
  };
  return policy;
}

describe('@unireq/presets - IMAP Facade', () => {
  describe('imapPreset entry point', () => {
    it('should provide builder entry point', () => {
      expect(imapPreset.builder).toBeInstanceOf(ImapFacadeBuilder);
    });

    it('should provide uri method', () => {
      const builder = imapPreset.uri('imap://user:pass@imap.example.com');
      expect(builder).toBeInstanceOf(ImapFacadeBuilder);
    });

    it('should be accessible via preset.imap', () => {
      expect(preset.imap).toBeInstanceOf(ImapFacadeBuilder);
    });
  });

  describe('ImapFacadeBuilder property chaining', () => {
    it('should chain .uri()', () => {
      const builder = preset.imap.uri('imap://user:pass@imap.gmail.com');
      expect(builder).toBeInstanceOf(ImapFacadeBuilder);
    });

    it('should chain .connector()', () => {
      const mockConnector = createMockImapConnector();
      const builder = preset.imap.connector(mockConnector);
      expect(builder).toBeInstanceOf(ImapFacadeBuilder);
    });

    it('should chain .auth()', () => {
      const builder = preset.imap.auth({ tokenSupplier: () => 'token' });
      expect(builder).toBeInstanceOf(ImapFacadeBuilder);
    });

    it('should chain .retry as property', () => {
      const builder = preset.imap.retry;
      expect(builder).toBeInstanceOf(ImapFacadeBuilder);
    });

    it('should chain .withRetry() with options', () => {
      const builder = preset.imap.withRetry({ tries: 5 });
      expect(builder).toBeInstanceOf(ImapFacadeBuilder);
    });

    it('should chain multiple options', () => {
      const mockConnector = createMockImapConnector();
      const builder = preset.imap
        .uri('imap://user:pass@imap.gmail.com')
        .connector(mockConnector)
        .auth({ tokenSupplier: () => 'token' }).retry;
      expect(builder).toBeInstanceOf(ImapFacadeBuilder);
    });

    it('should chain .with() for custom policies', () => {
      const mockPolicy = createMockPolicy();
      const builder = preset.imap.with(mockPolicy);
      expect(builder).toBeInstanceOf(ImapFacadeBuilder);
    });
  });

  describe('ImapFacadeBuilder.build()', () => {
    it('should throw error if uri is not provided', () => {
      expect(() => preset.imap.build()).toThrow('IMAP URI is required');
    });

    it('should build client with uri and connector', () => {
      const mockConnector = createMockImapConnector();
      const mailClient = preset.imap.uri('imap://user:pass@imap.example.com').connector(mockConnector).build();

      expect(mailClient).toBeDefined();
      // Core operations
      expect(typeof mailClient.fetch).toBe('function');
      expect(typeof mailClient.select).toBe('function');
      expect(typeof mailClient.append).toBe('function');
      expect(typeof mailClient.idle).toBe('function');
      // Extended operations
      expect(typeof mailClient.search).toBe('function');
      expect(typeof mailClient.move).toBe('function');
      expect(typeof mailClient.addFlags).toBe('function');
      expect(typeof mailClient.removeFlags).toBe('function');
      expect(typeof mailClient.expunge).toBe('function');
      expect(mailClient.raw).toBeDefined();
    });

    it('should build client with all options', () => {
      const mockConnector = createMockImapConnector();
      const mailClient = preset.imap
        .uri('imap://user:pass@imap.gmail.com')
        .connector(mockConnector)
        .auth({ tokenSupplier: () => 'token' })
        .withRetry({ tries: 5 })
        .build();

      expect(mailClient).toBeDefined();
      expect(typeof mailClient.fetch).toBe('function');
    });
  });

  describe('ImapClient interface', () => {
    it('should expose raw client', () => {
      const mockConnector = createMockImapConnector();
      const mailClient = preset.imap.uri('imap://user:pass@imap.example.com').connector(mockConnector).build();

      expect(mailClient.raw).toBeDefined();
      expect(typeof mailClient.raw.get).toBe('function');
      expect(typeof mailClient.raw.post).toBe('function');
    });
  });
});

describe('@unireq/presets - FTP Facade', () => {
  describe('ftpPreset entry point', () => {
    it('should provide builder entry point', () => {
      expect(ftpPreset.builder).toBeInstanceOf(FtpFacadeBuilder);
    });

    it('should provide uri method', () => {
      const builder = ftpPreset.uri('ftp://user:pass@ftp.example.com');
      expect(builder).toBeInstanceOf(FtpFacadeBuilder);
    });

    it('should be accessible via preset.ftp', () => {
      expect(preset.ftp).toBeInstanceOf(FtpFacadeBuilder);
    });
  });

  describe('FtpFacadeBuilder property chaining', () => {
    it('should chain .uri()', () => {
      const builder = preset.ftp.uri('ftp://user:pass@ftp.example.com');
      expect(builder).toBeInstanceOf(FtpFacadeBuilder);
    });

    it('should chain .connector()', () => {
      const mockConnector = createMockFtpConnector();
      const builder = preset.ftp.connector(mockConnector);
      expect(builder).toBeInstanceOf(FtpFacadeBuilder);
    });

    it('should chain .retry as property', () => {
      const builder = preset.ftp.retry;
      expect(builder).toBeInstanceOf(FtpFacadeBuilder);
    });

    it('should chain .withRetry() with options', () => {
      const builder = preset.ftp.withRetry({ tries: 5 });
      expect(builder).toBeInstanceOf(FtpFacadeBuilder);
    });

    it('should chain multiple options', () => {
      const mockConnector = createMockFtpConnector();
      const builder = preset.ftp
        .uri('ftp://user:pass@ftp.example.com')
        .connector(mockConnector)
        .withRetry({ tries: 3 });
      expect(builder).toBeInstanceOf(FtpFacadeBuilder);
    });

    it('should chain .with() for custom policies', () => {
      const mockPolicy = createMockPolicy();
      const builder = preset.ftp.with(mockPolicy);
      expect(builder).toBeInstanceOf(FtpFacadeBuilder);
    });
  });

  describe('FtpFacadeBuilder.build()', () => {
    it('should throw error if uri is not provided', () => {
      expect(() => preset.ftp.build()).toThrow('FTP URI is required');
    });

    it('should build client with uri and connector', () => {
      const mockConnector = createMockFtpConnector();
      const ftp = preset.ftp.uri('ftp://user:pass@ftp.example.com').connector(mockConnector).build();

      expect(ftp).toBeDefined();
      // Core operations
      expect(typeof ftp.list).toBe('function');
      expect(typeof ftp.download).toBe('function');
      expect(typeof ftp.upload).toBe('function');
      // Extended operations
      expect(typeof ftp.delete).toBe('function');
      expect(typeof ftp.rename).toBe('function');
      expect(typeof ftp.mkdir).toBe('function');
      expect(typeof ftp.rmdir).toBe('function');
      expect(ftp.raw).toBeDefined();
    });

    it('should build client with retry option', () => {
      const mockConnector = createMockFtpConnector();
      const ftp = preset.ftp.uri('ftp://user:pass@ftp.example.com').connector(mockConnector).retry.build();

      expect(ftp).toBeDefined();
      expect(typeof ftp.list).toBe('function');
    });
  });

  describe('FtpClient interface', () => {
    it('should expose raw client', () => {
      const mockConnector = createMockFtpConnector();
      const ftp = preset.ftp.uri('ftp://user:pass@ftp.example.com').connector(mockConnector).build();

      expect(ftp.raw).toBeDefined();
      expect(typeof ftp.raw.get).toBe('function');
      expect(typeof ftp.raw.put).toBe('function');
    });
  });
});

describe('@unireq/presets - HTTP/2 Facade', () => {
  describe('h2Preset entry point', () => {
    it('should provide builder entry point', () => {
      expect(h2Preset.builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should provide uri method', () => {
      const builder = h2Preset.uri('https://api.example.com');
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should be accessible via preset.h2', () => {
      expect(preset.h2).toBeInstanceOf(H2FacadeBuilder);
    });
  });

  describe('H2FacadeBuilder property chaining', () => {
    it('should chain .uri()', () => {
      const builder = preset.h2.uri('https://api.example.com');
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .json as property', () => {
      const builder = preset.h2.json;
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .timeout as property', () => {
      const builder = preset.h2.timeout;
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .withTimeout() with ms', () => {
      const builder = preset.h2.withTimeout(60000);
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .retry as property', () => {
      const builder = preset.h2.retry;
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .withRetry() with options', () => {
      const builder = preset.h2.withRetry({ tries: 5 });
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .logging as property', () => {
      const builder = preset.h2.logging;
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .withLogging() with logger', () => {
      const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
      const builder = preset.h2.withLogging(logger);
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .withHeaders()', () => {
      const builder = preset.h2.withHeaders({ 'X-Custom': 'value' });
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .connector() with valid options', () => {
      // Http2ConnectorOptions only has enablePush and sessionTimeout
      const builder = preset.h2.connector({ enablePush: true, sessionTimeout: 60000 });
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain multiple options', () => {
      const builder = preset.h2
        .uri('https://api.example.com')
        .json.timeout.retry.withHeaders({ Authorization: 'Bearer token' });
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });

    it('should chain .with() for custom policies', () => {
      const mockPolicy = createMockPolicy();
      const builder = preset.h2.with(mockPolicy);
      expect(builder).toBeInstanceOf(H2FacadeBuilder);
    });
  });

  describe('H2FacadeBuilder.build()', () => {
    it('should throw error if uri is not provided', () => {
      expect(() => preset.h2.build()).toThrow('Base URI is required');
    });

    it('should build client with uri', () => {
      const client = preset.h2.uri('https://api.example.com').build();

      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
      expect(typeof client.post).toBe('function');
      expect(typeof client.put).toBe('function');
      expect(typeof client.delete).toBe('function');
    });

    it('should build client with all options', () => {
      const client = preset.h2.uri('https://api.example.com').json.timeout.retry.logging.build();

      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
    });

    it('should build client with custom headers', () => {
      const client = preset.h2.uri('https://api.example.com').withHeaders({ 'X-API-Key': 'secret123' }).build();

      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
    });
  });
});

describe('@unireq/presets - Facade Integration with preset object', () => {
  it('should provide all facades from preset', () => {
    expect(preset.imap).toBeInstanceOf(ImapFacadeBuilder);
    expect(preset.ftp).toBeInstanceOf(FtpFacadeBuilder);
    expect(preset.h2).toBeInstanceOf(H2FacadeBuilder);
  });

  it('should allow different facades to be built independently', () => {
    const mockImapConnector = createMockImapConnector();
    const mockFtpConnector = createMockFtpConnector();

    const mailClient = preset.imap.uri('imap://user:pass@imap.example.com').connector(mockImapConnector).build();
    const ftpClient = preset.ftp.uri('ftp://user:pass@ftp.example.com').connector(mockFtpConnector).build();
    const h2Client = preset.h2.uri('https://api.example.com').build();

    expect(mailClient).toBeDefined();
    expect(ftpClient).toBeDefined();
    expect(h2Client).toBeDefined();
  });
});
