/**
 * @unireq/http - Multipart integration tests (MSW)
 * Tests end-to-end multipart file upload flows
 */

import { client } from '@unireq/core';
import { http, json, multipart } from '@unireq/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { handlers, MOCK_API_BASE } from '../../scripts/msw/handlers.js';

// Setup MSW server for this integration test suite
const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('@unireq/http - multipart integration (MSW)', () => {
  it('should upload file with multipart/form-data (end-to-end)', async () => {
    const api = client(http(MOCK_API_BASE), json());

    const fileData = 'Hello, World!';
    const policy = multipart([
      {
        name: 'file',
        filename: 'test.txt',
        data: fileData,
        contentType: 'text/plain',
      },
    ]);

    // Pass multipart policy as a per-request policy (3rd argument), not as body
    const response = await api.post<{
      message: string;
      files: Record<string, { filename: string; size: number; type: string }>;
      fields: Record<string, string>;
    }>('/upload', undefined, policy);

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Upload successful');
    expect(response.data.files.file).toBeDefined();
    expect(response.data.files.file.filename).toBe('test.txt');
    expect(response.data.files.file.type).toBe('text/plain');
  });

  it('should upload file with fields (end-to-end)', async () => {
    const api = client(http(MOCK_API_BASE), json());

    const policy = multipart(
      [
        {
          name: 'document',
          filename: 'report.pdf',
          data: new ArrayBuffer(100),
          contentType: 'application/pdf',
        },
      ],
      [
        { name: 'title', value: 'Quarterly Report' },
        { name: 'year', value: '2025' },
      ],
    );

    // Pass multipart policy as a per-request policy (3rd argument), not as body
    const response = await api.post<{
      message: string;
      files: Record<string, { filename: string; type: string }>;
      fields: Record<string, string>;
    }>('/upload', undefined, policy);

    expect(response.status).toBe(200);
    expect(response.data.files.document).toBeDefined();
    expect(response.data.files.document.filename).toBe('report.pdf');
    expect(response.data.fields.title).toBe('Quarterly Report');
    expect(response.data.fields.year).toBe('2025');
  });

  it('should upload multiple files (end-to-end)', async () => {
    const api = client(http(MOCK_API_BASE), json());

    const policy = multipart([
      {
        name: 'avatar',
        filename: 'avatar.png',
        data: new Blob(['image data'], { type: 'image/png' }),
        contentType: 'image/png',
      },
      {
        name: 'document',
        filename: 'resume.pdf',
        data: new Blob(['pdf data'], { type: 'application/pdf' }),
        contentType: 'application/pdf',
      },
    ]);

    // Pass multipart policy as a per-request policy (3rd argument), not as body
    const response = await api.post<{
      files: Record<string, { filename: string; type: string }>;
    }>('/upload', undefined, policy);

    expect(response.status).toBe(200);
    expect(response.data.files.avatar).toBeDefined();
    expect(response.data.files.avatar.filename).toBe('avatar.png');
    expect(response.data.files.avatar.type).toBe('image/png');
    expect(response.data.files.document).toBeDefined();
    expect(response.data.files.document.filename).toBe('resume.pdf');
    expect(response.data.files.document.type).toBe('application/pdf');
  });

  it('should handle large file uploads (end-to-end)', async () => {
    const api = client(http(MOCK_API_BASE), json());

    // 1MB file
    const largeData = new ArrayBuffer(1024 * 1024);

    const policy = multipart([
      {
        name: 'video',
        filename: 'video.mp4',
        data: largeData,
        contentType: 'application/octet-stream', // Use allowed MIME type
      },
    ]);

    // Pass multipart policy as a per-request policy (3rd argument), not as body
    const response = await api.post<{
      files: Record<string, { size: number }>;
    }>('/upload', undefined, policy);

    expect(response.status).toBe(200);
    expect(response.data.files.video).toBeDefined();
    expect(response.data.files.video.size).toBeGreaterThan(0);
  });

  it('should sanitize filenames by default (end-to-end)', async () => {
    const api = client(http(MOCK_API_BASE), json());

    const policy = multipart([
      {
        name: 'file',
        filename: '../../etc/passwd',
        data: 'malicious',
        contentType: 'text/plain',
      },
    ]);

    // Pass multipart policy as a per-request policy (3rd argument), not as body
    const response = await api.post<{
      files: Record<string, { filename: string }>;
    }>('/upload', undefined, policy);

    expect(response.status).toBe(200);
    // Filename should NOT contain path traversal
    expect(response.data.files.file.filename).not.toContain('..');
    expect(response.data.files.file.filename).not.toContain('/');
  });

  it('should validate MIME types when configured (end-to-end)', async () => {
    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'malware.exe',
          data: 'content',
          contentType: 'application/exe',
        },
      ],
      [],
      { allowedMimeTypes: ['text/plain', 'image/jpeg'] },
    );

    const api = client(http(MOCK_API_BASE), json());

    // Pass multipart policy as a per-request policy (3rd argument), not as body
    await expect(api.post('/upload', undefined, policy)).rejects.toThrow('Invalid MIME type');
  });

  it('should validate file size when configured (end-to-end)', async () => {
    const largeData = 'x'.repeat(10000);

    const policy = multipart(
      [
        {
          name: 'file',
          filename: 'large.txt',
          data: largeData,
          contentType: 'text/plain',
        },
      ],
      [],
      { maxFileSize: 5000 }, // 5KB limit
    );

    const api = client(http(MOCK_API_BASE), json());

    // Pass multipart policy as a per-request policy (3rd argument), not as body
    await expect(api.post('/upload', undefined, policy)).rejects.toThrow('exceeds maximum size limit');
  });
});
