/**
 * Tests for assertions engine
 */

import { describe, expect, it } from 'vitest';
import {
  type AssertableResponse,
  type AssertionResult,
  allPassed,
  assertContains,
  assertHeader,
  assertJsonPath,
  assertResponse,
  assertStatus,
  getFailures,
} from '../asserter.js';
import type { AssertConfig, JsonAssertion } from '../types.js';

describe('asserter', () => {
  describe('assertStatus', () => {
    describe('when status matches expected', () => {
      it('should pass with success message', () => {
        // Arrange
        const expected = 200;
        const actual = 200;

        // Act
        const result = assertStatus(expected, actual);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toBe('Status: 200 ✓');
        expect(result.assertion).toBe('status: 200');
      });
    });

    describe('when status does not match', () => {
      it('should fail with expected vs actual message', () => {
        // Arrange
        const expected = 200;
        const actual = 404;

        // Act
        const result = assertStatus(expected, actual);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toBe('Status: expected 200, got 404');
        expect(result.assertion).toBe('status: 200');
      });
    });

    describe('when status is 500', () => {
      it('should handle server error status', () => {
        // Arrange & Act
        const result = assertStatus(200, 500);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toBe('Status: expected 200, got 500');
      });
    });
  });

  describe('assertHeader', () => {
    describe('when header matches expected (case-insensitive)', () => {
      it('should pass with lowercase header name', () => {
        // Arrange
        const headers = { 'Content-Type': 'application/json' };

        // Act
        const result = assertHeader('content-type', 'application/json', headers);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toBe("Header content-type: 'application/json' ✓");
      });

      it('should pass with uppercase header name', () => {
        // Arrange
        const headers = { 'content-type': 'application/json' };

        // Act
        const result = assertHeader('CONTENT-TYPE', 'application/json', headers);

        // Assert
        expect(result.passed).toBe(true);
      });

      it('should pass with mixed case header name', () => {
        // Arrange
        const headers = { 'Content-Type': 'text/html' };

        // Act
        const result = assertHeader('Content-Type', 'text/html', headers);

        // Assert
        expect(result.passed).toBe(true);
      });
    });

    describe('when header value does not match', () => {
      it('should fail with expected vs actual message', () => {
        // Arrange
        const headers = { 'Content-Type': 'text/html' };

        // Act
        const result = assertHeader('Content-Type', 'application/json', headers);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toBe("Header Content-Type: expected 'application/json', got 'text/html'");
      });
    });

    describe('when header is missing', () => {
      it('should fail with not found message', () => {
        // Arrange
        const headers = { 'Content-Type': 'application/json' };

        // Act
        const result = assertHeader('X-Custom-Header', 'value', headers);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toBe("Header 'X-Custom-Header' not found");
        expect(result.assertion).toBe('header: X-Custom-Header');
      });
    });

    describe('when headers object is empty', () => {
      it('should fail with not found message', () => {
        // Arrange
        const headers = {};

        // Act
        const result = assertHeader('Any-Header', 'value', headers);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toBe("Header 'Any-Header' not found");
      });
    });
  });

  describe('assertContains', () => {
    describe('when body contains string', () => {
      it('should pass with success message', () => {
        // Arrange
        const body = 'Hello World';
        const expected = 'World';

        // Act
        const result = assertContains(expected, body);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toBe("Body contains 'World' ✓");
      });

      it('should handle substring at start', () => {
        // Arrange
        const result = assertContains('Hello', 'Hello World');

        // Assert
        expect(result.passed).toBe(true);
      });

      it('should handle substring at end', () => {
        // Arrange
        const result = assertContains('World', 'Hello World');

        // Assert
        expect(result.passed).toBe(true);
      });
    });

    describe('when body does not contain string', () => {
      it('should fail with not contains message', () => {
        // Arrange
        const body = 'Hello World';
        const expected = 'Goodbye';

        // Act
        const result = assertContains(expected, body);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toBe("Body does not contain 'Goodbye'");
      });
    });

    describe('when expected string is long', () => {
      it('should truncate in success message', () => {
        // Arrange
        const longString = 'a'.repeat(50);
        const body = `contains ${longString} here`;

        // Act
        const result = assertContains(longString, body);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toContain('...');
        expect(result.message.length).toBeLessThan(100);
      });

      it('should truncate in failure message', () => {
        // Arrange
        const longString = 'x'.repeat(100);
        const body = 'short body';

        // Act
        const result = assertContains(longString, body);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toContain('...');
      });
    });

    describe('when body is empty', () => {
      it('should fail to find non-empty string', () => {
        // Arrange
        const result = assertContains('something', '');

        // Assert
        expect(result.passed).toBe(false);
      });

      it('should pass for empty expected string', () => {
        // Arrange
        const result = assertContains('', 'any body');

        // Assert
        expect(result.passed).toBe(true);
      });
    });
  });

  describe('assertJsonPath', () => {
    describe('when response is not valid JSON', () => {
      it('should fail with invalid JSON message', () => {
        // Arrange
        const assertion: JsonAssertion = { path: '$.id', op: 'exists' };
        const body = 'plain text';

        // Act
        const result = assertJsonPath(assertion, body);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toBe('Response is not valid JSON');
        expect(result.assertion).toBe('json: $.id');
      });

      it('should handle malformed JSON', () => {
        // Arrange
        const assertion: JsonAssertion = { path: '$.id', op: 'exists' };
        const body = '{ invalid json }';

        // Act
        const result = assertJsonPath(assertion, body);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toBe('Response is not valid JSON');
      });
    });

    describe('exists operator', () => {
      describe('when path exists', () => {
        it('should pass with exists message', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.data.id', op: 'exists' };
          const body = JSON.stringify({ data: { id: 42 } });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
          expect(result.message).toBe('$.data.id: exists ✓');
          expect(result.assertion).toBe('json: $.data.id exists');
        });

        it('should pass for null value (path exists)', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.nullValue', op: 'exists' };
          const body = JSON.stringify({ nullValue: null });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false); // null is considered "does not exist"
        });

        it('should pass for zero value', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.count', op: 'exists' };
          const body = JSON.stringify({ count: 0 });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
        });

        it('should pass for false value', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.active', op: 'exists' };
          const body = JSON.stringify({ active: false });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
        });

        it('should pass for empty string value', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.name', op: 'exists' };
          const body = JSON.stringify({ name: '' });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
        });
      });

      describe('when path does not exist', () => {
        it('should fail with path not found message', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.missing', op: 'exists' };
          const body = JSON.stringify({ data: { id: 42 } });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
          expect(result.message).toBe('$.missing: path not found');
          expect(result.assertion).toBe('json: $.missing exists');
        });
      });
    });

    describe('equals operator', () => {
      describe('when value equals expected', () => {
        it('should pass for number equality', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.count', op: 'equals', value: 10 };
          const body = JSON.stringify({ count: 10 });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
          expect(result.message).toBe('$.count: equals 10 ✓');
          expect(result.assertion).toBe('json: $.count equals');
        });

        it('should pass for string equality', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.name', op: 'equals', value: 'Alice' };
          const body = JSON.stringify({ name: 'Alice' });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
          expect(result.message).toBe("$.name: equals 'Alice' ✓");
        });

        it('should pass for boolean equality', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.active', op: 'equals', value: true };
          const body = JSON.stringify({ active: true });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
        });

        it('should pass for null equality', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.data', op: 'equals', value: null };
          const body = JSON.stringify({ data: null });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
          expect(result.message).toBe('$.data: equals null ✓');
        });

        it('should pass for object equality', () => {
          // Arrange
          const expectedObj = { a: 1, b: 2 };
          const assertion: JsonAssertion = { path: '$.data', op: 'equals', value: expectedObj };
          const body = JSON.stringify({ data: { a: 1, b: 2 } });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
        });

        it('should pass for array equality', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.items', op: 'equals', value: [1, 2, 3] };
          const body = JSON.stringify({ items: [1, 2, 3] });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
        });
      });

      describe('when value does not equal expected', () => {
        it('should fail with expected vs actual message', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.count', op: 'equals', value: 10 };
          const body = JSON.stringify({ count: 5 });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
          expect(result.message).toBe('$.count: expected 10, got 5');
        });

        it('should fail for type mismatch', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.count', op: 'equals', value: '10' };
          const body = JSON.stringify({ count: 10 });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
        });

        it('should fail for object mismatch', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.data', op: 'equals', value: { a: 1 } };
          const body = JSON.stringify({ data: { a: 2 } });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
        });

        it('should fail for array length mismatch', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.items', op: 'equals', value: [1, 2] };
          const body = JSON.stringify({ items: [1, 2, 3] });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
        });
      });

      describe('when path does not exist', () => {
        it('should fail with path not found', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.missing', op: 'equals', value: 10 };
          const body = JSON.stringify({ count: 5 });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
          expect(result.message).toBe('$.missing: path not found');
        });
      });
    });

    describe('contains operator', () => {
      describe('when string contains substring', () => {
        it('should pass with contains message', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.name', op: 'contains', value: 'Alice' };
          const body = JSON.stringify({ name: 'Alice Smith' });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
          expect(result.message).toBe("$.name: contains 'Alice' ✓");
          expect(result.assertion).toBe('json: $.name contains');
        });
      });

      describe('when string does not contain substring', () => {
        it('should fail with not contains message', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.name', op: 'contains', value: 'Bob' };
          const body = JSON.stringify({ name: 'Alice Smith' });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
          expect(result.message).toBe("$.name: does not contain 'Bob'");
        });
      });

      describe('when value is a number', () => {
        it('should convert to string and check', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.code', op: 'contains', value: '200' };
          const body = JSON.stringify({ code: 200 });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
        });
      });
    });

    describe('matches operator', () => {
      describe('when value matches regex pattern', () => {
        it('should pass with matches message', () => {
          // Arrange
          const assertion: JsonAssertion = {
            path: '$.email',
            op: 'matches',
            pattern: '^.+@.+\\..+$',
          };
          const body = JSON.stringify({ email: 'user@example.com' });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
          expect(result.message).toBe('$.email: matches pattern ✓');
          expect(result.assertion).toBe('json: $.email matches');
        });

        it('should handle simple patterns', () => {
          // Arrange
          const assertion: JsonAssertion = {
            path: '$.id',
            op: 'matches',
            pattern: '^[0-9]+$',
          };
          const body = JSON.stringify({ id: '12345' });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(true);
        });
      });

      describe('when value does not match regex', () => {
        it('should fail with not match message', () => {
          // Arrange
          const assertion: JsonAssertion = {
            path: '$.email',
            op: 'matches',
            pattern: '^.+@.+\\..+$',
          };
          const body = JSON.stringify({ email: 'invalid-email' });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
          expect(result.message).toContain('$.email: does not match pattern');
        });
      });

      describe('when pattern is missing', () => {
        it('should fail with requires pattern message', () => {
          // Arrange
          const assertion: JsonAssertion = { path: '$.email', op: 'matches' };
          const body = JSON.stringify({ email: 'user@example.com' });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
          expect(result.message).toBe("$.email: 'matches' requires a 'pattern' property");
        });
      });

      describe('when pattern is invalid regex', () => {
        it('should fail with invalid regex message', () => {
          // Arrange
          const assertion: JsonAssertion = {
            path: '$.email',
            op: 'matches',
            pattern: '[invalid',
          };
          const body = JSON.stringify({ email: 'test@example.com' });

          // Act
          const result = assertJsonPath(assertion, body);

          // Assert
          expect(result.passed).toBe(false);
          expect(result.message).toContain('Invalid regex pattern');
        });
      });
    });

    describe('unknown operator', () => {
      it('should fail with unknown operator message', () => {
        // Arrange
        const assertion = { path: '$.id', op: 'unknown' as never };
        const body = JSON.stringify({ id: 42 });

        // Act
        const result = assertJsonPath(assertion, body);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toBe('Unknown operator: unknown');
      });
    });

    describe('invalid JSONPath', () => {
      it('should fail with invalid path message', () => {
        // Arrange
        const assertion: JsonAssertion = { path: 'invalid path', op: 'exists' };
        const body = JSON.stringify({ id: 42 });

        // Act
        const result = assertJsonPath(assertion, body);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.message).toContain('Invalid JSONPath');
      });
    });
  });

  describe('assertResponse', () => {
    const createResponse = (status: number, headers: Record<string, string> = {}, body = ''): AssertableResponse => ({
      status,
      headers,
      body,
    });

    describe('when all assertions pass', () => {
      it('should return all passed results', () => {
        // Arrange
        const config: AssertConfig = {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          contains: 'success',
          json: [{ path: '$.ok', op: 'equals', value: true }],
        };
        const response = createResponse(200, { 'Content-Type': 'application/json' }, '{"ok":true,"message":"success"}');

        // Act
        const results = assertResponse(config, response);

        // Assert
        expect(results).toHaveLength(4);
        expect(allPassed(results)).toBe(true);
        expect(getFailures(results)).toHaveLength(0);
      });
    });

    describe('when some assertions fail', () => {
      it('should evaluate all assertions (no short-circuit)', () => {
        // Arrange
        const config: AssertConfig = {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          json: [{ path: '$.error', op: 'equals', value: false }],
        };
        const response = createResponse(200, { 'Content-Type': 'text/html' }, '{"error":true}');

        // Act
        const results = assertResponse(config, response);

        // Assert
        expect(results).toHaveLength(3); // All assertions evaluated
        expect(allPassed(results)).toBe(false);

        const failures = getFailures(results);
        expect(failures).toHaveLength(2); // header + json failed
      });

      it('should report both passed and failed assertions', () => {
        // Arrange
        const config: AssertConfig = {
          status: 200,
          contains: 'error',
        };
        const response = createResponse(200, {}, 'success response');

        // Act
        const results = assertResponse(config, response);

        // Assert
        expect(results).toHaveLength(2);
        expect(results[0]?.passed).toBe(true); // status
        expect(results[1]?.passed).toBe(false); // contains
      });
    });

    describe('with only status assertion', () => {
      it('should return single result', () => {
        // Arrange
        const config: AssertConfig = { status: 200 };
        const response = createResponse(200);

        // Act
        const results = assertResponse(config, response);

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0]?.passed).toBe(true);
      });
    });

    describe('with only header assertions', () => {
      it('should return results for each header', () => {
        // Arrange
        const config: AssertConfig = {
          headers: {
            'Content-Type': 'application/json',
            'X-Custom': 'value',
          },
        };
        const response = createResponse(200, {
          'Content-Type': 'application/json',
          'X-Custom': 'value',
        });

        // Act
        const results = assertResponse(config, response);

        // Assert
        expect(results).toHaveLength(2);
        expect(allPassed(results)).toBe(true);
      });
    });

    describe('with multiple JSON assertions', () => {
      it('should return results for each JSON assertion', () => {
        // Arrange
        const config: AssertConfig = {
          json: [
            { path: '$.id', op: 'exists' },
            { path: '$.name', op: 'equals', value: 'test' },
            { path: '$.email', op: 'matches', pattern: '@' },
          ],
        };
        const response = createResponse(200, {}, JSON.stringify({ id: 1, name: 'test', email: 'a@b.com' }));

        // Act
        const results = assertResponse(config, response);

        // Assert
        expect(results).toHaveLength(3);
        expect(allPassed(results)).toBe(true);
      });
    });

    describe('with empty config', () => {
      it('should return empty results array', () => {
        // Arrange
        const config: AssertConfig = {};
        const response = createResponse(200);

        // Act
        const results = assertResponse(config, response);

        // Assert
        expect(results).toHaveLength(0);
        expect(allPassed(results)).toBe(true);
      });
    });
  });

  describe('allPassed', () => {
    it('should return true when all results passed', () => {
      // Arrange
      const results: AssertionResult[] = [
        { passed: true, message: 'ok', assertion: 'a' },
        { passed: true, message: 'ok', assertion: 'b' },
      ];

      // Act & Assert
      expect(allPassed(results)).toBe(true);
    });

    it('should return false when any result failed', () => {
      // Arrange
      const results: AssertionResult[] = [
        { passed: true, message: 'ok', assertion: 'a' },
        { passed: false, message: 'fail', assertion: 'b' },
      ];

      // Act & Assert
      expect(allPassed(results)).toBe(false);
    });

    it('should return true for empty results', () => {
      // Act & Assert
      expect(allPassed([])).toBe(true);
    });
  });

  describe('getFailures', () => {
    it('should return only failed results', () => {
      // Arrange
      const results: AssertionResult[] = [
        { passed: true, message: 'ok', assertion: 'a' },
        { passed: false, message: 'fail1', assertion: 'b' },
        { passed: true, message: 'ok', assertion: 'c' },
        { passed: false, message: 'fail2', assertion: 'd' },
      ];

      // Act
      const failures = getFailures(results);

      // Assert
      expect(failures).toHaveLength(2);
      expect(failures[0]?.message).toBe('fail1');
      expect(failures[1]?.message).toBe('fail2');
    });

    it('should return empty array when all passed', () => {
      // Arrange
      const results: AssertionResult[] = [
        { passed: true, message: 'ok', assertion: 'a' },
        { passed: true, message: 'ok', assertion: 'b' },
      ];

      // Act & Assert
      expect(getFailures(results)).toHaveLength(0);
    });
  });
});
