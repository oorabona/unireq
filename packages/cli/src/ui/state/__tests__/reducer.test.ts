/**
 * Tests for Ink UI state reducer
 */

import { describe, expect, it } from 'vitest';
import { type InkAction, inkReducer } from '../reducer.js';
import { defaultInkAppState, type InkAppState, type ResultContent } from '../types.js';

describe('inkReducer', () => {
  describe('ADD_TRANSCRIPT', () => {
    it('should add a command event to transcript', () => {
      // Given empty transcript
      const state: InkAppState = { ...defaultInkAppState };

      // When adding a command event
      const action: InkAction = {
        type: 'ADD_TRANSCRIPT',
        event: { type: 'command', content: 'get /users' },
      };
      const newState = inkReducer(state, action);

      // Then transcript contains the event
      expect(newState.transcript).toHaveLength(1);
      expect(newState.transcript[0]?.type).toBe('command');
      expect(newState.transcript[0]?.content).toBe('get /users');
      expect(newState.transcript[0]?.id).toMatch(/^evt-\d+-/);
      expect(newState.transcript[0]?.timestamp).toBeInstanceOf(Date);
    });

    it('should add a result event with ResultContent', () => {
      const state: InkAppState = { ...defaultInkAppState };

      const resultContent: ResultContent = {
        status: 200,
        statusText: 'OK',
        timing: 142,
        size: 1024,
        bodyPreview: '{"users": [...]}',
        bodyFull: '{"users": [{"id": 1, "name": "Alice"}]}',
      };

      const action: InkAction = {
        type: 'ADD_TRANSCRIPT',
        event: { type: 'result', content: resultContent },
      };
      const newState = inkReducer(state, action);

      expect(newState.transcript).toHaveLength(1);
      expect(newState.transcript[0]?.type).toBe('result');
      expect(newState.transcript[0]?.content).toEqual(resultContent);
    });

    it('should trim old events when exceeding max limit', () => {
      // Given transcript at max capacity
      const events = Array.from({ length: 500 }, (_, i) => ({
        id: `evt-${i}`,
        timestamp: new Date(),
        type: 'command' as const,
        content: `command-${i}`,
      }));
      const state: InkAppState = { ...defaultInkAppState, transcript: events };

      // When adding a new event
      const action: InkAction = {
        type: 'ADD_TRANSCRIPT',
        event: { type: 'command', content: 'new-command' },
      };
      const newState = inkReducer(state, action);

      // Then oldest event is removed
      expect(newState.transcript).toHaveLength(500);
      expect(newState.transcript[0]?.content).toBe('command-1');
      expect(newState.transcript[499]?.content).toBe('new-command');
    });
  });

  describe('SET_LAST_RESPONSE', () => {
    it('should set last response', () => {
      const state: InkAppState = { ...defaultInkAppState };

      const action: InkAction = {
        type: 'SET_LAST_RESPONSE',
        response: {
          status: 200,
          statusText: 'OK',
          headers: {},
          body: '{"ok": true}',
          timing: 100,
          size: 12,
        },
      };
      const newState = inkReducer(state, action);

      expect(newState.lastResponse?.status).toBe(200);
      expect(newState.lastResponse?.timing).toBe(100);
    });
  });

  describe('CLEAR_LAST_RESPONSE', () => {
    it('should clear last response', () => {
      const state: InkAppState = {
        ...defaultInkAppState,
        lastResponse: {
          status: 200,
          statusText: 'OK',
          headers: {},
          body: '',
          timing: 0,
          size: 0,
        },
      };

      const newState = inkReducer(state, { type: 'CLEAR_LAST_RESPONSE' });

      expect(newState.lastResponse).toBeUndefined();
    });
  });

  describe('SET_INPUT', () => {
    it('should update input value', () => {
      const state: InkAppState = { ...defaultInkAppState };

      const newState = inkReducer(state, { type: 'SET_INPUT', value: 'get /users' });

      expect(newState.inputValue).toBe('get /users');
    });
  });

  describe('SET_CURRENT_PATH', () => {
    it('should update current path', () => {
      const state: InkAppState = { ...defaultInkAppState };

      const newState = inkReducer(state, { type: 'SET_CURRENT_PATH', path: '/users' });

      expect(newState.currentPath).toBe('/users');
    });
  });

  describe('SET_AUTOCOMPLETE_ITEMS', () => {
    it('should set items and show popup when items exist', () => {
      const state: InkAppState = { ...defaultInkAppState };

      const newState = inkReducer(state, {
        type: 'SET_AUTOCOMPLETE_ITEMS',
        items: ['/users', '/users/{id}'],
      });

      expect(newState.autocompleteItems).toEqual(['/users', '/users/{id}']);
      expect(newState.autocompleteVisible).toBe(true);
      expect(newState.selectedAutocompleteIndex).toBe(0);
    });

    it('should hide popup when items are empty', () => {
      const state: InkAppState = { ...defaultInkAppState, autocompleteVisible: true };

      const newState = inkReducer(state, { type: 'SET_AUTOCOMPLETE_ITEMS', items: [] });

      expect(newState.autocompleteVisible).toBe(false);
    });
  });

  describe('SET_AUTOCOMPLETE_INDEX', () => {
    it('should clamp index within bounds', () => {
      const state: InkAppState = {
        ...defaultInkAppState,
        autocompleteItems: ['/a', '/b', '/c'],
      };

      // Try to go beyond max
      let newState = inkReducer(state, { type: 'SET_AUTOCOMPLETE_INDEX', index: 10 });
      expect(newState.selectedAutocompleteIndex).toBe(2);

      // Try to go below 0
      newState = inkReducer(state, { type: 'SET_AUTOCOMPLETE_INDEX', index: -5 });
      expect(newState.selectedAutocompleteIndex).toBe(0);
    });
  });

  describe('Modal toggles', () => {
    it('TOGGLE_INSPECTOR should toggle and close other modals', () => {
      const state: InkAppState = { ...defaultInkAppState, helpOpen: true };

      const newState = inkReducer(state, { type: 'TOGGLE_INSPECTOR' });

      expect(newState.inspectorOpen).toBe(true);
      expect(newState.helpOpen).toBe(false);
    });

    it('TOGGLE_HISTORY_PICKER should toggle and close other modals', () => {
      const state: InkAppState = { ...defaultInkAppState, inspectorOpen: true };

      const newState = inkReducer(state, { type: 'TOGGLE_HISTORY_PICKER' });

      expect(newState.historyPickerOpen).toBe(true);
      expect(newState.inspectorOpen).toBe(false);
    });

    it('TOGGLE_HELP should toggle and close other modals', () => {
      const state: InkAppState = { ...defaultInkAppState, historyPickerOpen: true };

      const newState = inkReducer(state, { type: 'TOGGLE_HELP' });

      expect(newState.helpOpen).toBe(true);
      expect(newState.historyPickerOpen).toBe(false);
    });

    it('CLOSE_ALL_MODALS should close everything', () => {
      const state: InkAppState = {
        ...defaultInkAppState,
        inspectorOpen: true,
        historyPickerOpen: true,
        helpOpen: true,
      };

      const newState = inkReducer(state, { type: 'CLOSE_ALL_MODALS' });

      expect(newState.inspectorOpen).toBe(false);
      expect(newState.historyPickerOpen).toBe(false);
      expect(newState.helpOpen).toBe(false);
    });
  });

  describe('CLEAR_TRANSCRIPT', () => {
    it('should empty the transcript', () => {
      const state: InkAppState = {
        ...defaultInkAppState,
        transcript: [{ id: '1', timestamp: new Date(), type: 'command', content: 'test' }],
      };

      const newState = inkReducer(state, { type: 'CLEAR_TRANSCRIPT' });

      expect(newState.transcript).toEqual([]);
    });
  });
});
