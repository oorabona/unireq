/**
 * @unireq/smtp - SMTP transport tests
 */

import { client } from '@unireq/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type EmailMessage, type SendResult, type SMTPConnector, type SMTPSession, smtp } from '../index.js';

/**
 * Create a mock SMTP connector for testing
 */
function createMockConnector(): SMTPConnector & { mockSession: SMTPSession } {
  const mockSession: SMTPSession = {
    connected: true,
    host: 'smtp.example.com',
    user: 'testuser',
    secure: true,
  };

  const mockResult: SendResult = {
    accepted: ['recipient@example.com'],
    rejected: [],
    messageId: '<test@example.com>',
    response: '250 OK',
  };

  return {
    mockSession,
    capabilities: {
      smtp: true,
      smtps: true,
      starttls: true,
      oauth2: true,
      html: true,
      attachments: true,
    },
    connect: vi.fn().mockResolvedValue(mockSession),
    request: vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: mockResult,
      ok: true,
    }),
    disconnect: vi.fn(),
  };
}

describe('@unireq/smtp - smtp() transport', () => {
  describe('transport creation', () => {
    it('should create transport with URI', () => {
      const mockConnector = createMockConnector();
      const { transport, capabilities } = smtp('smtp://smtp.example.com', mockConnector);

      expect(transport).toBeDefined();
      expect(typeof transport).toBe('function');
      expect(capabilities).toEqual({
        smtp: true,
        smtps: true,
        starttls: true,
        oauth2: true,
        html: true,
        attachments: true,
      });
    });

    it('should create transport without URI', () => {
      const mockConnector = createMockConnector();
      const { transport, capabilities } = smtp(undefined, mockConnector);

      expect(transport).toBeDefined();
      expect(capabilities['smtp']).toBe(true);
    });

    it('should use default capabilities when no connector provided', () => {
      // This will fail at runtime without nodemailer, but we can check the structure
      const { capabilities } = smtp('smtp://smtp.example.com');

      expect(capabilities['smtp']).toBe(true);
      expect(capabilities['smtps']).toBe(true);
      expect(capabilities['starttls']).toBe(true);
      expect(capabilities['oauth2']).toBe(true);
      expect(capabilities['html']).toBe(true);
      expect(capabilities['attachments']).toBe(true);
    });
  });

  describe('connection handling', () => {
    it('should connect on first request', async () => {
      const mockConnector = createMockConnector();
      const { transport } = smtp('smtp://user:pass@smtp.example.com', mockConnector);

      await transport({
        url: '/',
        method: 'POST',
        headers: {},
        body: {
          from: 'sender@example.com',
          to: 'recipient@example.com',
          subject: 'Test',
        },
      });

      expect(mockConnector.connect).toHaveBeenCalledWith('smtp://user:pass@smtp.example.com');
    });

    it('should reuse connection for subsequent requests', async () => {
      const mockConnector = createMockConnector();
      const { transport } = smtp('smtp://smtp.example.com', mockConnector);

      const message: EmailMessage = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
      };

      await transport({ url: '/', method: 'POST', headers: {}, body: message });
      await transport({ url: '/', method: 'POST', headers: {}, body: message });

      expect(mockConnector.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL handling', () => {
    it('should pass URL to connector as-is', async () => {
      const mockConnector = createMockConnector();
      const { transport } = smtp('smtp://smtp.example.com', mockConnector);

      await transport({
        url: '/',
        method: 'POST',
        headers: {},
        body: {
          from: 'sender@example.com',
          to: 'recipient@example.com',
          subject: 'Test',
        },
      });

      // SMTP transport passes the context URL as-is
      // (it's up to the connector to use the base URI from connect())
      expect(mockConnector.request).toHaveBeenCalledWith(
        mockConnector.mockSession,
        expect.objectContaining({
          url: '/',
        }),
      );
    });

    it('should handle any URL path', async () => {
      const mockConnector = createMockConnector();
      const { transport } = smtp('smtp://base.example.com', mockConnector);

      await transport({
        url: '/send',
        method: 'POST',
        headers: {},
        body: {
          from: 'sender@example.com',
          to: 'recipient@example.com',
          subject: 'Test',
        },
      });

      expect(mockConnector.request).toHaveBeenCalledWith(
        mockConnector.mockSession,
        expect.objectContaining({
          url: '/send',
        }),
      );
    });
  });
});

describe('@unireq/smtp - SMTPConnector interface', () => {
  it('should support custom connector implementation', async () => {
    const customResult: SendResult = {
      accepted: ['custom@example.com'],
      rejected: [],
      messageId: '<custom@example.com>',
      response: '250 Custom OK',
    };

    const customConnector: SMTPConnector = {
      capabilities: {
        smtp: true,
        smtps: false,
        starttls: true,
        oauth2: false,
        html: true,
        attachments: false,
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
        data: customResult,
        ok: true,
      }),
      disconnect: vi.fn(),
    };

    const { transport, capabilities } = smtp('smtp://custom.example.com', customConnector);
    const api = client(transport);

    const response = await api.post<SendResult>('/', {
      from: 'sender@example.com',
      to: 'custom@example.com',
      subject: 'Test',
    });

    expect(capabilities['smtps']).toBe(false);
    expect(capabilities['oauth2']).toBe(false);
    expect(capabilities['attachments']).toBe(false);
    expect(response.data?.messageId).toBe('<custom@example.com>');
  });
});

describe('@unireq/smtp - response handling', () => {
  it('should return successful response', async () => {
    const mockResult: SendResult = {
      accepted: ['recipient@example.com'],
      rejected: [],
      messageId: '<success@example.com>',
      response: '250 OK',
    };

    const mockConnector = createMockConnector();
    (mockConnector.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: mockResult,
      ok: true,
    });

    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const response = await api.post<SendResult>('/', {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.data).toEqual(mockResult);
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

    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const response = await api.post('/', {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
    expect((response.data as { error: string }).error).toBe('Connection refused');
  });

  it('should handle rejected recipients', async () => {
    const mockResult: SendResult = {
      accepted: ['good@example.com'],
      rejected: ['bad@example.com'],
      messageId: '<partial@example.com>',
      response: '250 OK',
    };

    const mockConnector = createMockConnector();
    (mockConnector.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: mockResult,
      ok: true,
    });

    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const response = await api.post<SendResult>('/', {
      from: 'sender@example.com',
      to: ['good@example.com', 'bad@example.com'],
      subject: 'Test',
    });

    expect(response.ok).toBe(true);
    expect(response.data?.accepted).toContain('good@example.com');
    expect(response.data?.rejected).toContain('bad@example.com');
  });
});

describe('@unireq/smtp - SMTPS support', () => {
  it('should handle SMTPS URI', async () => {
    const mockConnector = createMockConnector();
    const { transport } = smtp('smtps://secure.example.com:465', mockConnector);

    await transport({
      url: '/',
      method: 'POST',
      headers: {},
      body: {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Secure Test',
      },
    });

    expect(mockConnector.connect).toHaveBeenCalledWith('smtps://secure.example.com:465');
  });
});

describe('@unireq/smtp - email message handling', () => {
  let mockConnector: ReturnType<typeof createMockConnector>;

  beforeEach(() => {
    mockConnector = createMockConnector();
  });

  it('should send simple text email', async () => {
    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test Subject',
      text: 'Hello, this is a test email.',
    };

    await api.post('/', message);

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        body: message,
      }),
    );
  });

  it('should send HTML email', async () => {
    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'HTML Test',
      html: '<h1>Hello</h1><p>This is a test.</p>',
      text: 'Hello - This is a test.',
    };

    await api.post('/', message);

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        body: expect.objectContaining({
          html: '<h1>Hello</h1><p>This is a test.</p>',
          text: 'Hello - This is a test.',
        }),
      }),
    );
  });

  it('should send email with multiple recipients', async () => {
    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const message: EmailMessage = {
      from: 'sender@example.com',
      to: ['alice@example.com', 'bob@example.com'],
      subject: 'Group Email',
      text: 'Hello everyone!',
    };

    await api.post('/', message);

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        body: expect.objectContaining({
          to: ['alice@example.com', 'bob@example.com'],
        }),
      }),
    );
  });

  it('should send email with CC and BCC', async () => {
    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
      subject: 'CC/BCC Test',
      text: 'Test with CC and BCC.',
    };

    await api.post('/', message);

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        body: expect.objectContaining({
          cc: 'cc@example.com',
          bcc: 'bcc@example.com',
        }),
      }),
    );
  });

  it('should send email with named addresses', async () => {
    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const message: EmailMessage = {
      from: { name: 'Sender Name', address: 'sender@example.com' },
      to: { name: 'Recipient Name', address: 'recipient@example.com' },
      subject: 'Named Address Test',
      text: 'Test with named addresses.',
    };

    await api.post('/', message);

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        body: expect.objectContaining({
          from: { name: 'Sender Name', address: 'sender@example.com' },
          to: { name: 'Recipient Name', address: 'recipient@example.com' },
        }),
      }),
    );
  });

  it('should send email with attachments', async () => {
    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Attachment Test',
      text: 'See attachment.',
      attachments: [
        {
          filename: 'test.txt',
          content: 'Hello, World!',
          contentType: 'text/plain',
        },
      ],
    };

    await api.post('/', message);

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        body: expect.objectContaining({
          attachments: [
            expect.objectContaining({
              filename: 'test.txt',
              content: 'Hello, World!',
            }),
          ],
        }),
      }),
    );
  });

  it('should send email with priority', async () => {
    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Urgent!',
      text: 'This is urgent.',
      priority: 'high',
    };

    await api.post('/', message);

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        body: expect.objectContaining({
          priority: 'high',
        }),
      }),
    );
  });

  it('should send email with replyTo', async () => {
    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      replyTo: 'reply@example.com',
      subject: 'Reply-To Test',
      text: 'Reply to a different address.',
    };

    await api.post('/', message);

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        body: expect.objectContaining({
          replyTo: 'reply@example.com',
        }),
      }),
    );
  });

  it('should send email with custom headers', async () => {
    const { transport } = smtp('smtp://smtp.example.com', mockConnector);
    const api = client(transport);

    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Custom Headers Test',
      text: 'Test with custom headers.',
      headers: {
        'X-Custom-Header': 'custom-value',
      },
    };

    await api.post('/', message);

    expect(mockConnector.request).toHaveBeenCalledWith(
      mockConnector.mockSession,
      expect.objectContaining({
        body: expect.objectContaining({
          headers: { 'X-Custom-Header': 'custom-value' },
        }),
      }),
    );
  });
});

describe('@unireq/smtp - verify support', () => {
  it('should support verify method on connector', async () => {
    const mockConnector = createMockConnector();
    mockConnector.verify = vi.fn().mockResolvedValue(true);

    const { transport } = smtp('smtp://smtp.example.com', mockConnector);

    // Connect first
    await transport({
      url: '/',
      method: 'POST',
      headers: {},
      body: {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
      },
    });

    // Verify
    const isValid = await mockConnector.verify(mockConnector.mockSession);
    expect(isValid).toBe(true);
    expect(mockConnector.verify).toHaveBeenCalledWith(mockConnector.mockSession);
  });
});
