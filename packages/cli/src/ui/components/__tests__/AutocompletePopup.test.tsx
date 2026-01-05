/**
 * Tests for Autocomplete Popup Component
 */

import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import type { AutocompleteSuggestion } from '../AutocompletePopup.js';
import { AutocompletePopup } from '../AutocompletePopup.js';

const mockSuggestions: AutocompleteSuggestion[] = [
  { label: '/users', value: '/users', type: 'path' },
  { label: '/users/{id}', value: '/users/{id}', type: 'path', description: 'Get user by ID' },
  { label: '/products', value: '/products', type: 'path' },
];

describe('AutocompletePopup', () => {
  describe('Rendering', () => {
    it('should render suggestions', () => {
      const { lastFrame } = render(
        <AutocompletePopup suggestions={mockSuggestions} onSelect={() => {}} onClose={() => {}} />,
      );

      expect(lastFrame()).toContain('/users');
      expect(lastFrame()).toContain('/users/{id}');
      expect(lastFrame()).toContain('/products');
    });

    it('should show inline format with hints', () => {
      const { lastFrame } = render(
        <AutocompletePopup suggestions={mockSuggestions} onSelect={() => {}} onClose={() => {}} />,
      );

      // Shell-style inline format shows Tab/Enter hints
      expect(lastFrame()).toContain('Tab: cycle');
      expect(lastFrame()).toContain('Enter: select');
    });

    it('should highlight selected item with spaces', () => {
      const { lastFrame } = render(
        <AutocompletePopup suggestions={mockSuggestions} onSelect={() => {}} onClose={() => {}} />,
      );

      // Selected item has spaces around the label (bold, yellow background)
      expect(lastFrame()).toContain(' /users ');
    });

    it('should not render when not visible', () => {
      const { lastFrame } = render(
        <AutocompletePopup suggestions={mockSuggestions} onSelect={() => {}} onClose={() => {}} isVisible={false} />,
      );

      expect(lastFrame()).toBe('');
    });

    it('should not render when suggestions are empty', () => {
      const { lastFrame } = render(<AutocompletePopup suggestions={[]} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toBe('');
    });
  });

  describe('Close handling', () => {
    it('should call onClose when Escape is pressed', async () => {
      const onClose = vi.fn();
      const { stdin } = render(
        <AutocompletePopup suggestions={mockSuggestions} onSelect={() => {}} onClose={onClose} />,
      );

      await stdin.write('\x1B'); // Escape

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Selection handling', () => {
    it('should cycle through suggestions on Tab (not select immediately)', async () => {
      const onSelect = vi.fn();
      const { stdin } = render(
        <AutocompletePopup suggestions={mockSuggestions} onSelect={onSelect} onClose={() => {}} />,
      );

      // Tab cycles through suggestions, doesn't select
      await stdin.write('\t'); // Tab
      expect(onSelect).not.toHaveBeenCalled();

      // Tab again should still not select
      await stdin.write('\t'); // Tab
      expect(onSelect).not.toHaveBeenCalled();

      // Enter after Tab should select
      await stdin.write('\r'); // Enter
      expect(onSelect).toHaveBeenCalled();
    });

    it('should call onSelect with first item on Enter', async () => {
      const onSelect = vi.fn();
      const { stdin } = render(
        <AutocompletePopup suggestions={mockSuggestions} onSelect={onSelect} onClose={() => {}} />,
      );

      await stdin.write('\r'); // Enter

      expect(onSelect).toHaveBeenCalledWith('/users');
    });
  });

  describe('Max items', () => {
    const manySuggestions: AutocompleteSuggestion[] = Array.from({ length: 15 }, (_, i) => ({
      label: `/path${i + 1}`,
      value: `/path${i + 1}`,
      type: 'path' as const,
    }));

    it('should limit displayed items', () => {
      const { lastFrame } = render(
        <AutocompletePopup suggestions={manySuggestions} onSelect={() => {}} onClose={() => {}} maxItems={5} />,
      );

      expect(lastFrame()).toContain('/path1');
      expect(lastFrame()).toContain('/path5');
      expect(lastFrame()).not.toContain('/path6');
    });

    it('should show more indicator', () => {
      const { lastFrame } = render(
        <AutocompletePopup suggestions={manySuggestions} onSelect={() => {}} onClose={() => {}} maxItems={5} />,
      );

      // Shell-style inline format shows "+N" for remaining items
      expect(lastFrame()).toContain('+10');
    });
  });

  describe('Suggestion types', () => {
    it('should render path suggestions', () => {
      const suggestions: AutocompleteSuggestion[] = [{ label: '/users', value: '/users', type: 'path' }];

      const { lastFrame } = render(
        <AutocompletePopup suggestions={suggestions} onSelect={() => {}} onClose={() => {}} />,
      );

      expect(lastFrame()).toContain('/users');
    });

    it('should render command suggestions', () => {
      const suggestions: AutocompleteSuggestion[] = [{ label: 'help', value: 'help', type: 'command' }];

      const { lastFrame } = render(
        <AutocompletePopup suggestions={suggestions} onSelect={() => {}} onClose={() => {}} />,
      );

      expect(lastFrame()).toContain('help');
    });

    it('should render method suggestions', () => {
      const suggestions: AutocompleteSuggestion[] = [{ label: 'GET', value: 'get', type: 'method' }];

      const { lastFrame } = render(
        <AutocompletePopup suggestions={suggestions} onSelect={() => {}} onClose={() => {}} />,
      );

      expect(lastFrame()).toContain('GET');
    });

    it('should render variable suggestions', () => {
      const suggestions: AutocompleteSuggestion[] = [{ label: '${baseUrl}', value: '${baseUrl}', type: 'variable' }];

      const { lastFrame } = render(
        <AutocompletePopup suggestions={suggestions} onSelect={() => {}} onClose={() => {}} />,
      );

      expect(lastFrame()).toContain('${baseUrl}');
    });

    it('should render suggestions without type', () => {
      const suggestions: AutocompleteSuggestion[] = [{ label: 'unknown', value: 'unknown' }];

      const { lastFrame } = render(
        <AutocompletePopup suggestions={suggestions} onSelect={() => {}} onClose={() => {}} />,
      );

      expect(lastFrame()).toContain('unknown');
    });
  });
});
