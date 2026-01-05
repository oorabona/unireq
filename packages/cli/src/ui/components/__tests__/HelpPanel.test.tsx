/**
 * Tests for HelpPanel Component
 */

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { DEFAULT_COMMANDS, DEFAULT_SHORTCUTS, HelpBar, HelpPanel, type Shortcut } from '../HelpPanel.js';

describe('HelpPanel', () => {
  describe('Rendering', () => {
    it('should render with default title', () => {
      const { lastFrame } = render(<HelpPanel />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Keyboard Shortcuts');
    });

    it('should render with custom title', () => {
      const { lastFrame } = render(<HelpPanel title="REPL Help" />);
      const output = lastFrame() ?? '';

      expect(output).toContain('REPL Help');
    });

    it('should show tip to use help command', () => {
      const { lastFrame } = render(<HelpPanel />);
      const output = lastFrame() ?? '';

      expect(output).toContain("Type 'help' for full command list");
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should display default shortcuts', () => {
      const { lastFrame } = render(<HelpPanel />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Tab');
      expect(output).toContain('Autocomplete');
      expect(output).toContain('Ctrl+C');
      expect(output).toContain('Quit');
    });

    it('should display custom shortcuts', () => {
      const shortcuts: Shortcut[] = [
        { key: 'F1', action: 'Custom help' },
        { key: 'F2', action: 'Custom action' },
      ];

      const { lastFrame } = render(<HelpPanel shortcuts={shortcuts} />);
      const output = lastFrame() ?? '';

      expect(output).toContain('F1');
      expect(output).toContain('Custom help');
      expect(output).toContain('F2');
      expect(output).toContain('Custom action');
    });

    it('should group shortcuts by category', () => {
      const shortcuts: Shortcut[] = [
        { key: 'Ctrl+A', action: 'Action A', category: 'Group1' },
        { key: 'Ctrl+B', action: 'Action B', category: 'Group1' },
        { key: 'Ctrl+C', action: 'Action C', category: 'Group2' },
      ];

      const { lastFrame } = render(<HelpPanel shortcuts={shortcuts} />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Group1');
      expect(output).toContain('Group2');
    });
  });

  describe('Width customization', () => {
    it('should accept custom width', () => {
      // Just verify it renders without error with custom width
      const { lastFrame } = render(<HelpPanel width={80} />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Keyboard Shortcuts');
    });
  });
});

describe('HelpBar', () => {
  it('should render shortcuts in a row', () => {
    const shortcuts: Shortcut[] = [
      { key: 'Tab', action: 'Complete' },
      { key: '?', action: 'Help' },
    ];

    const { lastFrame } = render(<HelpBar shortcuts={shortcuts} />);
    const output = lastFrame() ?? '';

    expect(output).toContain('Tab');
    expect(output).toContain('Complete');
    expect(output).toContain('?');
    expect(output).toContain('Help');
  });

  it('should limit displayed shortcuts', () => {
    const shortcuts: Shortcut[] = [
      { key: 'A', action: 'Action A' },
      { key: 'B', action: 'Action B' },
      { key: 'C', action: 'Action C' },
      { key: 'D', action: 'Action D' },
      { key: 'E', action: 'Action E' },
      { key: 'F', action: 'Action F' },
    ];

    const { lastFrame } = render(<HelpBar shortcuts={shortcuts} maxItems={3} />);
    const output = lastFrame() ?? '';

    expect(output).toContain('A');
    expect(output).toContain('B');
    expect(output).toContain('C');
    expect(output).toContain('more...');
    expect(output).not.toContain('Action F');
  });

  it('should not show more indicator when within limit', () => {
    const shortcuts: Shortcut[] = [{ key: 'Tab', action: 'Complete' }];

    const { lastFrame } = render(<HelpBar shortcuts={shortcuts} maxItems={5} />);
    const output = lastFrame() ?? '';

    expect(output).not.toContain('more...');
  });

  it('should handle empty shortcuts', () => {
    const { lastFrame } = render(<HelpBar shortcuts={[]} />);
    const output = lastFrame() ?? '';

    // Should render without error
    expect(output).toBeDefined();
  });
});

describe('Default exports', () => {
  it('should have default shortcuts defined', () => {
    expect(DEFAULT_SHORTCUTS).toBeDefined();
    expect(DEFAULT_SHORTCUTS.length).toBeGreaterThan(0);
    expect(DEFAULT_SHORTCUTS.some((s) => s.key === 'Tab')).toBe(true);
    expect(DEFAULT_SHORTCUTS.some((s) => s.key === 'Ctrl+C')).toBe(true);
  });

  it('should have default commands defined', () => {
    expect(DEFAULT_COMMANDS).toBeDefined();
    expect(DEFAULT_COMMANDS.length).toBeGreaterThan(0);
    expect(DEFAULT_COMMANDS.some((c) => c.name === 'help')).toBe(true);
    expect(DEFAULT_COMMANDS.some((c) => c.name === 'exit')).toBe(true);
  });

  it('should have categories in default shortcuts', () => {
    const categories = new Set(DEFAULT_SHORTCUTS.map((s) => s.category).filter(Boolean));
    expect(categories.size).toBeGreaterThan(1);
  });

  it('should have aliases in some default commands', () => {
    const hasAliases = DEFAULT_COMMANDS.some((c) => c.aliases && c.aliases.length > 0);
    expect(hasAliases).toBe(true);
  });
});
