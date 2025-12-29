/**
 * Slot system for transport, auth, and parser policies
 * Provides compile-time and runtime checks for capability requirements
 */

import { DuplicatePolicyError, InvalidSlotError, MissingCapabilityError } from './errors.js';
import type { Policy, SlotMetadata, SlotType, TransportCapabilities } from './types.js';

/** Registry for slot metadata */
const slotRegistry = new WeakMap<Policy, SlotMetadata>();

/**
 * Registers slot metadata for a policy
 * @param policy - The policy to register
 * @param metadata - Slot metadata
 */
export function registerSlot(policy: Policy, metadata: SlotMetadata): void {
  slotRegistry.set(policy, metadata);
}

/**
 * Gets slot metadata for a policy
 * @param policy - The policy to query
 * @returns Slot metadata or undefined
 */
export function getSlotMetadata(policy: Policy): SlotMetadata | undefined {
  return slotRegistry.get(policy);
}

/**
 * Validates a policy chain for slot conflicts and capability requirements
 * @param policies - Array of policies to validate
 * @param transportCapabilities - Transport capabilities
 * @throws {DuplicatePolicyError} If duplicate slots detected
 * @throws {MissingCapabilityError} If required capabilities missing
 * @throws {InvalidSlotError} If slot configuration is invalid
 */
export function validatePolicyChain(
  policies: ReadonlyArray<Policy>,
  transportCapabilities?: TransportCapabilities,
): void {
  const seenSlots = new Map<string, SlotMetadata>();

  for (const policy of policies) {
    const metadata = getSlotMetadata(policy);
    if (!metadata) continue;

    // Check for duplicate slots of the same type
    const slotKey = `${metadata.type}:${metadata.name}`;
    const existing = seenSlots.get(slotKey);
    if (existing) {
      throw new DuplicatePolicyError(metadata.name);
    }
    seenSlots.set(slotKey, metadata);

    // Validate required capabilities
    if (transportCapabilities && metadata.requiredCapabilities) {
      for (const capability of metadata.requiredCapabilities) {
        if (!transportCapabilities[capability]) {
          throw new MissingCapabilityError(capability, 'current');
        }
      }
    }
  }

  // Validate slot ordering constraints
  validateSlotOrdering(Array.from(seenSlots.values()));
}

/**
 * Validates slot ordering (e.g., auth before parser)
 * @param slots - Array of slot metadata
 * @throws {InvalidSlotError} If ordering is invalid
 */
function validateSlotOrdering(slots: ReadonlyArray<SlotMetadata>): void {
  let transportIndex = -1;
  let authIndex = -1;
  let parserIndex = -1;

  slots.forEach((slot, i) => {
    switch (slot.type) {
      case 'transport':
        transportIndex = i;
        break;
      case 'auth':
        authIndex = i;
        break;
      case 'parser':
        parserIndex = i;
        break;
    }
  });

  // Transport should be last (if present)
  if (transportIndex !== -1 && transportIndex !== slots.length - 1) {
    throw new InvalidSlotError('transport', 'Transport slot must be the last policy in the chain');
  }

  // Auth should come before parser (if both present)
  if (authIndex !== -1 && parserIndex !== -1 && authIndex > parserIndex) {
    throw new InvalidSlotError('auth', 'Auth slot must come before parser slot in the chain');
  }
}

/**
 * Creates a slot decorator for policies
 * @param metadata - Slot metadata
 * @returns Decorator function
 */
export function slot(metadata: SlotMetadata) {
  return (policy: Policy): Policy => {
    registerSlot(policy, metadata);
    return policy;
  };
}

/**
 * Checks if a policy has a specific slot type
 * @param policy - The policy to check
 * @param type - The slot type to match
 * @returns True if policy has the slot type
 */
export function hasSlotType(policy: Policy, type: SlotType): boolean {
  const metadata = getSlotMetadata(policy);
  return metadata?.type === type;
}
