import { describe, expect, it } from 'vitest';
import { err, fromPromise, fromTry, isErr, isOk, ok, type Result } from '../result.js';

describe('Result type', () => {
  describe('ok()', () => {
    it('creates an Ok result with the value', () => {
      const result = ok(42);
      expect(result._tag).toBe('Ok');
      expect(result.unwrap()).toBe(42);
    });

    it('works with complex objects', () => {
      const user = { id: 1, name: 'Alice' };
      const result = ok(user);
      expect(result.unwrap()).toEqual(user);
    });
  });

  describe('err()', () => {
    it('creates an Err result with the error', () => {
      const error = new Error('Not found');
      const result = err(error);
      expect(result._tag).toBe('Err');
      expect(result.unwrapErr()).toBe(error);
    });

    it('works with string errors', () => {
      const result = err('Something went wrong');
      expect(result.unwrapErr()).toBe('Something went wrong');
    });
  });

  describe('isOk()', () => {
    it('returns true for Ok results', () => {
      const result = ok(42);
      expect(result.isOk()).toBe(true);
      expect(isOk(result)).toBe(true);
    });

    it('returns false for Err results', () => {
      const result = err(new Error('fail'));
      expect(result.isOk()).toBe(false);
      expect(isOk(result)).toBe(false);
    });
  });

  describe('isErr()', () => {
    it('returns true for Err results', () => {
      const result = err(new Error('fail'));
      expect(result.isErr()).toBe(true);
      expect(isErr(result)).toBe(true);
    });

    it('returns false for Ok results', () => {
      const result = ok(42);
      expect(result.isErr()).toBe(false);
      expect(isErr(result)).toBe(false);
    });
  });

  describe('map()', () => {
    it('transforms Ok value', () => {
      const result = ok(5).map((x) => x * 2);
      expect(result.unwrap()).toBe(10);
    });

    it('chains multiple maps', () => {
      const result = ok('hello')
        .map((s) => s.toUpperCase())
        .map((s) => s.length);
      expect(result.unwrap()).toBe(5);
    });

    it('is a no-op for Err', () => {
      const error = new Error('fail');
      const result = err<number, Error>(error).map((x) => x * 2);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(error);
    });

    it('never calls fn for Err', () => {
      let called = false;
      err<number, Error>(new Error('fail')).map(() => {
        called = true;
        return 0;
      });
      expect(called).toBe(false);
    });
  });

  describe('flatMap()', () => {
    const divide = (a: number, b: number): Result<number, string> => {
      if (b === 0) return err('Division by zero');
      return ok(a / b);
    };

    it('chains operations that return Result', () => {
      const result = ok<number, string>(10).flatMap((x) => divide(x, 2));
      expect(result.unwrap()).toBe(5);
    });

    it('short-circuits on first Err', () => {
      const result = ok<number, string>(10)
        .flatMap((x) => divide(x, 0))
        .flatMap((x) => ok(x + 1));
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('Division by zero');
    });

    it('is a no-op for initial Err', () => {
      const result = err<number, string>('initial error').flatMap((x: number) => ok(x * 2));
      expect(result.unwrapErr()).toBe('initial error');
    });
  });

  describe('unwrap()', () => {
    it('returns value for Ok', () => {
      const result = ok({ name: 'Alice' });
      expect(result.unwrap()).toEqual({ name: 'Alice' });
    });

    it('throws error for Err', () => {
      const error = new Error('Not found');
      const result = err(error);
      expect(() => result.unwrap()).toThrow(error);
    });

    it('throws the actual error value', () => {
      const result = err('string error');
      expect(() => result.unwrap()).toThrow('string error');
    });
  });

  describe('unwrapOr()', () => {
    it('returns value for Ok', () => {
      const result = ok(42);
      expect(result.unwrapOr(0)).toBe(42);
    });

    it('returns fallback for Err', () => {
      const result = err<number, string>('fail');
      expect(result.unwrapOr(0)).toBe(0);
    });
  });

  describe('unwrapErr()', () => {
    it('returns error for Err', () => {
      const error = new Error('fail');
      const result = err(error);
      expect(result.unwrapErr()).toBe(error);
    });

    it('throws for Ok', () => {
      const result = ok(42);
      expect(() => result.unwrapErr()).toThrow('Called unwrapErr on Ok value');
    });
  });

  describe('match()', () => {
    it('calls ok branch for Ok result', () => {
      const result = ok(42);
      const output = result.match({
        ok: (v) => `Value is ${v}`,
        err: (e) => `Error: ${e}`,
      });
      expect(output).toBe('Value is 42');
    });

    it('calls err branch for Err result', () => {
      const result = err<number, string>('not found');
      const output = result.match({
        ok: (v) => `Value is ${v}`,
        err: (e) => `Error: ${e}`,
      });
      expect(output).toBe('Error: not found');
    });

    it('supports different return types', () => {
      const okResult = ok(10);
      const errResult = err<number, string>('fail');

      expect(
        okResult.match({
          ok: (v) => v > 5,
          err: () => false,
        }),
      ).toBe(true);

      expect(
        errResult.match({
          ok: (v) => v > 5,
          err: () => false,
        }),
      ).toBe(false);
    });
  });

  describe('fromPromise()', () => {
    it('wraps successful promise in Ok', async () => {
      const result = await fromPromise(Promise.resolve(42));
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it('wraps rejected promise in Err', async () => {
      const error = new Error('async fail');
      const result = await fromPromise(Promise.reject(error));
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(error);
    });

    it('catches thrown errors in async functions', async () => {
      const failingAsync = async () => {
        throw new Error('thrown');
      };
      const result = await fromPromise(failingAsync());
      expect(result.isErr()).toBe(true);
    });
  });

  describe('fromTry()', () => {
    it('wraps successful sync function in Ok', () => {
      const result = fromTry(() => JSON.parse('{"a":1}'));
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({ a: 1 });
    });

    it('wraps throwing sync function in Err', () => {
      const result = fromTry(() => JSON.parse('invalid json'));
      expect(result.isErr()).toBe(true);
    });
  });

  describe('type narrowing', () => {
    it('narrows type correctly with isOk()', () => {
      const result: Result<number, string> = ok(42);
      if (result.isOk()) {
        // TypeScript should know this is Ok - use unwrap which is safe after guard
        expect(result.unwrap()).toBe(42);
      } else {
        // This branch should never execute
        expect.fail('Should have been Ok');
      }
    });

    it('narrows type correctly with isErr()', () => {
      const result: Result<number, string> = err('fail');
      if (result.isErr()) {
        // TypeScript should know this is Err - use unwrapErr which is safe after guard
        expect(result.unwrapErr()).toBe('fail');
      } else {
        // This branch should never execute
        expect.fail('Should have been Err');
      }
    });

    it('isOk type guard works with standalone function', () => {
      const result: Result<number, string> = ok(42);
      if (isOk(result)) {
        expect(result.unwrap()).toBe(42);
      }
    });

    it('isErr type guard works with standalone function', () => {
      const result: Result<number, string> = err('fail');
      if (isErr(result)) {
        expect(result.unwrapErr()).toBe('fail');
      }
    });
  });

  describe('real-world scenarios', () => {
    interface User {
      id: number;
      name: string;
    }

    interface Profile {
      userId: number;
      bio: string;
    }

    const fetchUser = (id: number): Result<User, string> => {
      if (id <= 0) return err('Invalid user ID');
      return ok({ id, name: 'Alice' });
    };

    const fetchProfile = (user: User): Result<Profile, string> => {
      return ok({ userId: user.id, bio: `Profile for ${user.name}` });
    };

    it('chains multiple operations', () => {
      const result = fetchUser(1).flatMap(fetchProfile);
      expect(result.unwrap()).toEqual({
        userId: 1,
        bio: 'Profile for Alice',
      });
    });

    it('handles error in chain', () => {
      const result = fetchUser(-1).flatMap(fetchProfile);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('Invalid user ID');
    });

    it('transforms data through the chain', () => {
      const bio = fetchUser(1)
        .flatMap(fetchProfile)
        .map((p) => p.bio)
        .unwrapOr('No bio');
      expect(bio).toBe('Profile for Alice');
    });

    it('provides fallback on error', () => {
      const bio = fetchUser(-1)
        .flatMap(fetchProfile)
        .map((p) => p.bio)
        .unwrapOr('No bio');
      expect(bio).toBe('No bio');
    });
  });
});
