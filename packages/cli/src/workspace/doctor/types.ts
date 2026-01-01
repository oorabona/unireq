/**
 * Types for workspace doctor command
 */

/**
 * Severity of a check result
 */
export type CheckSeverity = 'error' | 'warning' | 'info';

/**
 * Result of a single check
 */
export interface CheckResult {
  /** Name of the check */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Severity (error blocks, warning/info don't) */
  severity: CheckSeverity;
  /** Human-readable message */
  message: string;
  /** Optional additional details */
  details?: string;
}

/**
 * Aggregated result of all doctor checks
 */
export interface DoctorResult {
  /** All check results */
  checks: CheckResult[];
  /** Number of errors (blocking) */
  errors: number;
  /** Number of warnings */
  warnings: number;
  /** Number of passing checks */
  passed: number;
  /** Overall pass/fail */
  success: boolean;
}
