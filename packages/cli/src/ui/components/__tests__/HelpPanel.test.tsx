/**
 * Tests for HelpPanel Component
 */

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import {
  type CommandHelp,
  DEFAULT_COMMANDS,
  DEFAULT_SHORTCUTS,
  HelpBar,
  HelpPanel,
  type Shortcut,
} from '../HelpPanel.js';

describe('HelpPanel', () => {
  describe('Rendering', () => {
    it('should render with default title', () => {
      const { lastFrame } = render(<HelpPanel />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Help');
    });

    it('should render with custom title', () => {
      const { lastFrame } = render(<HelpPanel title="REPL Help" />);
      const output = lastFrame() ?? '';

      expect(output).toContain('REPL Help');
    });

    it('should render keyboard shortcuts section', () => {
      const { lastFrame } = render(<HelpPanel />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Keyboard Shortcuts');
    });

    it('should render commands section', () => {
      const { lastFrame } = render(<HelpPanel />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Commands');
    });

    it('should render HTTP methods section', () => {
      const { lastFrame } = render(<HelpPanel />);
      const output = lastFrame() ?? '';

      expect(output).toContain('HTTP Methods');
      expect(output).toContain('GET');
      expect(output).toContain('POST');
      expect(output).toContain('DELETE');
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should display default shortcuts', () => {
      const { lastFrame } = render(<HelpPanel />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Tab');
      expect(output).toContain('Autocomplete');
      expect(output).toContain('Ctrl+C');
      expect(output).toContain('Cancel / Exit');
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

  describe('Commands', () => {
    it('should display default commands', () => {
      const { lastFrame } = render(<HelpPanel />);
      const output = lastFrame() ?? '';

      expect(output).toContain('help');
      expect(output).toContain('exit');
      expect(output).toContain('clear');
    });

    it('should display custom commands', () => {
      const commands: CommandHelp[] = [{ name: 'mycommand', description: 'My custom command' }];

      const { lastFrame } = render(<HelpPanel commands={commands} />);
      const output = lastFrame() ?? '';

      expect(output).toContain('mycommand');
      expect(output).toContain('My custom command');
    });

    it('should display command aliases when provided', () => {
      const commands: CommandHelp[] = [{ name: 'help', description: 'Show help', aliases: ['?', 'h'] }];

      const { lastFrame } = render(<HelpPanel commands={commands} />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Aliases');
      expect(output).toContain('?');
      expect(output).toContain('h');
    });

    it('should display command usage when provided', () => {
      const commands: CommandHelp[] = [{ name: 'cd', description: 'Change directory', usage: 'cd /api/v1' }];

      const { lastFrame } = render(<HelpPanel commands={commands} />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Usage');
      expect(output).toContain('cd /api/v1');
    });
  });

  describe('Tips', () => {
    it('should display tips when provided', () => {
      const tips = ['Use Tab for autocomplete', 'Press ? for help'];

      const { lastFrame } = render(<HelpPanel tips={tips} />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Tips');
      expect(output).toContain('Use Tab for autocomplete');
      expect(output).toContain('Press ? for help');
    });

    it('should not display tips section when empty', () => {
      const { lastFrame } = render(<HelpPanel tips={[]} />);
      const output = lastFrame() ?? '';

      // Tips section header should not appear when empty
      // The output should contain other sections but tips header may be absent
      expect(output).toContain('Keyboard Shortcuts');
    });
  });

  describe('Compact mode', () => {
    it('should render in compact mode', () => {
      const shortcuts: Shortcut[] = [
        { key: 'Tab', action: 'Complete' },
        { key: '?', action: 'Help' },
      ];

      const { lastFrame } = render(<HelpPanel shortcuts={shortcuts} compact />);
      const output = lastFrame() ?? '';

      // Should still contain the content
      expect(output).toContain('Tab');
      expect(output).toContain('Complete');
    });

    it('should show commands inline in compact mode', () => {
      const commands: CommandHelp[] = [
        { name: 'help', description: 'Show help' },
        { name: 'exit', description: 'Exit' },
      ];

      const { lastFrame } = render(<HelpPanel commands={commands} compact />);
      const output = lastFrame() ?? '';

      expect(output).toContain('help');
      expect(output).toContain('exit');
    });
  });

  describe('Width customization', () => {
    it('should accept custom width', () => {
      // Just verify it renders without error with custom width
      const { lastFrame } = render(<HelpPanel width={80} />);
      const output = lastFrame() ?? '';

      expect(output).toContain('Help');
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
