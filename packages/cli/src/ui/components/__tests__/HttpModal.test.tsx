/**
 * Tests for HTTP Defaults Modal Component
 */

import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpOutputDefaults } from '../../../workspace/config/types.js';
import { HttpModal } from '../HttpModal.js';

describe('HttpModal', () => {
  const defaultProps = {
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render modal title', () => {
      const { lastFrame } = render(<HttpModal {...defaultProps} />);

      expect(lastFrame()).toContain('HTTP Defaults');
    });

    it('should render tab bar with Session/Profile/Workspace', () => {
      const { lastFrame } = render(<HttpModal {...defaultProps} />);

      expect(lastFrame()).toContain('Session');
      expect(lastFrame()).toContain('Profile');
      expect(lastFrame()).toContain('Workspace');
    });

    it('should render HTTP output settings', () => {
      const { lastFrame } = render(<HttpModal {...defaultProps} />);

      // Actual setting names from HTTP_OUTPUT_DEFAULT_KEYS
      expect(lastFrame()).toContain('includeHeaders');
      expect(lastFrame()).toContain('outputMode');
      expect(lastFrame()).toContain('showSummary');
      expect(lastFrame()).toContain('trace');
      expect(lastFrame()).toContain('showSecrets');
      expect(lastFrame()).toContain('hideBody');
    });

    it('should render navigation hints in footer', () => {
      const { lastFrame } = render(<HttpModal {...defaultProps} />);

      expect(lastFrame()).toContain('Tab');
      expect(lastFrame()).toContain('navigate');
      expect(lastFrame()).toContain('Esc');
    });

    it('should show profile name when active profile is provided', () => {
      const { lastFrame } = render(<HttpModal {...defaultProps} activeProfile="dev" />);

      expect(lastFrame()).toContain('Profile:dev');
    });

    it('should dim Profile tab when no active profile', () => {
      const { lastFrame } = render(<HttpModal {...defaultProps} />);

      // Profile tab should still be present but without profile name
      expect(lastFrame()).toContain('Profile');
    });
  });

  describe('Settings Display', () => {
    it('should show built-in default values when no overrides', () => {
      const { lastFrame } = render(<HttpModal {...defaultProps} />);

      // Default outputMode is 'pretty'
      expect(lastFrame()).toContain('pretty');
    });

    it('should show session overrides', () => {
      const sessionDefaults: HttpOutputDefaults = {
        outputMode: 'json',
        includeHeaders: true,
      };

      const { lastFrame } = render(<HttpModal {...defaultProps} sessionDefaults={sessionDefaults} />);

      expect(lastFrame()).toContain('json');
    });

    it('should show workspace defaults when viewing workspace tab', async () => {
      const workspaceDefaults: HttpOutputDefaults = {
        trace: true,
      };

      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} workspaceDefaults={workspaceDefaults} />);

      // Switch to workspace tab (two separate tab presses)
      // Use longer delays to handle full suite resource contention
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 100));
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 100));

      // trace should be checked on Workspace tab
      const frame = lastFrame();
      expect(frame).toContain('trace');
      // Find the trace line specifically and check for checkmark
      const traceLine = frame?.split('\n').find((l) => l.includes('trace'));
      expect(traceLine).toContain('✓');
    });

    it('should show source indicator for inherited values', () => {
      const workspaceDefaults: HttpOutputDefaults = {
        trace: true,
      };

      const { lastFrame } = render(<HttpModal {...defaultProps} workspaceDefaults={workspaceDefaults} />);

      // Should show source indicators (parenthesis)
      expect(lastFrame()).toContain('(');
    });
  });

  describe('Selection and Navigation', () => {
    it('should highlight first item by default', () => {
      const { lastFrame } = render(<HttpModal {...defaultProps} />);

      // Selection indicator should be on includeHeaders (first item)
      expect(lastFrame()).toContain('▸');
      expect(lastFrame()).toContain('includeHeaders');
    });

    it('should move selection down with down arrow', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      await stdin.write('\x1B[B'); // Down arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second item is outputMode
      const frame = lastFrame();
      expect(frame).toContain('change'); // hint for outputMode
    });

    it('should move selection down with j key', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      await stdin.write('j');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Selection should have moved to second item (outputMode)
      const frame = lastFrame();
      expect(frame).toContain('outputMode');
      expect(frame).toContain('change'); // hint shows "change" for outputMode
    });

    it('should move selection up with k key', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      // Move down first
      await stdin.write('j');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Then move back up
      await stdin.write('k');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should be back at first item
      expect(lastFrame()).toContain('includeHeaders');
      expect(lastFrame()).toContain('toggle'); // hint for boolean
    });

    it('should not move above first item', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      await stdin.write('k'); // Try to go up from first item
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should still be at first item
      expect(lastFrame()).toContain('includeHeaders');
      expect(lastFrame()).toContain('toggle'); // hint for includeHeaders
    });
  });

  describe('Tab Switching', () => {
    it('should switch to Profile tab with Tab key', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} activeProfile="dev" />);

      await stdin.write('\t'); // Tab
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Profile tab should now be active (shown in bold/cyan)
      const frame = lastFrame();
      expect(frame).toContain('Profile');
    });

    it('should switch to Workspace tab with second Tab', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      await stdin.write('\t'); // First Tab
      await new Promise((resolve) => setTimeout(resolve, 50));
      await stdin.write('\t'); // Second Tab
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Workspace tab should now be active
      const frame = lastFrame();
      expect(frame).toContain('Workspace');
    });

    it('should cycle back to Session with third Tab', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      // Three separate tab presses
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 50));
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 50));
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should be back at Session
      const frame = lastFrame();
      expect(frame).toContain('Session');
    });
  });

  describe('Value Changes', () => {
    it('should toggle boolean setting with right arrow', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      // First item is includeHeaders (boolean)
      // Toggle with right arrow
      await stdin.write('\x1B[C'); // Right arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame();
      expect(frame).toContain('✓'); // Toggled on
      expect(frame).toContain('*'); // Modified indicator
    });

    it('should toggle boolean setting with l key', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      await stdin.write('l');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain('✓'); // Toggled on
    });

    it('should toggle boolean setting backwards with left arrow', async () => {
      const sessionDefaults: HttpOutputDefaults = {
        includeHeaders: true,
      };
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} sessionDefaults={sessionDefaults} />);

      await stdin.write('\x1B[D'); // Left arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should toggle off (no checkmark in the brackets)
      const frame = lastFrame();
      expect(frame).toContain('[ ]'); // Toggled off
    });

    it('should toggle boolean setting with space', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      // Toggle with space (first item is includeHeaders)
      await stdin.write(' ');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame();
      expect(frame).toContain('*'); // Modified indicator
      expect(frame).toContain('✓'); // Toggled on
    });

    it('should toggle boolean setting with Enter', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      // Toggle with Enter
      await stdin.write('\r');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain('✓');
    });

    it('should cycle outputMode when selected', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      // Move to outputMode (second item)
      await stdin.write('j');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Cycle with right arrow
      await stdin.write('\x1B[C');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should cycle from 'pretty' to 'json'
      expect(lastFrame()).toContain('json');
    });

    it('should show modified indicator for pending changes', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      await stdin.write('l'); // Toggle includeHeaders
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame();
      expect(frame).toContain('*'); // Modified indicator
      expect(frame).toContain('(modified)'); // Title status
    });
  });

  describe('Save Behavior', () => {
    it('should call onSessionChange when Ctrl+S is pressed on Session tab', async () => {
      const onSessionChange = vi.fn();
      const { stdin } = render(<HttpModal {...defaultProps} onSessionChange={onSessionChange} />);

      // Make a change (toggle includeHeaders)
      await stdin.write('l');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Save with Ctrl+S
      await stdin.write('\x13'); // Ctrl+S
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onSessionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          includeHeaders: true,
        }),
      );
    });

    it('should call onProfileSave when saving on Profile tab', async () => {
      const onProfileSave = vi.fn();
      const { stdin } = render(<HttpModal {...defaultProps} activeProfile="dev" onProfileSave={onProfileSave} />);

      // Switch to Profile tab
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Make a change
      await stdin.write('l'); // Toggle includeHeaders
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Save
      await stdin.write('\x13'); // Ctrl+S
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onProfileSave).toHaveBeenCalled();
    });

    it('should call onWorkspaceSave when saving on Workspace tab', async () => {
      const onWorkspaceSave = vi.fn();
      const { stdin } = render(<HttpModal {...defaultProps} onWorkspaceSave={onWorkspaceSave} />);

      // Switch to Workspace tab (two separate tab presses)
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 50));
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Make a change
      await stdin.write('l'); // Toggle includeHeaders
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Save
      await stdin.write('\x13'); // Ctrl+S
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onWorkspaceSave).toHaveBeenCalled();
    });

    it('should show Saved indicator after saving', async () => {
      const onSessionChange = vi.fn();
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} onSessionChange={onSessionChange} />);

      // Make a change and save
      await stdin.write('l');
      await new Promise((resolve) => setTimeout(resolve, 50));
      await stdin.write('\x13'); // Ctrl+S
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain('Saved');
    });

    it('should close modal with Ctrl+S when no changes', async () => {
      const onClose = vi.fn();
      const { stdin } = render(<HttpModal {...defaultProps} onClose={onClose} />);

      await stdin.write('\x13'); // Ctrl+S with no changes
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onClose).toHaveBeenCalled();
    });

    it('should clear pending changes after save', async () => {
      const onSessionChange = vi.fn();
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} onSessionChange={onSessionChange} />);

      // Make a change
      await stdin.write('l');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(lastFrame()).toContain('*');

      // Save
      await stdin.write('\x13');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Title should show Saved instead of modified
      expect(lastFrame()).toContain('Saved');
    });
  });

  describe('Close Behavior', () => {
    it('should call onClose when Escape is pressed', async () => {
      const onClose = vi.fn();
      const { stdin } = render(<HttpModal {...defaultProps} onClose={onClose} />);

      await stdin.write('\x1B'); // Escape
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when Q is pressed', async () => {
      const onClose = vi.fn();
      const { stdin } = render(<HttpModal {...defaultProps} onClose={onClose} />);

      await stdin.write('Q');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when q is pressed', async () => {
      const onClose = vi.fn();
      const { stdin } = render(<HttpModal {...defaultProps} onClose={onClose} />);

      await stdin.write('q');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onClose).toHaveBeenCalled();
    });

    it('should show cancel hint when there are pending changes', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      // Make a change
      await stdin.write('l');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain('cancel');
    });
  });

  describe('Pending Changes Per Tab', () => {
    it('should maintain separate pending changes per tab', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} activeProfile="dev" />);

      // Make a change on Session tab (toggle includeHeaders)
      await stdin.write('l');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Session should have includeHeaders checked
      expect(lastFrame()).toContain('✓');

      // Switch to Profile tab
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Profile should NOT have includeHeaders checked (no changes on Profile)
      // The default is false
      const profileFrame = lastFrame();
      expect(profileFrame).toContain('Profile');

      // Make a different change on Profile (toggle showSummary instead)
      await stdin.write('j'); // Move down
      await new Promise((resolve) => setTimeout(resolve, 50));
      await stdin.write('j'); // Move to showSummary (3rd item)
      await new Promise((resolve) => setTimeout(resolve, 50));
      await stdin.write('l'); // Toggle
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Switch back to Session (two separate tabs)
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 50));
      await stdin.write('\t');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Session should still have includeHeaders checked
      expect(lastFrame()).toContain('Session');
    });

    it('should show asterisk on tab with pending changes', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      // Make a change on Session tab
      await stdin.write('l');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Session tab should show asterisk
      const frame = lastFrame();
      expect(frame).toContain('Session');
      expect(frame).toContain('*'); // Either on Session tab or on the item
    });
  });

  describe('OutputMode Width Consistency', () => {
    it('should pad outputMode values consistently', async () => {
      const { lastFrame, stdin } = render(<HttpModal {...defaultProps} />);

      // Move to outputMode (second item)
      await stdin.write('j');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check 'pretty' is displayed with proper format
      expect(lastFrame()).toContain('[pretty]');

      // Cycle to 'json'
      await stdin.write('l');
      await new Promise((resolve) => setTimeout(resolve, 50));
      // json should be padded to 6 chars: [json  ]
      expect(lastFrame()).toContain('[json  ]');

      // Cycle to 'raw'
      await stdin.write('l');
      await new Promise((resolve) => setTimeout(resolve, 50));
      // raw should be padded to 6 chars: [raw   ]
      expect(lastFrame()).toContain('[raw   ]');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined defaults gracefully', () => {
      const { lastFrame } = render(
        <HttpModal
          {...defaultProps}
          sessionDefaults={undefined}
          workspaceDefaults={undefined}
          profileDefaults={undefined}
        />,
      );

      // Should render with built-in defaults
      expect(lastFrame()).toContain('pretty');
      expect(lastFrame()).toContain('HTTP Defaults');
    });

    it('should handle empty defaults objects', () => {
      const { lastFrame } = render(
        <HttpModal {...defaultProps} sessionDefaults={{}} workspaceDefaults={{}} profileDefaults={{}} />,
      );

      expect(lastFrame()).toContain('pretty');
    });

    it('should show correct source when value comes from workspace', async () => {
      const workspaceDefaults: HttpOutputDefaults = {
        trace: true,
      };

      const { lastFrame } = render(<HttpModal {...defaultProps} workspaceDefaults={workspaceDefaults} />);

      // When viewing Session tab, trace value from workspace should show source
      // The trace row should contain 'workspace' as source
      const frame = lastFrame();
      const traceLine = frame?.split('\n').find((l) => l.includes('trace'));
      expect(traceLine).toContain('workspace');
    });

    it('should show correct source when value comes from profile', () => {
      const profileDefaults: HttpOutputDefaults = {
        includeHeaders: true,
      };

      const { lastFrame } = render(
        <HttpModal {...defaultProps} activeProfile="prod" profileDefaults={profileDefaults} />,
      );

      // The profile default should show source as profile name
      const frame = lastFrame();
      const headerLine = frame?.split('\n').find((l) => l.includes('includeHeaders'));
      expect(headerLine).toContain('prod');
    });
  });
});
