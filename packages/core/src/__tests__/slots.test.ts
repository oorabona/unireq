/**
 * @unireq/core - Slots system tests
 */

import { describe, expect, it } from 'vitest';
import { DuplicatePolicyError, InvalidSlotError, MissingCapabilityError } from '../errors.js';
import { getSlotMetadata, hasSlotType, registerSlot, slot, validatePolicyChain } from '../slots.js';
import { type Policy, type SlotMetadata, SlotType } from '../types.js';

// Mock policies
const mockPolicy1: Policy = async (ctx, next) => next(ctx);
const mockPolicy2: Policy = async (ctx, next) => next(ctx);

describe('@unireq/core - registerSlot', () => {
  it('should register slot metadata for a policy', () => {
    const policy: Policy = async (ctx, next) => next(ctx);
    const metadata: SlotMetadata = { type: SlotType.Auth, name: 'bearer' };

    registerSlot(policy, metadata);

    expect(getSlotMetadata(policy)).toEqual(metadata);
  });
});

describe('@unireq/core - getSlotMetadata', () => {
  it('should return undefined for unregistered policy', () => {
    const policy: Policy = async (ctx, next) => next(ctx);

    expect(getSlotMetadata(policy)).toBeUndefined();
  });

  it('should return metadata for registered policy', () => {
    const policy: Policy = async (ctx, next) => next(ctx);
    const metadata: SlotMetadata = { type: SlotType.Parser, name: 'json' };

    registerSlot(policy, metadata);

    expect(getSlotMetadata(policy)).toEqual(metadata);
  });
});

describe('@unireq/core - validatePolicyChain', () => {
  it('should validate empty policy chain', () => {
    expect(() => validatePolicyChain([])).not.toThrow();
  });

  it('should validate chain with no metadata', () => {
    expect(() => validatePolicyChain([mockPolicy1, mockPolicy2])).not.toThrow();
  });

  it('should throw on duplicate slots', () => {
    const policy1: Policy = async (ctx, next) => next(ctx);
    const policy2: Policy = async (ctx, next) => next(ctx);

    registerSlot(policy1, { type: SlotType.Auth, name: 'bearer' });
    registerSlot(policy2, { type: SlotType.Auth, name: 'bearer' });

    expect(() => validatePolicyChain([policy1, policy2])).toThrow(DuplicatePolicyError);
    expect(() => validatePolicyChain([policy1, policy2])).toThrow('Duplicate policy detected: bearer');
  });

  it('should allow different slot types with same name', () => {
    const policy1: Policy = async (ctx, next) => next(ctx);
    const policy2: Policy = async (ctx, next) => next(ctx);

    registerSlot(policy1, { type: SlotType.Auth, name: 'test' });
    registerSlot(policy2, { type: SlotType.Parser, name: 'test' });

    expect(() => validatePolicyChain([policy1, policy2])).not.toThrow();
  });

  it('should throw when required capability is missing', () => {
    const policy: Policy = async (ctx, next) => next(ctx);
    registerSlot(policy, {
      type: SlotType.Transport,
      name: 'http2',
      requiredCapabilities: ['streaming'],
    });

    const capabilities = { streaming: false };

    expect(() => validatePolicyChain([policy], capabilities)).toThrow(MissingCapabilityError);
    expect(() => validatePolicyChain([policy], capabilities)).toThrow(
      'does not support required capability: streaming',
    );
  });

  it('should pass when required capability is present', () => {
    const policy: Policy = async (ctx, next) => next(ctx);
    registerSlot(policy, {
      type: SlotType.Transport,
      name: 'http2',
      requiredCapabilities: ['streaming'],
    });

    const capabilities = { streaming: true };

    expect(() => validatePolicyChain([policy], capabilities)).not.toThrow();
  });

  it('should throw when transport is not last', () => {
    const transportPolicy: Policy = async (ctx, next) => next(ctx);
    const otherPolicy: Policy = async (ctx, next) => next(ctx);

    registerSlot(transportPolicy, { type: SlotType.Transport, name: 'http' });
    registerSlot(otherPolicy, { type: SlotType.Auth, name: 'bearer' }); // Give it metadata so it counts

    expect(() => validatePolicyChain([transportPolicy, otherPolicy])).toThrow(InvalidSlotError);
    expect(() => validatePolicyChain([transportPolicy, otherPolicy])).toThrow('Transport slot must be the last policy');
  });

  it('should pass when transport is last', () => {
    const otherPolicy: Policy = async (ctx, next) => next(ctx);
    const transportPolicy: Policy = async (ctx, next) => next(ctx);

    registerSlot(transportPolicy, { type: SlotType.Transport, name: 'http' });

    expect(() => validatePolicyChain([otherPolicy, transportPolicy])).not.toThrow();
  });

  it('should throw when auth comes after parser', () => {
    const authPolicy: Policy = async (ctx, next) => next(ctx);
    const parserPolicy: Policy = async (ctx, next) => next(ctx);

    registerSlot(authPolicy, { type: SlotType.Auth, name: 'bearer' });
    registerSlot(parserPolicy, { type: SlotType.Parser, name: 'json' });

    expect(() => validatePolicyChain([parserPolicy, authPolicy])).toThrow(InvalidSlotError);
    expect(() => validatePolicyChain([parserPolicy, authPolicy])).toThrow('Auth slot must come before parser slot');
  });

  it('should pass when auth comes before parser', () => {
    const authPolicy: Policy = async (ctx, next) => next(ctx);
    const parserPolicy: Policy = async (ctx, next) => next(ctx);

    registerSlot(authPolicy, { type: SlotType.Auth, name: 'bearer' });
    registerSlot(parserPolicy, { type: SlotType.Parser, name: 'json' });

    expect(() => validatePolicyChain([authPolicy, parserPolicy])).not.toThrow();
  });
});

describe('@unireq/core - slot decorator', () => {
  it('should register metadata and return policy', () => {
    const metadata: SlotMetadata = { type: SlotType.Auth, name: 'bearer' };
    const policy: Policy = async (ctx, next) => next(ctx);

    const decorated = slot(metadata)(policy);

    expect(decorated).toBe(policy);
    expect(getSlotMetadata(decorated)).toEqual(metadata);
  });

  it('should work as decorator', () => {
    const metadata: SlotMetadata = { type: SlotType.Parser, name: 'xml' };

    const decoratedPolicy = slot(metadata)(async (ctx, next) => next(ctx));

    expect(getSlotMetadata(decoratedPolicy)).toEqual(metadata);
  });
});

describe('@unireq/core - hasSlotType', () => {
  it('should return false for unregistered policy', () => {
    const policy: Policy = async (ctx, next) => next(ctx);

    expect(hasSlotType(policy, SlotType.Auth)).toBe(false);
  });

  it('should return true for matching slot type', () => {
    const policy: Policy = async (ctx, next) => next(ctx);
    registerSlot(policy, { type: SlotType.Auth, name: 'bearer' });

    expect(hasSlotType(policy, SlotType.Auth)).toBe(true);
  });

  it('should return false for non-matching slot type', () => {
    const policy: Policy = async (ctx, next) => next(ctx);
    registerSlot(policy, { type: SlotType.Auth, name: 'bearer' });

    expect(hasSlotType(policy, SlotType.Parser)).toBe(false);
  });
});
