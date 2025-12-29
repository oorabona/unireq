import { describe, expect, it, vi } from 'vitest';
import { body, getDataSize } from '../body.js';

describe('@unireq/http - body serializers', () => {
  describe('body.json()', () => {
    it('should create JSON body descriptor', () => {
      const descriptor = body.json({ name: 'John', age: 30 });

      expect(descriptor.__brand).toBe('BodyDescriptor');
      expect(descriptor.contentType).toBe('application/json');
      expect(descriptor.data).toEqual({ name: 'John', age: 30 });
    });

    it('should serialize JSON data', () => {
      const descriptor = body.json({ name: 'John', age: 30 });
      const serialized = descriptor.serialize();

      expect(serialized).toBe('{"name":"John","age":30}');
    });

    it('should handle nested objects', () => {
      const descriptor = body.json({ user: { name: 'John', addresses: [{ city: 'Paris' }] } });
      const serialized = descriptor.serialize();

      expect(serialized).toBe('{"user":{"name":"John","addresses":[{"city":"Paris"}]}}');
    });

    it('should handle arrays', () => {
      const descriptor = body.json([1, 2, 3]);
      const serialized = descriptor.serialize();

      expect(serialized).toBe('[1,2,3]');
    });
  });

  describe('body.text()', () => {
    it('should create text body descriptor', () => {
      const descriptor = body.text('Hello world');

      expect(descriptor.__brand).toBe('BodyDescriptor');
      expect(descriptor.contentType).toBe('text/plain');
      expect(descriptor.data).toBe('Hello world');
    });

    it('should serialize text data', () => {
      const descriptor = body.text('Hello world');
      const serialized = descriptor.serialize();

      expect(serialized).toBe('Hello world');
    });

    it('should handle special characters', () => {
      const descriptor = body.text("Bonjour,\n\nJ'ai une question.\n\nMerci & cordialement");
      const serialized = descriptor.serialize();

      expect(serialized).toBe("Bonjour,\n\nJ'ai une question.\n\nMerci & cordialement");
    });
  });

  describe('body.form()', () => {
    it('should create form body descriptor', () => {
      const descriptor = body.form({ username: 'john', password: 'secret' });

      expect(descriptor.__brand).toBe('BodyDescriptor');
      expect(descriptor.contentType).toBe('application/x-www-form-urlencoded');
      expect(descriptor.data).toEqual({ username: 'john', password: 'secret' });
    });

    it('should serialize form data as URL-encoded', () => {
      const descriptor = body.form({ username: 'john', password: 'secret' });
      const serialized = descriptor.serialize();

      expect(serialized).toBe('username=john&password=secret');
    });

    it('should handle special characters in form values', () => {
      const descriptor = body.form({ email: 'jean.dupont@example.com', message: 'Hello & goodbye!' });
      const serialized = descriptor.serialize();

      expect(serialized).toBe('email=jean.dupont%40example.com&message=Hello+%26+goodbye%21');
    });

    it('should handle numbers and booleans', () => {
      const descriptor = body.form({ age: 30, active: true, page: 1 });
      const serialized = descriptor.serialize();

      expect(serialized).toBe('age=30&active=true&page=1');
    });

    it('should handle spaces in values', () => {
      const descriptor = body.form({ q: 'typescript http client' });
      const serialized = descriptor.serialize();

      expect(serialized).toBe('q=typescript+http+client');
    });
  });

  describe('body.binary()', () => {
    it('should create binary body descriptor from ArrayBuffer', () => {
      const buffer = new Uint8Array([137, 80, 78, 71]).buffer;
      const descriptor = body.binary(buffer, 'image/png');

      expect(descriptor.__brand).toBe('BodyDescriptor');
      expect(descriptor.contentType).toBe('image/png');
      expect(descriptor.data).toBe(buffer);
    });

    it('should serialize ArrayBuffer to Blob', () => {
      const buffer = new Uint8Array([137, 80, 78, 71]).buffer;
      const descriptor = body.binary(buffer, 'image/png');
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(Blob);
      expect((serialized as Blob).type).toBe('image/png');
      expect((serialized as Blob).size).toBe(4);
    });

    it('should create binary body descriptor from Blob', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      const descriptor = body.binary(blob, 'text/plain');

      expect(descriptor.__brand).toBe('BodyDescriptor');
      expect(descriptor.contentType).toBe('text/plain');
      expect(descriptor.data).toBe(blob);
    });

    it('should serialize Blob as-is', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      const descriptor = body.binary(blob, 'text/plain');
      const serialized = descriptor.serialize();

      expect(serialized).toBe(blob);
    });

    it('should calculate size for Blob data', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      const descriptor = body.binary(blob, 'text/plain');
      const serialized = descriptor.serialize();

      expect((serialized as Blob).size).toBeGreaterThan(0);
    });

    it('should calculate size for string data', () => {
      const descriptor = body.text('test string');
      const serialized = descriptor.serialize();

      expect(serialized).toBe('test string');
    });
  });

  describe('body.multipart()', () => {
    it('should create multipart body descriptor', () => {
      const descriptor = body.multipart(
        { name: 'file', part: body.text('Hello'), filename: 'test.txt' },
        { name: 'title', part: body.text('My Upload') },
      );

      expect(descriptor.__brand).toBe('BodyDescriptor');
      expect(descriptor.contentType).toBe('multipart/form-data');
      expect(descriptor.data).toHaveLength(2);
    });

    it('should serialize multipart to FormData', () => {
      const descriptor = body.multipart(
        { name: 'file', part: body.text('Hello'), filename: 'test.txt' },
        { name: 'title', part: body.text('My Upload') },
      );
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(FormData);
      const formData = serialized as FormData;
      expect(formData.has('file')).toBe(true);
      expect(formData.has('title')).toBe(true);
    });

    it('should handle mixed part types', () => {
      const descriptor = body.multipart(
        { name: 'metadata', part: body.json({ title: 'Doc' }) },
        {
          name: 'file',
          part: body.binary(new Uint8Array([1, 2, 3]).buffer, 'application/octet-stream'),
          filename: 'data.bin',
        },
        { name: 'description', part: body.text('Test upload') },
      );
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(FormData);
      const formData = serialized as FormData;
      expect(formData.has('metadata')).toBe(true);
      expect(formData.has('file')).toBe(true);
      expect(formData.has('description')).toBe(true);
    });

    it('should handle ArrayBuffer parts with size validation', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const descriptor = body.multipart(
        {
          name: 'binary',
          part: body.binary(buffer, 'application/octet-stream'),
          filename: 'data.bin',
        },
        { maxFileSize: 100 },
      );
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(FormData);
    });

    it('should sanitize filenames by default', () => {
      const descriptor = body.multipart({
        name: 'file',
        part: body.text('test'),
        filename: '../../../etc/passwd',
      });
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(FormData);
      // Filename sanitization happens internally, FormData should still work
    });

    it('should throw on invalid MIME type', () => {
      expect(() => {
        const descriptor = body.multipart(
          {
            name: 'file',
            part: body.binary(new Uint8Array([1, 2, 3]).buffer, 'application/x-executable'),
            filename: 'malicious.exe',
          },
          { allowedMimeTypes: ['text/*', 'image/*'] },
        );
        descriptor.serialize();
      }).toThrow('Invalid MIME type "application/x-executable" for part "file". Allowed: text/*, image/*');
    });

    it('should throw on file size exceeding limit with ArrayBuffer', () => {
      expect(() => {
        const largeData = new Uint8Array(2000).buffer;
        const descriptor = body.multipart(
          {
            name: 'file',
            part: body.binary(largeData, 'application/octet-stream'),
            filename: 'large.bin',
          },
          { maxFileSize: 1000 },
        );
        descriptor.serialize();
      }).toThrow('Part "file" exceeds maximum size limit: 2000 bytes > 1000 bytes');
    });

    it('should throw on file size exceeding limit with Blob', () => {
      expect(() => {
        const largeBlob = new Blob([new Uint8Array(2000)]);
        const descriptor = body.multipart(
          {
            name: 'file',
            part: body.binary(largeBlob, 'application/octet-stream'),
            filename: 'large.bin',
          },
          { maxFileSize: 1000 },
        );
        descriptor.serialize();
      }).toThrow('Part "file" exceeds maximum size limit');
    });

    it('should throw on file size exceeding limit with string', () => {
      expect(() => {
        const largeText = 'x'.repeat(2000);
        const descriptor = body.multipart(
          {
            name: 'file',
            part: body.text(largeText),
            filename: 'large.txt',
          },
          { maxFileSize: 1000 },
        );
        descriptor.serialize();
      }).toThrow('Part "file" exceeds maximum size limit');
    });

    it('should allow valid MIME types with wildcard', () => {
      const descriptor = body.multipart(
        {
          name: 'image',
          part: body.binary(new Uint8Array([137, 80, 78, 71]).buffer, 'image/png'),
          filename: 'avatar.png',
        },
        { allowedMimeTypes: ['image/*'] },
      );
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(FormData);
    });

    it('should disable filename sanitization when requested', () => {
      const descriptor = body.multipart(
        {
          name: 'file',
          part: body.text('test'),
          filename: 'file_with_path.txt',
        },
        { sanitizeFilenames: false },
      );
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(FormData);
    });

    it('should throw on nested FormData', () => {
      const nestedFormData = new FormData();
      nestedFormData.append('nested', 'value');

      const nestedDescriptor: {
        __brand: 'BodyDescriptor';
        data: unknown;
        contentType: string;
        serialize: () => FormData;
      } = {
        __brand: 'BodyDescriptor',
        data: nestedFormData,
        contentType: 'multipart/form-data',
        serialize: () => nestedFormData,
      };

      expect(() => {
        const descriptor = body.multipart(
          {
            name: 'nested',
            part: nestedDescriptor,
          },
          { allowedMimeTypes: ['multipart/form-data'] },
        );
        descriptor.serialize();
      }).toThrow('Nested FormData not supported. Use body.multipart() at top level only.');
    });

    it('should throw on nested multipart bodies', () => {
      const nested = body.multipart({ name: 'inner', part: body.text('foo') });
      const outer = body.multipart({ name: 'outer', part: nested }, { allowedMimeTypes: ['multipart/form-data'] });

      expect(() => outer.serialize()).toThrow('Nested FormData not supported');
    });

    it('should throw on streaming parts in multipart', () => {
      const stream = new ReadableStream<Uint8Array>();
      const streamDescriptor: {
        __brand: 'BodyDescriptor';
        data: unknown;
        contentType: string;
        serialize: () => ReadableStream<Uint8Array>;
      } = {
        __brand: 'BodyDescriptor',
        data: stream,
        contentType: 'application/octet-stream',
        serialize: () => stream,
      };

      expect(() => {
        const descriptor = body.multipart({
          name: 'stream',
          part: streamDescriptor,
        });
        descriptor.serialize();
      }).toThrow('Streaming parts (ReadableStream) not supported in multipart');
    });

    it('should handle parts without filename', () => {
      const descriptor = body.multipart(
        { name: 'title', part: body.text('My Title') },
        { name: 'description', part: body.text('Description text') },
      );
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(FormData);
      const formData = serialized as FormData;
      expect(formData.has('title')).toBe(true);
      expect(formData.has('description')).toBe(true);
    });

    it('should use default maxFileSize from config', () => {
      const descriptor = body.multipart({
        name: 'file',
        part: body.text('Small file'),
        filename: 'small.txt',
      });
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(FormData);
    });

    it('should handle part without contentType', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const customPart: { __brand: 'BodyDescriptor'; data: string; serialize: () => string } = {
        __brand: 'BodyDescriptor',
        data: 'test',
        serialize: () => 'test',
      };
      const descriptor = body.multipart(
        {
          name: 'custom',
          part: customPart,
        },
        { allowedMimeTypes: [] },
      );
      const serialized = descriptor.serialize();

      expect(serialized).toBeInstanceOf(FormData);
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getDataSize()', () => {
    it('should return correct size for Blob', () => {
      const blob = new Blob(['Hello world'], { type: 'text/plain' });
      const size = getDataSize(blob);

      expect(size).toBe(11); // "Hello world" = 11 bytes
    });

    it('should return correct size for ArrayBuffer', () => {
      const buffer = new ArrayBuffer(1024);
      const size = getDataSize(buffer);

      expect(size).toBe(1024);
    });

    it('should return correct size for ArrayBuffer with data', () => {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode('Test data');
      const buffer = uint8Array.buffer;
      const size = getDataSize(buffer);

      expect(size).toBe(uint8Array.buffer.byteLength);
    });

    it('should return correct size for ASCII string', () => {
      const str = 'Hello';
      const size = getDataSize(str);

      expect(size).toBe(5); // ASCII: 1 byte per char
    });

    it('should return correct size for UTF-8 string with multi-byte characters', () => {
      const str = 'Hello 世界'; // "世界" = 2 chars * 3 bytes each in UTF-8
      const size = getDataSize(str);

      // "Hello " = 6 bytes + "世界" = 6 bytes = 12 bytes total
      expect(size).toBe(12);
    });

    it('should return correct size for empty string', () => {
      const size = getDataSize('');

      expect(size).toBe(0);
    });

    it('should return correct size for empty Blob', () => {
      const blob = new Blob([]);
      const size = getDataSize(blob);

      expect(size).toBe(0);
    });

    it('should return correct size for empty ArrayBuffer', () => {
      const buffer = new ArrayBuffer(0);
      const size = getDataSize(buffer);

      expect(size).toBe(0);
    });

    it('should return correct size for string with emojis', () => {
      const str = '😀👍'; // Each emoji is 4 bytes in UTF-8
      const size = getDataSize(str);

      expect(size).toBe(8); // 2 emojis * 4 bytes each
    });

    it('should return correct size for large string', () => {
      const str = 'a'.repeat(10000);
      const size = getDataSize(str);

      expect(size).toBe(10000);
    });

    it('should match Blob.size for string conversion', () => {
      const str = 'Test data with UTF-8: 日本語';
      const size = getDataSize(str);
      const blobSize = new Blob([str]).size;

      expect(size).toBe(blobSize);
    });

    // Security-related tests for DoS prevention
    describe('security validation', () => {
      it('should accurately report size for maxFileSize validation', () => {
        const testData = 'x'.repeat(1000);
        const size = getDataSize(testData);

        // This size is used in maxFileSize validation (line 251-256 in body.ts)
        expect(size).toBe(1000);
      });

      it('should not underreport size that could bypass maxFileSize check', () => {
        const largeString = 'a'.repeat(100 * 1024 * 1024); // 100MB
        const size = getDataSize(largeString);

        // Should report full size, not truncated
        expect(size).toBeGreaterThanOrEqual(100 * 1024 * 1024);
      });
    });
  });

  describe('security warnings', () => {
    it('should log warning if MIME type validation explicitly disabled with empty array', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Intentional empty mock for console.warn
      });

      const descriptor = body.multipart(
        {
          name: 'file',
          part: body.text('test'),
          filename: 'test.txt',
        },
        { allowedMimeTypes: [] },
      );
      descriptor.serialize();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY WARNING] MIME type validation disabled'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('OWASP A01:2021'));
      consoleWarnSpy.mockRestore();
    });
  });
});
