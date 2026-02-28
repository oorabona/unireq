/**
 * Tests for History Picker Component
 */

import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import type { HistoryItem } from '../HistoryPicker.js';
import { HistoryPicker } from '../HistoryPicker.js';

const mockItems: HistoryItem[] = [
  { command: 'get /users', timestamp: new Date('2026-01-04T10:00:00'), status: 200 },
  { command: 'get /users/1', timestamp: new Date('2026-01-04T10:01:00'), status: 200 },
  { command: 'post /users', timestamp: new Date('2026-01-04T10:02:00'), status: 201 },
  { command: 'delete /users/1', timestamp: new Date('2026-01-04T10:03:00'), status: 404 },
];

describe('HistoryPicker', () => {
  describe('Rendering', () => {
    it('should render History title', () => {
      const { lastFrame } = render(<HistoryPicker items={mockItems} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('History');
    });

    it('should render close and select hints', () => {
      const { lastFrame } = render(<HistoryPicker items={mockItems} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('[Esc] Close');
      expect(lastFrame()).toContain('[Enter] Select');
    });

    it('should render history items', () => {
      const { lastFrame } = render(<HistoryPicker items={mockItems} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('get /users');
      expect(lastFrame()).toContain('post /users');
    });

    it('should render status codes', () => {
      const { lastFrame } = render(<HistoryPicker items={mockItems} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('200');
      expect(lastFrame()).toContain('201');
      expect(lastFrame()).toContain('404');
    });

    it('should show item count', () => {
      const { lastFrame } = render(<HistoryPicker items={mockItems} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('(1/4)');
    });

    it('should show selection indicator on first item', () => {
      const { lastFrame } = render(<HistoryPicker items={mockItems} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('>');
    });
  });

  describe('Empty state', () => {
    it('should show no history message when empty', () => {
      const { lastFrame } = render(<HistoryPicker items={[]} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('No history');
    });
  });

  describe('Close handling', () => {
    it('should call onClose when Escape is pressed', async () => {
      const onClose = vi.fn();
      const { stdin } = render(<HistoryPicker items={mockItems} onSelect={() => {}} onClose={onClose} />);

      await stdin.write('\x1B'); // Escape
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Selection handling', () => {
    it('should call onSelect with first item command on Enter', async () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      const { stdin } = render(<HistoryPicker items={mockItems} onSelect={onSelect} onClose={onClose} />);

      await stdin.write('\r'); // Enter

      expect(onSelect).toHaveBeenCalledWith('get /users');
      expect(onClose).toHaveBeenCalled();
    });

    it('should not call onSelect when items are empty', async () => {
      const onSelect = vi.fn();
      const { stdin } = render(<HistoryPicker items={[]} onSelect={onSelect} onClose={() => {}} />);

      await stdin.write('\r'); // Enter

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Without optional fields', () => {
    it('should render without timestamp', () => {
      const items: HistoryItem[] = [{ command: 'get /users', status: 200 }];

      const { lastFrame } = render(<HistoryPicker items={items} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('get /users');
      expect(lastFrame()).toContain('200');
    });

    it('should render without status', () => {
      const items: HistoryItem[] = [{ command: 'help', timestamp: new Date() }];

      const { lastFrame } = render(<HistoryPicker items={items} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('help');
    });

    it('should render with just command', () => {
      const items: HistoryItem[] = [{ command: 'exit' }];

      const { lastFrame } = render(<HistoryPicker items={items} onSelect={() => {}} onClose={() => {}} />);

      expect(lastFrame()).toContain('exit');
    });
  });

  describe('Long list handling', () => {
    const manyItems: HistoryItem[] = Array.from({ length: 20 }, (_, i) => ({
      command: `command ${i + 1}`,
      status: 200,
    }));

    it('should show scroll hint for long lists', () => {
      const { lastFrame } = render(
        <HistoryPicker items={manyItems} onSelect={() => {}} onClose={() => {}} maxHeight={10} />,
      );

      expect(lastFrame()).toContain('↑↓ navigate');
    });

    it('should render first items', () => {
      const { lastFrame } = render(
        <HistoryPicker items={manyItems} onSelect={() => {}} onClose={() => {}} maxHeight={10} />,
      );

      expect(lastFrame()).toContain('command 1');
    });
  });
});
