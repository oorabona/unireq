/**
 * Ink UI State Context
 *
 * Provides React context for sharing state across Ink components.
 */

import React from 'react';

// React is needed for JSX transformation with tsx
void React;

import { createContext, type ReactNode, useContext, useReducer } from 'react';
import { type InkAction, inkReducer } from './reducer.js';
import { defaultInkAppState, type InkAppState } from './types.js';

/**
 * Context value type
 */
interface InkStateContextValue {
  /** Current application state */
  state: InkAppState;
  /** Dispatch function to update state */
  dispatch: React.Dispatch<InkAction>;
}

/**
 * React context for Ink application state
 */
const InkStateContext = createContext<InkStateContextValue | null>(null);

/**
 * Props for the state provider
 */
interface InkStateProviderProps {
  /** Initial state (from ReplState) */
  initialState?: Partial<InkAppState>;
  /** Child components */
  children: ReactNode;
}

/**
 * Provider component for Ink application state
 *
 * Wraps the application and provides state + dispatch to all children.
 */
export function InkStateProvider({ initialState, children }: InkStateProviderProps): ReactNode {
  const mergedInitialState: InkAppState = {
    ...defaultInkAppState,
    ...initialState,
  };

  const [state, dispatch] = useReducer(inkReducer, mergedInitialState);

  return <InkStateContext.Provider value={{ state, dispatch }}>{children}</InkStateContext.Provider>;
}

/**
 * Hook to access Ink application state
 *
 * @returns Object with state and dispatch
 * @throws Error if used outside of InkStateProvider
 */
export function useInkState(): InkStateContextValue {
  const context = useContext(InkStateContext);

  if (!context) {
    throw new Error('useInkState must be used within an InkStateProvider');
  }

  return context;
}
