import { describe, expect, it } from 'vitest';
import { importCurlCommand, isCurlCommand, parseCurlCommand } from '../curl.js';

describe('cURL Import', () => {
  describe('isCurlCommand', () => {
    it('should detect curl command with lowercase', () => {
      expect(isCurlCommand('curl https://api.example.com')).toBe(true);
    });

    it('should detect curl command with uppercase', () => {
      expect(isCurlCommand('CURL https://api.example.com')).toBe(true);
    });

    it('should detect curl command with mixed case', () => {
      expect(isCurlCommand('Curl https://api.example.com')).toBe(true);
    });

    it('should detect curl command with leading whitespace', () => {
      expect(isCurlCommand('  curl https://api.example.com')).toBe(true);
    });

    it('should reject non-curl commands', () => {
      expect(isCurlCommand('wget https://api.example.com')).toBe(false);
    });

    it('should reject JSON content', () => {
      expect(isCurlCommand('{"info": {"schema": "postman"}}')).toBe(false);
    });

    it('should handle standalone curl word', () => {
      expect(isCurlCommand('curl')).toBe(true);
    });
  });

  describe('parseCurlCommand', () => {
    describe('URL parsing', () => {
      it('should parse simple GET URL', () => {
        const result = parseCurlCommand('curl https://api.example.com/users');
        expect(result.url).toBe('https://api.example.com/users');
        expect(result.method).toBe('GET');
      });

      it('should parse URL without curl prefix', () => {
        const result = parseCurlCommand('https://api.example.com/users');
        expect(result.url).toBe('https://api.example.com/users');
      });

      it('should parse URL with query parameters', () => {
        const result = parseCurlCommand('curl "https://api.example.com/users?page=1&limit=10"');
        expect(result.url).toBe('https://api.example.com/users?page=1&limit=10');
      });

      it('should throw on empty command', () => {
        expect(() => parseCurlCommand('')).toThrow('Empty cURL command');
      });

      it('should throw if no URL found', () => {
        expect(() => parseCurlCommand('curl -X POST')).toThrow('No URL found');
      });
    });

    describe('HTTP method parsing', () => {
      it('should parse -X POST', () => {
        const result = parseCurlCommand('curl -X POST https://api.example.com');
        expect(result.method).toBe('POST');
      });

      it('should parse --request PUT', () => {
        const result = parseCurlCommand('curl --request PUT https://api.example.com');
        expect(result.method).toBe('PUT');
      });

      it('should parse lowercase method', () => {
        const result = parseCurlCommand('curl -X delete https://api.example.com');
        expect(result.method).toBe('DELETE');
      });

      it('should default to GET', () => {
        const result = parseCurlCommand('curl https://api.example.com');
        expect(result.method).toBe('GET');
      });

      it('should change to POST when data is present', () => {
        const result = parseCurlCommand('curl -d "name=test" https://api.example.com');
        expect(result.method).toBe('POST');
      });

      it('should keep explicit method when data is present', () => {
        const result = parseCurlCommand('curl -X PUT -d "name=test" https://api.example.com');
        expect(result.method).toBe('PUT');
      });
    });

    describe('Header parsing', () => {
      it('should parse single -H header', () => {
        const result = parseCurlCommand('curl -H "Content-Type: application/json" https://api.example.com');
        expect(result.headers).toEqual([{ name: 'Content-Type', value: 'application/json' }]);
      });

      it('should parse --header', () => {
        const result = parseCurlCommand('curl --header "Accept: application/json" https://api.example.com');
        expect(result.headers).toEqual([{ name: 'Accept', value: 'application/json' }]);
      });

      it('should parse multiple headers', () => {
        const result = parseCurlCommand(
          'curl -H "Content-Type: application/json" -H "Authorization: Bearer token" https://api.example.com',
        );
        expect(result.headers).toHaveLength(2);
        expect(result.headers[0]).toEqual({ name: 'Content-Type', value: 'application/json' });
        expect(result.headers[1]).toEqual({ name: 'Authorization', value: 'Bearer token' });
      });

      it('should handle header with colons in value', () => {
        const result = parseCurlCommand('curl -H "X-Custom: value:with:colons" https://api.example.com');
        expect(result.headers[0]).toEqual({ name: 'X-Custom', value: 'value:with:colons' });
      });

      it('should skip malformed headers', () => {
        const result = parseCurlCommand('curl -H "InvalidHeader" https://api.example.com');
        expect(result.headers).toHaveLength(0);
      });
    });

    describe('Data parsing', () => {
      it('should parse -d data', () => {
        const result = parseCurlCommand('curl -d "name=test" https://api.example.com');
        expect(result.data).toBe('name=test');
      });

      it('should parse --data', () => {
        const result = parseCurlCommand('curl --data "name=test" https://api.example.com');
        expect(result.data).toBe('name=test');
      });

      it('should parse --data-raw', () => {
        const result = parseCurlCommand('curl --data-raw \'{"name":"test"}\' https://api.example.com');
        expect(result.data).toBe('{"name":"test"}');
      });

      it('should combine multiple -d flags', () => {
        const result = parseCurlCommand('curl -d "name=test" -d "age=25" https://api.example.com');
        expect(result.data).toBe('name=test&age=25');
      });

      it('should parse --data-urlencode', () => {
        const result = parseCurlCommand('curl --data-urlencode "name=hello world" https://api.example.com');
        expect(result.data).toBe('name=hello%20world');
      });
    });

    describe('Form data parsing', () => {
      it('should parse -F form field', () => {
        const result = parseCurlCommand('curl -F "name=test" https://api.example.com');
        expect(result.formData).toEqual([{ name: 'name', value: 'test', type: 'text' }]);
      });

      it('should parse --form', () => {
        const result = parseCurlCommand('curl --form "email=test@example.com" https://api.example.com');
        expect(result.formData).toEqual([{ name: 'email', value: 'test@example.com', type: 'text' }]);
      });

      it('should detect file upload', () => {
        const result = parseCurlCommand('curl -F "file=@/path/to/file.txt" https://api.example.com');
        expect(result.formData).toEqual([{ name: 'file', value: '/path/to/file.txt', type: 'file' }]);
      });

      it('should parse multiple form fields', () => {
        const result = parseCurlCommand('curl -F "name=test" -F "email=test@example.com" https://api.example.com');
        expect(result.formData).toHaveLength(2);
      });

      it('should change method to POST for form data', () => {
        const result = parseCurlCommand('curl -F "name=test" https://api.example.com');
        expect(result.method).toBe('POST');
      });
    });

    describe('Authentication parsing', () => {
      it('should parse -u basic auth', () => {
        const result = parseCurlCommand('curl -u user:pass https://api.example.com');
        expect(result.basicAuth).toEqual({ user: 'user', password: 'pass' });
        expect(result.headers.some((h) => h.name === 'Authorization' && h.value.startsWith('Basic '))).toBe(true);
      });

      it('should parse --user basic auth', () => {
        const result = parseCurlCommand('curl --user admin:secret https://api.example.com');
        expect(result.basicAuth).toEqual({ user: 'admin', password: 'secret' });
      });

      it('should handle user without password', () => {
        const result = parseCurlCommand('curl -u user https://api.example.com');
        expect(result.basicAuth).toEqual({ user: 'user', password: '' });
      });

      it('should handle password with colons', () => {
        const result = parseCurlCommand('curl -u user:pass:with:colons https://api.example.com');
        expect(result.basicAuth).toEqual({ user: 'user', password: 'pass:with:colons' });
      });
    });

    describe('Special header flags', () => {
      it('should parse -A user agent', () => {
        const result = parseCurlCommand('curl -A "MyAgent/1.0" https://api.example.com');
        expect(result.headers.find((h) => h.name === 'User-Agent')).toEqual({
          name: 'User-Agent',
          value: 'MyAgent/1.0',
        });
      });

      it('should parse --user-agent', () => {
        const result = parseCurlCommand('curl --user-agent "MyAgent/1.0" https://api.example.com');
        expect(result.headers.find((h) => h.name === 'User-Agent')).toEqual({
          name: 'User-Agent',
          value: 'MyAgent/1.0',
        });
      });

      it('should parse -e referer', () => {
        const result = parseCurlCommand('curl -e "https://example.com" https://api.example.com');
        expect(result.headers.find((h) => h.name === 'Referer')).toEqual({
          name: 'Referer',
          value: 'https://example.com',
        });
      });

      it('should parse -b cookie', () => {
        const result = parseCurlCommand('curl -b "session=abc123" https://api.example.com');
        expect(result.headers.find((h) => h.name === 'Cookie')).toEqual({
          name: 'Cookie',
          value: 'session=abc123',
        });
      });
    });

    describe('Flags parsing', () => {
      it('should detect -L flag', () => {
        const result = parseCurlCommand('curl -L https://api.example.com');
        expect(result.flags.location).toBe(true);
      });

      it('should detect --location flag', () => {
        const result = parseCurlCommand('curl --location https://api.example.com');
        expect(result.flags.location).toBe(true);
      });

      it('should detect -k flag', () => {
        const result = parseCurlCommand('curl -k https://api.example.com');
        expect(result.flags.insecure).toBe(true);
      });

      it('should detect --compressed flag', () => {
        const result = parseCurlCommand('curl --compressed https://api.example.com');
        expect(result.flags.compressed).toBe(true);
      });

      it('should ignore -s/-v flags', () => {
        const result = parseCurlCommand('curl -s -v https://api.example.com');
        expect(result.url).toBe('https://api.example.com');
      });
    });

    describe('Quoted strings', () => {
      it('should handle single-quoted URL', () => {
        const result = parseCurlCommand("curl 'https://api.example.com/path?foo=bar'");
        expect(result.url).toBe('https://api.example.com/path?foo=bar');
      });

      it('should handle double-quoted URL', () => {
        const result = parseCurlCommand('curl "https://api.example.com/path?foo=bar"');
        expect(result.url).toBe('https://api.example.com/path?foo=bar');
      });

      it('should handle escaped quotes in double-quoted strings', () => {
        const result = parseCurlCommand('curl -d "{\\"name\\":\\"test\\"}" https://api.example.com');
        expect(result.data).toBe('{"name":"test"}');
      });

      it('should handle JSON in single quotes', () => {
        const result = parseCurlCommand('curl -d \'{"name":"test"}\' https://api.example.com');
        expect(result.data).toBe('{"name":"test"}');
      });
    });

    describe('Line continuation', () => {
      it('should handle backslash line continuation', () => {
        const result = parseCurlCommand(`curl \\
  -X POST \\
  -H "Content-Type: application/json" \\
  https://api.example.com`);
        expect(result.method).toBe('POST');
        expect(result.url).toBe('https://api.example.com');
        expect(result.headers).toHaveLength(1);
      });

      it('should handle Windows-style line continuation', () => {
        const result = parseCurlCommand('curl \\\r\n-X POST \\\r\nhttps://api.example.com');
        expect(result.method).toBe('POST');
        expect(result.url).toBe('https://api.example.com');
      });
    });

    describe('Complex commands', () => {
      it('should parse complete POST command', () => {
        const result = parseCurlCommand(`curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token123" \\
  -d '{"name":"John","email":"john@example.com"}' \\
  https://api.example.com/users`);

        expect(result.method).toBe('POST');
        expect(result.url).toBe('https://api.example.com/users');
        expect(result.headers).toHaveLength(2);
        expect(result.data).toBe('{"name":"John","email":"john@example.com"}');
      });

      it('should parse command copied from browser', () => {
        const result = parseCurlCommand(
          `curl 'https://api.example.com/v1/resource' -H 'Accept: application/json' -H 'Accept-Language: en-US,en;q=0.9' --compressed`,
        );
        expect(result.url).toBe('https://api.example.com/v1/resource');
        expect(result.headers.length).toBeGreaterThanOrEqual(2);
        expect(result.flags.compressed).toBe(true);
      });
    });
  });

  describe('importCurlCommand', () => {
    it('should import simple GET request', () => {
      const result = importCurlCommand('curl https://api.example.com/users');

      expect(result.format).toBe('curl');
      expect(result.version).toBe('1.0');
      expect(result.collections).toHaveLength(1);
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item?.method).toBe('GET');
      expect(item?.path).toBe('/users');
    });

    it('should import POST with JSON body', () => {
      const result = importCurlCommand(
        'curl -X POST -H "Content-Type: application/json" -d \'{"name":"test"}\' https://api.example.com/users',
      );

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item?.method).toBe('POST');
      expect(item?.body).toBe('{"name":"test"}');
      expect(item?.headers['Content-Type']).toBe('application/json');
    });

    it('should use custom collection name', () => {
      const result = importCurlCommand('curl https://api.example.com', {
        collectionName: 'My API',
      });

      expect(result.collections[0]?.name).toBe('My API');
    });

    it('should use custom request name', () => {
      const result = importCurlCommand('curl https://api.example.com/users', {
        requestName: 'Get All Users',
      });

      expect(result.items[0]?.name).toBe('Get All Users');
    });

    it('should use ID prefix', () => {
      const result = importCurlCommand('curl https://api.example.com/users', {
        idPrefix: 'api',
      });

      expect(result.items[0]?.id).toMatch(/^api-/);
    });

    it('should generate warnings for ignored flags', () => {
      const result = importCurlCommand('curl -L -k --compressed https://api.example.com');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('-L'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('-k'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('--compressed'))).toBe(true);
    });

    it('should warn about file upload fields', () => {
      const result = importCurlCommand('curl -F "file=@/path/to/file.txt" https://api.example.com');

      expect(result.warnings.some((w) => w.includes('File upload'))).toBe(true);
    });

    it('should extract query parameters', () => {
      const result = importCurlCommand('curl "https://api.example.com/search?q=test&page=1"');

      const item = result.items[0];
      expect(item?.path).toBe('/search');
      expect(item?.queryParams['q']).toBe('test');
      expect(item?.queryParams['page']).toBe('1');
    });

    it('should convert form data to JSON body', () => {
      const result = importCurlCommand('curl -F "name=test" -F "email=test@example.com" https://api.example.com');

      const item = result.items[0];
      expect(item?.body).toBe('{"name":"test","email":"test@example.com"}');
    });

    it('should generate appropriate ID from path', () => {
      const result = importCurlCommand('curl -X DELETE https://api.example.com/users/123');

      const item = result.items[0];
      expect(item?.id).toMatch(/delete-users-123/);
    });

    it('should handle variable URLs', () => {
      const result = importCurlCommand('curl {{baseUrl}}/users');

      const item = result.items[0];
      expect(item?.path).toBe('/users');
    });

    it('should include host in collection description', () => {
      const result = importCurlCommand('curl https://api.example.com/users');

      expect(result.collections[0]?.description).toContain('api.example.com');
    });

    it('should set stats correctly', () => {
      const result = importCurlCommand('curl https://api.example.com');

      expect(result.stats.totalItems).toBe(1);
      expect(result.stats.convertedItems).toBe(1);
      expect(result.stats.skippedItems).toBe(0);
    });
  });
});
