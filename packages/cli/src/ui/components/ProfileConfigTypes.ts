/**
 * Shared types for ProfileConfigModal and its sub-components/hooks
 */

import type { CursorSettings } from '../state/types.js';

/**
 * Profile configuration data
 */
export interface ProfileConfigData {
  /** Profile name */
  name: string;
  /** Base URL */
  baseUrl: string;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** TLS verification */
  verifyTls: boolean;
  /** Headers */
  headers: Record<string, string>;
  /** Variables */
  vars: Record<string, string>;
}

/**
 * Pending changes to be committed
 */
export interface PendingChanges {
  baseUrl?: string;
  timeoutMs?: number;
  verifyTls?: boolean;
  headers: Record<string, string>;
  vars: Record<string, string>;
  deletedHeaders: Set<string>;
  deletedVars: Set<string>;
}

/**
 * Key-value item for headers/variables tabs
 */
export interface KeyValueItem {
  key: string;
  value: string;
  isAddNew: boolean;
}

/**
 * Tab definitions
 */
export type TabId = 'connection' | 'headers' | 'variables';

export interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

export const TABS: TabDef[] = [
  { id: 'connection', label: 'Connection', icon: '🔗' },
  { id: 'headers', label: 'Headers', icon: '📋' },
  { id: 'variables', label: 'Variables', icon: '📦' },
];

/**
 * Connection tab field types
 */
export interface ConnectionField {
  id: string;
  label: string;
  type: 'editable' | 'toggle';
}

export const CONNECTION_FIELDS: ConnectionField[] = [
  { id: 'base-url', label: 'Base URL', type: 'editable' },
  { id: 'timeout', label: 'Timeout', type: 'editable' },
  { id: 'verify-tls', label: 'Verify TLS', type: 'toggle' },
];

/**
 * Props for ProfileConfigModal component
 */
export interface ProfileConfigModalProps {
  /** Profile configuration to edit */
  profile: ProfileConfigData;
  /** Callback when modal should close (without saving) */
  onClose: () => void;
  /** Callback when a value is saved */
  onSave: (key: string, value: string) => void;
  /** Callback when an item is deleted */
  onDelete?: (key: string) => void;
  /** Cursor display settings */
  cursorSettings?: CursorSettings;
}

/**
 * Create initial pending changes state
 */
export function createInitialPendingChanges(profile: ProfileConfigData): PendingChanges {
  return {
    headers: { ...profile.headers },
    vars: { ...profile.vars },
    deletedHeaders: new Set(),
    deletedVars: new Set(),
  };
}
