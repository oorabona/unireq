/**
 * Tests for CommandLine Component
 *
 * Note: @inkjs/ui TextInput is an uncontrolled component with internal
 * state management. We test rendering and structure, not internal behavior.
 */

import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import { CommandLine } from '../CommandLine.js';

describe('CommandLine', () => {
  describe('Rendering', () => {
    it('should render with default prompt', () => {
      const onSubmit = vi.fn();
      const { lastFrame } = render(<CommandLine onSubmit={onSubmit} />);

      expect(lastFrame()).toContain('unireq>');
    });

    it('should render with custom prompt', () => {
      const onSubmit = vi.fn();
      const { lastFrame } = render(<CommandLine onSubmit={onSubmit} prompt="api>" />);

      expect(lastFrame()).toContain('api>');
    });

    it('should accept placeholder prop', () => {
      const onSubmit = vi.fn();
      // Should not throw when rendering with placeholder
      // Note: @inkjs/ui TextInput may style placeholder differently
      expect(() => {
        render(<CommandLine onSubmit={onSubmit} placeholder="Enter command..." />);
      }).not.toThrow();
    });

    it('should render when disabled', () => {
      const onSubmit = vi.fn();
      const { lastFrame } = render(<CommandLine onSubmit={onSubmit} isDisabled />);

      // Should still render prompt
      expect(lastFrame()).toContain('unireq>');
    });
  });

  describe('Props validation', () => {
    it('should accept all props without error', () => {
      const onSubmit = vi.fn();
      const onChange = vi.fn();
      const suggestions = ['/users', '/products', '/orders'];

      // Should not throw
      expect(() => {
        render(
          <CommandLine
            onSubmit={onSubmit}
            onChange={onChange}
            prompt="test>"
            placeholder="Test..."
            suggestions={suggestions}
            isDisabled={false}
          />,
        );
      }).not.toThrow();
    });

    it('should work with empty suggestions array', () => {
      const onSubmit = vi.fn();
      const { lastFrame } = render(<CommandLine onSubmit={onSubmit} suggestions={[]} />);

      expect(lastFrame()).toContain('unireq>');
    });
  });

  describe('Prompt styling', () => {
    it('should display prompt before input area', () => {
      const onSubmit = vi.fn();
      const { lastFrame } = render(<CommandLine onSubmit={onSubmit} prompt="myapp>" />);
      const frame = lastFrame();

      // Prompt should appear
      expect(frame).toContain('myapp>');
    });
  });
});
