/**
 * @unireq/xml - XML parser tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { xml, xmlBody } from '../index.js';

const { mockParse, mockBuild, MockXMLParser, MockXMLBuilder } = vi.hoisted(() => {
  const mockParse = vi.fn();
  const mockBuild = vi.fn();
  const MockXMLParser = vi.fn(function (this: any) {
    return {
      parse: mockParse,
    };
  });
  const MockXMLBuilder = vi.fn(function (this: any) {
    return {
      build: mockBuild,
    };
  });
  return { mockParse, mockBuild, MockXMLParser, MockXMLBuilder };
});

vi.mock('fast-xml-parser', () => ({
  XMLParser: MockXMLParser,
  XMLBuilder: MockXMLBuilder,
}));

describe('@unireq/xml - xml parser', () => {
  beforeEach(() => {
    mockParse.mockReset();
    mockBuild.mockReset();
    MockXMLParser.mockClear();
    MockXMLBuilder.mockClear();
  });

  it('should parse XML response with content-type xml', async () => {
    const policy = xml();

    const xmlData = '<root><message>hello</message></root>';
    const parsedData = { root: { message: 'hello' } };
    mockParse.mockReturnValue(parsedData);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/xml' },
      data: xmlData,
      ok: true,
    }));

    expect(mockParse).toHaveBeenCalledWith(xmlData);
    expect(result.data).toEqual(parsedData);
  });

  it('should parse XML with Content-Type (capital C)', async () => {
    const policy = xml();

    const xmlData = '<data><value>42</value></data>';
    const parsedData = { data: { value: 42 } };
    mockParse.mockReturnValue(parsedData);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      data: xmlData,
      ok: true,
    }));

    expect(mockParse).toHaveBeenCalledWith(xmlData);
    expect(result.data).toEqual(parsedData);
  });

  it('should not parse non-XML content-type', async () => {
    const policy = xml();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: '{"message":"hello"}',
      ok: true,
    }));

    expect(mockParse).not.toHaveBeenCalled();
    expect(result.data).toBe('{"message":"hello"}');
  });

  it('should parse XML from ArrayBuffer', async () => {
    const policy = xml();

    const xmlString = '<item><id>123</id></item>';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(xmlString).buffer;
    const parsedData = { item: { id: 123 } };
    mockParse.mockReturnValue(parsedData);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/xml' },
      data: buffer,
      ok: true,
    }));

    expect(mockParse).toHaveBeenCalledWith(xmlString);
    expect(result.data).toEqual(parsedData);
  });

  it('should not parse already parsed object data', async () => {
    const policy = xml();
    const objectData = { already: 'parsed' };

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/xml' },
      data: objectData,
      ok: true,
    }));

    expect(mockParse).not.toHaveBeenCalled();
    expect(result.data).toBe(objectData);
  });

  it('should pass options to XMLParser constructor', async () => {
    const options = {
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    };

    const policy = xml(options);

    const xmlData = '<root attr="value">text</root>';
    const parsedData = { root: { '@_attr': 'value', '#text': 'text' } };
    mockParse.mockReturnValue(parsedData);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/xml' },
      data: xmlData,
      ok: true,
    }));

    expect(MockXMLParser).toHaveBeenCalledWith(options);
    expect(result.data).toEqual(parsedData);
  });

  it('should use default options when none provided', async () => {
    const policy = xml();

    const xmlData = '<simple>data</simple>';
    mockParse.mockReturnValue({ simple: 'data' });

    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/xml' },
      data: xmlData,
      ok: true,
    }));

    expect(MockXMLParser).toHaveBeenCalledWith({});
  });

  it('should handle complex XML structures', async () => {
    const policy = xml();

    const xmlData = `
      <catalog>
        <book id="1">
          <title>Test Book</title>
          <author>John Doe</author>
        </book>
        <book id="2">
          <title>Another Book</title>
          <author>Jane Smith</author>
        </book>
      </catalog>
    `;

    const parsedData = {
      catalog: {
        book: [
          { id: '1', title: 'Test Book', author: 'John Doe' },
          { id: '2', title: 'Another Book', author: 'Jane Smith' },
        ],
      },
    };

    mockParse.mockReturnValue(parsedData);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/xml' },
      data: xmlData,
      ok: true,
    }));

    expect(result.data).toEqual(parsedData);
  });

  it('should handle empty XML', async () => {
    const policy = xml();

    mockParse.mockReturnValue({});

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/xml' },
      data: '',
      ok: true,
    }));

    expect(mockParse).toHaveBeenCalledWith('');
    expect(result.data).toEqual({});
  });

  it('should handle missing content-type header', async () => {
    const policy = xml();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '<root>data</root>',
      ok: true,
    }));

    expect(mockParse).not.toHaveBeenCalled();
    expect(result.data).toBe('<root>data</root>');
  });

  it('should detect xml in various content-type formats', async () => {
    const policy = xml();
    const xmlData = '<test>value</test>';
    mockParse.mockReturnValue({ test: 'value' });

    const contentTypes = [
      'application/xml',
      'text/xml',
      'application/xml; charset=utf-8',
      'text/xml; charset=iso-8859-1',
      'application/soap+xml',
      'application/rss+xml',
    ];

    for (const contentType of contentTypes) {
      mockParse.mockClear();

      await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': contentType },
        data: xmlData,
        ok: true,
      }));

      expect(mockParse).toHaveBeenCalled();
    }
  });

  it('should preserve other response properties', async () => {
    const policy = xml();

    mockParse.mockReturnValue({ parsed: 'data' });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'application/xml', 'x-custom': 'header' },
      data: '<root>data</root>',
      ok: true,
    }));

    expect(result.status).toBe(201);
    expect(result.statusText).toBe('Created');
    expect(result.headers['x-custom']).toBe('header');
    expect(result.ok).toBe(true);
  });

  it('should handle UTF-8 encoded XML', async () => {
    const policy = xml();

    const xmlData = '<message>Hello 世界 🌍</message>';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(xmlData).buffer;

    mockParse.mockReturnValue({ message: 'Hello 世界 🌍' });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/xml; charset=utf-8' },
      data: buffer,
      ok: true,
    }));

    expect(mockParse).toHaveBeenCalledWith(xmlData);
    expect(result.data).toEqual({ message: 'Hello 世界 🌍' });
  });
});

describe('@unireq/xml - xmlBody serializer', () => {
  beforeEach(() => {
    mockBuild.mockReset();
    MockXMLBuilder.mockClear();
  });

  it('should create a BodyDescriptor with application/xml content type', () => {
    const data = { user: { name: 'John', email: 'john@example.com' } };
    const descriptor = xmlBody(data);

    expect(descriptor.__brand).toBe('BodyDescriptor');
    expect(descriptor.contentType).toBe('application/xml');
    expect(descriptor.data).toBe(data);
  });

  it('should serialize object to XML string', () => {
    const data = { user: { name: 'John', email: 'john@example.com' } };
    const expectedXml = '<user><name>John</name><email>john@example.com</email></user>';
    mockBuild.mockReturnValue(expectedXml);

    const descriptor = xmlBody(data);
    const serialized = descriptor.serialize();

    expect(MockXMLBuilder).toHaveBeenCalledWith({});
    expect(mockBuild).toHaveBeenCalledWith(data);
    expect(serialized).toBe(expectedXml);
  });

  it('should pass builder options to XMLBuilder', () => {
    const data = { root: { item: 'value' } };
    const options = {
      format: true,
      indentBy: '  ',
      ignoreAttributes: false,
    };
    const expectedXml = '<root>\n  <item>value</item>\n</root>';
    mockBuild.mockReturnValue(expectedXml);

    const descriptor = xmlBody(data, options);
    descriptor.serialize();

    expect(MockXMLBuilder).toHaveBeenCalledWith(options);
    expect(mockBuild).toHaveBeenCalledWith(data);
  });

  it('should handle complex nested objects', () => {
    const data = {
      catalog: {
        book: [
          { id: '1', title: 'Test Book', author: 'John Doe' },
          { id: '2', title: 'Another Book', author: 'Jane Smith' },
        ],
      },
    };
    const expectedXml = `<catalog>
      <book id="1">
        <title>Test Book</title>
        <author>John Doe</author>
      </book>
      <book id="2">
        <title>Another Book</title>
        <author>Jane Smith</author>
      </book>
    </catalog>`;
    mockBuild.mockReturnValue(expectedXml);

    const descriptor = xmlBody(data);
    const serialized = descriptor.serialize();

    expect(mockBuild).toHaveBeenCalledWith(data);
    expect(serialized).toBe(expectedXml);
  });

  it('should handle empty objects', () => {
    const data = {};
    const expectedXml = '';
    mockBuild.mockReturnValue(expectedXml);

    const descriptor = xmlBody(data);
    const serialized = descriptor.serialize();

    expect(mockBuild).toHaveBeenCalledWith(data);
    expect(serialized).toBe(expectedXml);
  });

  it('should handle objects with attributes', () => {
    const data = {
      root: {
        '@_attr': 'value',
        '#text': 'content',
      },
    };
    const options = {
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    };
    const expectedXml = '<root attr="value">content</root>';
    mockBuild.mockReturnValue(expectedXml);

    const descriptor = xmlBody(data, options);
    const serialized = descriptor.serialize();

    expect(MockXMLBuilder).toHaveBeenCalledWith(options);
    expect(mockBuild).toHaveBeenCalledWith(data);
    expect(serialized).toBe(expectedXml);
  });

  it('should serialize lazily (only when serialize is called)', () => {
    const data = { test: 'data' };
    const descriptor = xmlBody(data);

    expect(mockBuild).not.toHaveBeenCalled();

    descriptor.serialize();
    expect(mockBuild).toHaveBeenCalledTimes(1);
  });
});

// Note: The error handling test for missing fast-xml-parser is difficult to test
// in a mocked environment. The actual error is tested in integration tests.
