/**
 * Tests for binary content detection
 * Following AAA pattern for unit tests
 */

import { describe, expect, it } from 'vitest';
import { formatBinaryPlaceholder, isBinaryContentType, isBinaryData } from '../binary.js';

describe('isBinaryContentType', () => {
  describe('returns true for binary types', () => {
    it('should detect image/* as binary', () => {
      // Arrange & Act & Assert
      expect(isBinaryContentType('image/png')).toBe(true);
      expect(isBinaryContentType('image/jpeg')).toBe(true);
      expect(isBinaryContentType('image/gif')).toBe(true);
      expect(isBinaryContentType('image/webp')).toBe(true);
    });

    it('should detect audio/* as binary', () => {
      expect(isBinaryContentType('audio/mpeg')).toBe(true);
      expect(isBinaryContentType('audio/wav')).toBe(true);
      expect(isBinaryContentType('audio/ogg')).toBe(true);
    });

    it('should detect video/* as binary', () => {
      expect(isBinaryContentType('video/mp4')).toBe(true);
      expect(isBinaryContentType('video/webm')).toBe(true);
      expect(isBinaryContentType('video/ogg')).toBe(true);
    });

    it('should detect application/octet-stream as binary', () => {
      expect(isBinaryContentType('application/octet-stream')).toBe(true);
    });

    it('should detect archive types as binary', () => {
      expect(isBinaryContentType('application/zip')).toBe(true);
      expect(isBinaryContentType('application/gzip')).toBe(true);
      expect(isBinaryContentType('application/x-tar')).toBe(true);
      expect(isBinaryContentType('application/x-rar-compressed')).toBe(true);
      expect(isBinaryContentType('application/x-7z-compressed')).toBe(true);
    });

    it('should detect office documents as binary', () => {
      expect(isBinaryContentType('application/pdf')).toBe(true);
      expect(isBinaryContentType('application/msword')).toBe(true);
      expect(isBinaryContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
      expect(isBinaryContentType('application/vnd.ms-excel')).toBe(true);
    });

    it('should detect executables as binary', () => {
      expect(isBinaryContentType('application/x-executable')).toBe(true);
      expect(isBinaryContentType('application/x-mach-binary')).toBe(true);
      expect(isBinaryContentType('application/x-dosexec')).toBe(true);
    });

    it('should handle content-type with charset', () => {
      expect(isBinaryContentType('image/png; charset=utf-8')).toBe(true);
    });
  });

  describe('returns false for text types', () => {
    it('should detect application/json as text', () => {
      expect(isBinaryContentType('application/json')).toBe(false);
    });

    it('should detect text/* as text', () => {
      expect(isBinaryContentType('text/plain')).toBe(false);
      expect(isBinaryContentType('text/html')).toBe(false);
      expect(isBinaryContentType('text/css')).toBe(false);
      expect(isBinaryContentType('text/javascript')).toBe(false);
    });

    it('should detect application/xml as text', () => {
      expect(isBinaryContentType('application/xml')).toBe(false);
    });

    it('should detect image/svg+xml as text (SVG exception)', () => {
      expect(isBinaryContentType('image/svg+xml')).toBe(false);
    });

    it('should detect *+json as text', () => {
      expect(isBinaryContentType('application/vnd.api+json')).toBe(false);
    });

    it('should detect *+xml as text', () => {
      expect(isBinaryContentType('application/atom+xml')).toBe(false);
      expect(isBinaryContentType('application/rss+xml')).toBe(false);
    });

    it('should handle undefined content-type', () => {
      expect(isBinaryContentType(undefined)).toBe(false);
    });

    it('should handle empty content-type', () => {
      expect(isBinaryContentType('')).toBe(false);
    });
  });
});

describe('isBinaryData', () => {
  describe('returns true for binary data', () => {
    it('should detect string with null bytes as binary', () => {
      // Arrange
      const data = 'hello\x00world';

      // Act & Assert
      expect(isBinaryData(data)).toBe(true);
    });

    it('should detect Buffer with null bytes as binary', () => {
      // Arrange
      const data = Buffer.from([72, 101, 108, 108, 111, 0, 87, 111, 114, 108, 100]);

      // Act & Assert
      expect(isBinaryData(data)).toBe(true);
    });

    it('should detect string with high non-printable ratio as binary', () => {
      // Arrange - 20% control characters
      const data = '\x01\x02hello\x03\x04';

      // Act & Assert
      expect(isBinaryData(data)).toBe(true);
    });

    it('should detect Buffer with high non-printable ratio as binary', () => {
      // Arrange - Buffer with many control characters
      const data = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 72, 101, 108, 108, 111]);

      // Act & Assert
      expect(isBinaryData(data)).toBe(true);
    });
  });

  describe('returns false for text data', () => {
    it('should detect normal JSON string as text', () => {
      // Arrange
      const data = '{"foo": "bar", "baz": 123}';

      // Act & Assert
      expect(isBinaryData(data)).toBe(false);
    });

    it('should detect multiline text as text', () => {
      // Arrange
      const data = 'Hello\nWorld\nThis is a test\twith tabs';

      // Act & Assert
      expect(isBinaryData(data)).toBe(false);
    });

    it('should detect objects as non-binary (they are JSON)', () => {
      // Arrange
      const data = { foo: 'bar' };

      // Act & Assert
      expect(isBinaryData(data)).toBe(false);
    });

    it('should handle null', () => {
      expect(isBinaryData(null)).toBe(false);
    });

    it('should handle undefined', () => {
      expect(isBinaryData(undefined)).toBe(false);
    });

    it('should handle clean Buffer (no control chars)', () => {
      // Arrange - "Hello World" in ASCII
      const data = Buffer.from([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]);

      // Act & Assert
      expect(isBinaryData(data)).toBe(false);
    });
  });
});

describe('formatBinaryPlaceholder', () => {
  it('should format bytes correctly', () => {
    // Arrange & Act
    const result = formatBinaryPlaceholder(234, 'application/octet-stream');

    // Assert
    expect(result).toBe('[Binary data: 234 bytes, application/octet-stream]');
  });

  it('should format KB correctly', () => {
    // Arrange & Act
    const result = formatBinaryPlaceholder(1536, 'image/png');

    // Assert
    expect(result).toBe('[Binary data: 1.5 KB, image/png]');
  });

  it('should format MB correctly', () => {
    // Arrange & Act
    const result = formatBinaryPlaceholder(5 * 1024 * 1024 + 200 * 1024, 'video/mp4');

    // Assert
    expect(result).toBe('[Binary data: 5.2 MB, video/mp4]');
  });

  it('should handle zero bytes', () => {
    // Arrange & Act
    const result = formatBinaryPlaceholder(0, 'image/png');

    // Assert
    expect(result).toBe('[Binary data: 0 bytes, image/png]');
  });

  it('should handle undefined content-type', () => {
    // Arrange & Act
    const result = formatBinaryPlaceholder(1024, undefined);

    // Assert
    expect(result).toBe('[Binary data: 1.0 KB, unknown]');
  });

  it('should strip charset from content-type', () => {
    // Arrange & Act
    const result = formatBinaryPlaceholder(512, 'image/png; charset=utf-8');

    // Assert
    expect(result).toBe('[Binary data: 512 bytes, image/png]');
  });
});
