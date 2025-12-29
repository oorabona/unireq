import { describe, expect, it } from 'vitest';
import { compose } from '../compose.js';
import { inspect } from '../inspect.js';
import { policy } from '../introspection.js';

describe('inspect edge cases', () => {
  it('should handle function values in options', () => {
    const fn = () => 'test';
    const p = policy(async (ctx, next) => next(ctx), {
      name: 'test',
      kind: 'other',
      options: { fn },
    });

    const result = inspect.tree(compose(p));
    // The function should be stringified
    expect(result).toContain('fn=');
  });
});
