/**
 * Profile management module (kubectl-inspired model)
 */

export {
  createDefaultProfile,
  getDefaultProfileName,
  listProfiles,
  profileExists,
  type ResolvedProfile,
  resolveActiveProfile,
  resolveProfile,
} from './resolver.js';
