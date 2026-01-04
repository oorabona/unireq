/**
 * Tests for Autocomplete Hook
 */

import { describe, expect, it } from 'vitest';
import type { PathInfo } from '../useAutocomplete.js';
import { completeInput, computeSuggestions } from '../useAutocomplete.js';

const mockPaths: PathInfo[] = [
  { path: '/users', methods: ['GET', 'POST'], description: 'User management' },
  { path: '/users/{id}', methods: ['GET', 'PUT', 'DELETE'], description: 'Single user' },
  { path: '/products', methods: ['GET'], description: 'Product list' },
  { path: '/orders', methods: ['GET', 'POST'] },
];

describe('computeSuggestions', () => {
  describe('Command suggestions', () => {
    it('should suggest built-in commands matching prefix', () => {
      // 'hel' matches 'help' and 'headers' but not 'head' (method)
      const suggestions = computeSuggestions('hel');

      expect(suggestions.some((s) => s.value === 'help')).toBe(true);
    });

    it('should suggest custom commands', () => {
      const suggestions = computeSuggestions('cus', { commands: ['custom-cmd'] });

      expect(suggestions.some((s) => s.value === 'custom-cmd')).toBe(true);
    });

    it('should include methods in command suggestions', () => {
      const suggestions = computeSuggestions('g');

      expect(suggestions.some((s) => s.value === 'get')).toBe(true);
    });

    it('should mark commands as command type', () => {
      const suggestions = computeSuggestions('hel');
      const helpSuggestion = suggestions.find((s) => s.value === 'help');

      expect(helpSuggestion?.type).toBe('command');
    });
  });

  describe('Method suggestions', () => {
    it('should suggest HTTP methods', () => {
      const suggestions = computeSuggestions('po');

      expect(suggestions.some((s) => s.value === 'post')).toBe(true);
    });

    it('should mark methods as method type', () => {
      const suggestions = computeSuggestions('ge');
      const getSuggestion = suggestions.find((s) => s.value === 'get');

      expect(getSuggestion?.type).toBe('method');
    });

    it('should suggest all methods for empty input with minChars=0', () => {
      const suggestions = computeSuggestions('', { minChars: 0 });

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Path suggestions', () => {
    it('should suggest paths after method', () => {
      const suggestions = computeSuggestions('get /us', { paths: mockPaths });

      expect(suggestions.some((s) => s.value === '/users')).toBe(true);
      expect(suggestions.some((s) => s.value === '/users/{id}')).toBe(true);
    });

    it('should suggest paths starting with /', () => {
      const suggestions = computeSuggestions('/prod', { paths: mockPaths });

      expect(suggestions.some((s) => s.value === '/products')).toBe(true);
    });

    it('should include path descriptions', () => {
      const suggestions = computeSuggestions('/users', { paths: mockPaths });
      const userSuggestion = suggestions.find((s) => s.value === '/users');

      expect(userSuggestion?.description).toBe('User management');
    });

    it('should show methods in description when no description', () => {
      const suggestions = computeSuggestions('/orders', { paths: mockPaths });
      const orderSuggestion = suggestions.find((s) => s.value === '/orders');

      expect(orderSuggestion?.description).toContain('GET');
      expect(orderSuggestion?.description).toContain('POST');
    });

    it('should mark paths as path type', () => {
      const suggestions = computeSuggestions('/users', { paths: mockPaths });

      expect(suggestions[0]?.type).toBe('path');
    });
  });

  describe('Configuration', () => {
    it('should return empty when input too short', () => {
      const suggestions = computeSuggestions('h', { minChars: 2 });

      expect(suggestions).toHaveLength(0);
    });

    it('should respect minChars', () => {
      const suggestions1 = computeSuggestions('he', { minChars: 3 });
      expect(suggestions1).toHaveLength(0);

      const suggestions2 = computeSuggestions('hel', { minChars: 3 });
      expect(suggestions2.length).toBeGreaterThan(0);
    });

    it('should respect maxSuggestions', () => {
      const suggestions = computeSuggestions('h', { maxSuggestions: 2 });

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('No matches', () => {
    it('should return empty array for no matches', () => {
      const suggestions = computeSuggestions('xyz123nonexistent');

      expect(suggestions).toHaveLength(0);
    });
  });
});

describe('completeInput', () => {
  it('should complete command and add space', () => {
    const result = completeInput('hel', 'help');

    expect(result).toBe('help ');
  });

  it('should complete method and add space', () => {
    const result = completeInput('ge', 'get');

    expect(result).toBe('get ');
  });

  it('should complete path after method', () => {
    const result = completeInput('get /us', '/users');

    expect(result).toBe('get /users');
  });

  it('should complete path starting with /', () => {
    const result = completeInput('/us', '/users');

    expect(result).toBe('/users');
  });

  // Note: Full arg completion (headers, body params) is not yet implemented
  // The current implementation focuses on command/method/path completion
});
