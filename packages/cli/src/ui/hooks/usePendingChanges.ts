/**
 * Hook for managing pending (uncommitted) changes to a profile configuration.
 *
 * Tracks local edits and computes whether changes exist relative to the
 * last-saved baseline. Changes are only persisted when commitChanges() is called.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  createInitialPendingChanges,
  type PendingChanges,
  type ProfileConfigData,
} from '../components/ProfileConfigTypes.js';

export interface UsePendingChangesResult {
  pending: PendingChanges;
  setPending: React.Dispatch<React.SetStateAction<PendingChanges>>;
  baseline: ProfileConfigData;
  setBaseline: React.Dispatch<React.SetStateAction<ProfileConfigData>>;
  hasChanges: boolean;
  /** Reset pending to a clean state matching the current effective values, after a save */
  resetBaseline: (newBaseline: ProfileConfigData) => void;
}

export function usePendingChanges(profile: ProfileConfigData): UsePendingChangesResult {
  const [pending, setPending] = useState<PendingChanges>(() => createInitialPendingChanges(profile));
  const [baseline, setBaseline] = useState<ProfileConfigData>(profile);

  const hasChanges = useMemo(() => {
    return (
      pending.baseUrl !== undefined ||
      pending.timeoutMs !== undefined ||
      pending.verifyTls !== undefined ||
      pending.deletedHeaders.size > 0 ||
      pending.deletedVars.size > 0 ||
      Object.keys(pending.headers).length !== Object.keys(baseline.headers).length ||
      Object.entries(pending.headers).some(([k, v]) => baseline.headers[k] !== v) ||
      Object.keys(pending.vars).length !== Object.keys(baseline.vars).length ||
      Object.entries(pending.vars).some(([k, v]) => baseline.vars[k] !== v)
    );
  }, [pending, baseline]);

  const resetBaseline = useCallback((newBaseline: ProfileConfigData) => {
    setBaseline(newBaseline);
    setPending({
      headers: { ...newBaseline.headers },
      vars: { ...newBaseline.vars },
      deletedHeaders: new Set(),
      deletedVars: new Set(),
    });
  }, []);

  return { pending, setPending, baseline, setBaseline, hasChanges, resetBaseline };
}
