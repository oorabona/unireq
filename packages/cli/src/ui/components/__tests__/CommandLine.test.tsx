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
    it('should render with default prompt and border', () => {
      const onSubmit = vi.fn();
      const { lastFrame } = render(<CommandLine onSubmit={onSubmit} />);

      // Default prompt is ">" with a bordered box
      expect(lastFrame()).toContain('>');
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
      expect(lastFrame()).toContain('>');
    });
  });

  describe('Props validation', () => {
    it('should accept all props without error', () => {
      const onSubmit = vi.fn();
      const onChange = vi.fn();

      // Should not throw
      expect(() => {
        render(
          <CommandLine
            onSubmit={onSubmit}
            onChange={onChange}
            prompt="test>"
            placeholder="Test..."
            isDisabled={false}
          />,
        );
      }).not.toThrow();
    });

    it('should accept history prop', () => {
      const onSubmit = vi.fn();
      const { lastFrame } = render(<CommandLine onSubmit={onSubmit} history={['help', 'ls']} />);

      expect(lastFrame()).toContain('>');
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

    it('should render with bordered box', () => {
      const onSubmit = vi.fn();
      const { lastFrame } = render(<CommandLine onSubmit={onSubmit} />);
      const frame = lastFrame() ?? '';

      // Should have round border characters (╭, ╮, ╰, ╯)
      expect(frame).toMatch(/[╭╮╰╯]/);
    });

    it('should accept custom border color', () => {
      const onSubmit = vi.fn();
      // Should not throw with custom border color
      expect(() => {
        render(<CommandLine onSubmit={onSubmit} borderColor="cyan" />);
      }).not.toThrow();
    });
  });

  describe('Autocomplete integration', () => {
    it('should not submit on Enter when autocompleteActive is true', async () => {
      const onSubmit = vi.fn();
      const { stdin } = render(<CommandLine onSubmit={onSubmit} value="test" autocompleteActive={true} />);

      await stdin.write('\r'); // Enter

      // Enter should be ignored when autocomplete is active
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should submit on Enter when autocompleteActive is false', async () => {
      const onSubmit = vi.fn();
      const { stdin } = render(<CommandLine onSubmit={onSubmit} value="test" autocompleteActive={false} />);

      await stdin.write('\r'); // Enter

      expect(onSubmit).toHaveBeenCalledWith('test');
    });
  });
});
