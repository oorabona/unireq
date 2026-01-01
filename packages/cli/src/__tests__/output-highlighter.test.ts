/**
 * Tests for syntax highlighting module
 * Following AAA pattern for unit tests
 *
 * Note: Colors are enabled via FORCE_COLOR=1 in vitest.config.ts env
 */

import { describe, expect, it } from 'vitest';
import { detectContentType, highlight, highlightJson, highlightXml } from '../output/highlighter.js';

describe('output/highlighter', () => {
  describe('detectContentType', () => {
    describe('when content-type is JSON', () => {
      it('should detect application/json', () => {
        // Arrange
        const contentType = 'application/json';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('json');
      });

      it('should detect application/json with charset', () => {
        // Arrange
        const contentType = 'application/json; charset=utf-8';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('json');
      });

      it('should detect vendor JSON types (+json suffix)', () => {
        // Arrange
        const contentType = 'application/vnd.api+json';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('json');
      });

      it('should detect text/json', () => {
        // Arrange
        const contentType = 'text/json';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('json');
      });
    });

    describe('when content-type is XML', () => {
      it('should detect application/xml', () => {
        // Arrange
        const contentType = 'application/xml';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('xml');
      });

      it('should detect text/xml', () => {
        // Arrange
        const contentType = 'text/xml';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('xml');
      });

      it('should detect vendor XML types (+xml suffix)', () => {
        // Arrange
        const contentType = 'application/rss+xml';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('xml');
      });

      it('should detect application/xhtml+xml', () => {
        // Arrange
        const contentType = 'application/xhtml+xml';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('xml');
      });
    });

    describe('when content-type is unknown', () => {
      it('should return unknown for text/plain', () => {
        // Arrange
        const contentType = 'text/plain';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('unknown');
      });

      it('should return unknown for text/html', () => {
        // Arrange
        const contentType = 'text/html';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('unknown');
      });

      it('should return unknown for undefined', () => {
        // Arrange
        const contentType = undefined;

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('unknown');
      });

      it('should return unknown for empty string', () => {
        // Arrange
        const contentType = '';

        // Act
        const result = detectContentType(contentType);

        // Assert
        expect(result).toBe('unknown');
      });
    });
  });

  describe('highlightJson', () => {
    describe('when colors are enabled', () => {
      it('should highlight object keys in cyan', () => {
        // Arrange
        const json = '{"name": "Alice"}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[36mname\x1b[39m'); // cyan
      });

      it('should highlight string values in green', () => {
        // Arrange
        const json = '{"name": "Alice"}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[32mAlice\x1b[39m'); // green
      });

      it('should highlight numbers in yellow', () => {
        // Arrange
        const json = '{"age": 30}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[33m30\x1b[39m'); // yellow
      });

      it('should highlight negative numbers', () => {
        // Arrange
        const json = '{"offset": -10}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[33m-10\x1b[39m'); // yellow
      });

      it('should highlight decimal numbers', () => {
        // Arrange
        const json = '{"price": 19.99}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[33m19.99\x1b[39m'); // yellow
      });

      it('should highlight booleans in magenta', () => {
        // Arrange
        const json = '{"active": true, "deleted": false}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[35mtrue\x1b[39m'); // magenta
        expect(result).toContain('\x1b[35mfalse\x1b[39m'); // magenta
      });

      it('should highlight null as dim', () => {
        // Arrange
        const json = '{"value": null}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[2mnull\x1b[22m'); // dim
      });

      it('should handle nested objects', () => {
        // Arrange
        const json = '{"user": {"id": 1, "name": "Alice"}}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[36muser\x1b[39m'); // outer key
        expect(result).toContain('\x1b[36mid\x1b[39m'); // nested key
        expect(result).toContain('\x1b[36mname\x1b[39m'); // nested key
        expect(result).toContain('\x1b[33m1\x1b[39m'); // number
        expect(result).toContain('\x1b[32mAlice\x1b[39m'); // string
      });

      it('should handle arrays', () => {
        // Arrange
        const json = '{"roles": ["admin", "user"]}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[36mroles\x1b[39m'); // key
        expect(result).toContain('\x1b[32madmin\x1b[39m'); // array string
        expect(result).toContain('\x1b[32muser\x1b[39m'); // array string
      });

      it('should handle mixed value types', () => {
        // Arrange
        const json = '{"str": "text", "num": 42, "bool": true, "nil": null}';

        // Act
        const result = highlightJson(json, true);

        // Assert
        expect(result).toContain('\x1b[32mtext\x1b[39m'); // green string
        expect(result).toContain('\x1b[33m42\x1b[39m'); // yellow number
        expect(result).toContain('\x1b[35mtrue\x1b[39m'); // magenta boolean
        expect(result).toContain('\x1b[2mnull\x1b[22m'); // dim null
      });
    });

    describe('when colors are disabled', () => {
      it('should return plain text without ANSI codes', () => {
        // Arrange
        const json = '{"name": "Alice", "age": 30}';

        // Act
        const result = highlightJson(json, false);

        // Assert
        expect(result).not.toContain('\x1b[');
        expect(result).toContain('"name"');
        expect(result).toContain('"Alice"');
      });
    });

    describe('when JSON is invalid', () => {
      it('should return original text for malformed JSON', () => {
        // Arrange
        const invalid = '{broken json';

        // Act
        const result = highlightJson(invalid, true);

        // Assert
        expect(result).toBe(invalid);
      });

      it('should return original text for incomplete JSON', () => {
        // Arrange
        const invalid = '{"key":';

        // Act
        const result = highlightJson(invalid, true);

        // Assert
        expect(result).toBe(invalid);
      });
    });

    describe('when input is empty', () => {
      it('should return empty string for empty input', () => {
        // Arrange
        const empty = '';

        // Act
        const result = highlightJson(empty, true);

        // Assert
        expect(result).toBe('');
      });
    });
  });

  describe('highlightXml', () => {
    describe('when colors are enabled', () => {
      it('should highlight tag names in cyan', () => {
        // Arrange
        const xml = '<user><name>Alice</name></user>';

        // Act
        const result = highlightXml(xml, true);

        // Assert
        expect(result).toContain('<\x1b[36muser\x1b[39m>');
        expect(result).toContain('</\x1b[36muser\x1b[39m>');
        expect(result).toContain('<\x1b[36mname\x1b[39m>');
        expect(result).toContain('</\x1b[36mname\x1b[39m>');
      });

      it('should highlight attribute names in yellow', () => {
        // Arrange
        const xml = '<user id="42" active="true"/>';

        // Act
        const result = highlightXml(xml, true);

        // Assert
        expect(result).toContain('\x1b[33mid\x1b[39m='); // yellow
        expect(result).toContain('\x1b[33mactive\x1b[39m='); // yellow
      });

      it('should highlight attribute values in green', () => {
        // Arrange
        const xml = '<user id="42" name="Alice"/>';

        // Act
        const result = highlightXml(xml, true);

        // Assert
        expect(result).toContain('"\x1b[32m42\x1b[39m"'); // green
        expect(result).toContain('"\x1b[32mAlice\x1b[39m"'); // green
      });

      it('should highlight comments as dim', () => {
        // Arrange
        const xml = '<!-- This is a comment --><data/>';

        // Act
        const result = highlightXml(xml, true);

        // Assert
        expect(result).toContain('\x1b[2m<!-- This is a comment -->\x1b[22m'); // dim
      });

      it('should highlight XML declarations as dim', () => {
        // Arrange
        const xml = '<?xml version="1.0" encoding="UTF-8"?><root/>';

        // Act
        const result = highlightXml(xml, true);

        // Assert
        expect(result).toContain('\x1b[2m<?xml version="1.0" encoding="UTF-8"?>\x1b[22m'); // dim
      });

      it('should handle namespaced tags', () => {
        // Arrange
        const xml = '<ns:element xmlns:ns="http://example.com"/>';

        // Act
        const result = highlightXml(xml, true);

        // Assert
        expect(result).toContain('<\x1b[36mns:element\x1b[39m');
      });

      it('should handle single-quoted attributes', () => {
        // Arrange
        const xml = "<user name='Alice'/>";

        // Act
        const result = highlightXml(xml, true);

        // Assert
        expect(result).toContain("'\x1b[32mAlice\x1b[39m'");
      });

      it('should preserve text content without highlighting', () => {
        // Arrange
        const xml = '<message>Hello World</message>';

        // Act
        const result = highlightXml(xml, true);

        // Assert
        // Text content should not have color codes
        expect(result).toContain('>Hello World<');
      });

      it('should handle self-closing tags', () => {
        // Arrange
        const xml = '<br/><hr />';

        // Act
        const result = highlightXml(xml, true);

        // Assert
        expect(result).toContain('<\x1b[36mbr\x1b[39m/>');
        expect(result).toContain('<\x1b[36mhr\x1b[39m />');
      });
    });

    describe('when colors are disabled', () => {
      it('should return plain text without ANSI codes', () => {
        // Arrange
        const xml = '<user id="42"><name>Alice</name></user>';

        // Act
        const result = highlightXml(xml, false);

        // Assert
        expect(result).not.toContain('\x1b[');
        expect(result).toBe(xml);
      });
    });

    describe('when input is empty', () => {
      it('should return empty string for empty input', () => {
        // Arrange
        const empty = '';

        // Act
        const result = highlightXml(empty, true);

        // Assert
        expect(result).toBe('');
      });
    });

    describe('when XML is malformed', () => {
      it('should still highlight valid parts', () => {
        // Arrange
        const malformed = '<unclosed>content';

        // Act
        const result = highlightXml(malformed, true);

        // Assert
        // Should highlight opening tag even if unclosed
        expect(result).toContain('<\x1b[36munclosed\x1b[39m>');
      });
    });
  });

  describe('highlight', () => {
    describe('when content-type is JSON', () => {
      it('should apply JSON highlighting', () => {
        // Arrange
        const text = '{"key": "value"}';
        const contentType = 'application/json';

        // Act
        const result = highlight(text, contentType, true);

        // Assert
        expect(result).toContain('\x1b[36mkey\x1b[39m'); // cyan key
        expect(result).toContain('\x1b[32mvalue\x1b[39m'); // green value
      });
    });

    describe('when content-type is XML', () => {
      it('should apply XML highlighting', () => {
        // Arrange
        const text = '<root><child>text</child></root>';
        const contentType = 'application/xml';

        // Act
        const result = highlight(text, contentType, true);

        // Assert
        expect(result).toContain('<\x1b[36mroot\x1b[39m>');
        expect(result).toContain('<\x1b[36mchild\x1b[39m>');
      });
    });

    describe('when content-type is unknown', () => {
      it('should return text unchanged', () => {
        // Arrange
        const text = 'plain text content';
        const contentType = 'text/plain';

        // Act
        const result = highlight(text, contentType, true);

        // Assert
        expect(result).toBe(text);
        expect(result).not.toContain('\x1b[');
      });
    });

    describe('when colors are disabled', () => {
      it('should return text unchanged', () => {
        // Arrange
        const text = '{"key": "value"}';
        const contentType = 'application/json';

        // Act
        const result = highlight(text, contentType, false);

        // Assert
        expect(result).not.toContain('\x1b[');
      });
    });

    describe('when text is empty', () => {
      it('should return empty string', () => {
        // Arrange
        const text = '';
        const contentType = 'application/json';

        // Act
        const result = highlight(text, contentType, true);

        // Assert
        expect(result).toBe('');
      });
    });
  });
});
