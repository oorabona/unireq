/**
 * Result type for functional error handling
 *
 * Provides a type-safe way to handle success and error cases
 * without throwing exceptions. Inspired by Rust's Result type.
 *
 * @example
 * ```ts
 * const result = await client.safe.get<User>('/users/1');
 *
 * // Pattern matching
 * const name = result.match({
 *   ok: (response) => response.data.name,
 *   err: (error) => 'Unknown',
 * });
 *
 * // Chaining operations
 * const profile = result
 *   .map(r => r.data)
 *   .flatMap(user => fetchProfile(user.id));
 *
 * // Unwrapping with fallback
 * const data = result.unwrapOr(defaultResponse);
 * ```
 */

/**
 * Pattern matching interface for Result
 */
export interface ResultPatterns<T, E, U> {
  readonly ok: (value: T) => U;
  readonly err: (error: E) => U;
}

/**
 * Ok variant - represents success
 */
class OkImpl<T, E> {
  readonly _tag = 'Ok' as const;

  constructor(readonly value: T) {}

  /**
   * Returns true if this is an Ok value
   */
  isOk(): this is OkImpl<T, E> {
    return true;
  }

  /**
   * Returns true if this is an Err value
   */
  isErr(): this is ErrImpl<T, E> {
    return false;
  }

  /**
   * Transforms the success value, leaving errors unchanged
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return ok(fn(this.value));
  }

  /**
   * Maps a function that returns a Result, flattening the result
   */
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  /**
   * Returns the success value or throws if this is an Err
   * @throws Error if this is an Err
   */
  unwrap(): T {
    return this.value;
  }

  /**
   * Returns the success value or the provided fallback
   */
  unwrapOr(_fallback: T): T {
    return this.value;
  }

  /**
   * Returns the error value or throws if this is an Ok
   * @throws Error if this is an Ok
   */
  unwrapErr(): never {
    throw new Error('Called unwrapErr on Ok value');
  }

  /**
   * Pattern matching on the result
   */
  match<U>(patterns: ResultPatterns<T, E, U>): U {
    return patterns.ok(this.value);
  }
}

/**
 * Err variant - represents failure
 */
class ErrImpl<T, E> {
  readonly _tag = 'Err' as const;

  constructor(readonly error: E) {}

  /**
   * Returns true if this is an Ok value
   */
  isOk(): this is OkImpl<T, E> {
    return false;
  }

  /**
   * Returns true if this is an Err value
   */
  isErr(): this is ErrImpl<T, E> {
    return true;
  }

  /**
   * Transforms the success value, leaving errors unchanged
   * For Err, this is a no-op that returns the same Err
   */
  map<U>(_fn: (value: T) => U): Result<U, E> {
    // Return new Err with same error but different T type
    return err(this.error);
  }

  /**
   * Maps a function that returns a Result, flattening the result
   * For Err, this is a no-op that returns the same Err
   */
  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return err(this.error);
  }

  /**
   * Returns the success value or throws if this is an Err
   * @throws The error value
   */
  unwrap(): never {
    throw this.error;
  }

  /**
   * Returns the success value or the provided fallback
   */
  unwrapOr(fallback: T): T {
    return fallback;
  }

  /**
   * Returns the error value or throws if this is an Ok
   */
  unwrapErr(): E {
    return this.error;
  }

  /**
   * Pattern matching on the result
   */
  match<U>(patterns: ResultPatterns<T, E, U>): U {
    return patterns.err(this.error);
  }
}

/**
 * Result type - either Ok<T> or Err<E>
 */
export type Result<T, E> = OkImpl<T, E> | ErrImpl<T, E>;

/**
 * Creates a successful Result containing the value
 *
 * @example
 * ```ts
 * const result = ok({ name: 'Alice' });
 * console.log(result.unwrap()); // { name: 'Alice' }
 * ```
 */
export function ok<T, E = never>(value: T): Result<T, E> {
  return new OkImpl<T, E>(value);
}

/**
 * Creates a failed Result containing the error
 *
 * @example
 * ```ts
 * const result = err(new Error('Not found'));
 * console.log(result.isErr()); // true
 * ```
 */
export function err<T = never, E = unknown>(error: E): Result<T, E> {
  return new ErrImpl<T, E>(error);
}

/**
 * Type guard to check if a Result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is OkImpl<T, E> {
  return result._tag === 'Ok';
}

/**
 * Type guard to check if a Result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is ErrImpl<T, E> {
  return result._tag === 'Err';
}

/**
 * Wraps a Promise in a Result, catching any errors
 *
 * @example
 * ```ts
 * const result = await fromPromise(fetch('/api/users'));
 * if (result.isOk()) {
 *   console.log(result.value);
 * }
 * ```
 */
export async function fromPromise<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(error as E);
  }
}

/**
 * Wraps a synchronous function in a Result, catching any errors
 *
 * @example
 * ```ts
 * const result = fromTry(() => JSON.parse(jsonString));
 * const data = result.unwrapOr({ default: true });
 * ```
 */
export function fromTry<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(error as E);
  }
}
