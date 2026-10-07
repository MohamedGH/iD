/**
 * Pure Functional Programming Primitives (Result Monad, Pipe, Immutable Helpers)
 */

export type Ok<T> = Readonly<{
  readonly tag: 'ok';
  readonly value: T;
}>;

export type Err<E> = Readonly<{
  readonly tag: 'err';
  readonly error: E;
}>;

export type Result<T, E = string> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => Object.freeze({ tag: 'ok', value });

export const err = <E>(error: E): Err<E> => Object.freeze({ tag: 'err', error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.tag === 'ok';

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => result.tag === 'err';

export const mapResult = <T, U, E>(
  fn: (value: T) => U
) => (result: Result<T, E>): Result<U, E> =>
  isOk(result) ? ok(fn(result.value)) : result;

export const flatMapResult = <T, U, E>(
  fn: (value: T) => Result<U, E>
) => (result: Result<T, E>): Result<U, E> =>
  isOk(result) ? fn(result.value) : result;

export const matchResult = <T, E, R>(
  handlers: Readonly<{
    readonly onOk: (value: T) => R;
    readonly onErr: (error: E) => R;
  }>
) => (result: Result<T, E>): R =>
  isOk(result) ? handlers.onOk(result.value) : handlers.onErr(result.error);

export const unwrapOr = <T, E>(fallback: T) => (result: Result<T, E>): T =>
  isOk(result) ? result.value : fallback;

export const combineResults = <T, E>(
  results: readonly Result<T, E>[]
): Result<readonly T[], E> =>
  results.reduce<Result<readonly T[], E>>(
    (acc, current) =>
      flatMapResult<readonly T[], readonly T[], E>((items) =>
        mapResult<T, readonly T[], E>((val) => Object.freeze([...items, val]))(current)
      )(acc),
    ok(Object.freeze([]))
  );

export function pipe<A, B>(ab: (a: A) => B): (a: A) => B;
export function pipe<A, B, C>(ab: (a: A) => B, bc: (b: B) => C): (a: A) => C;
export function pipe<A, B, C, D>(
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D
): (a: A) => D;
export function pipe<A, B, C, D, E>(
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E
): (a: A) => E;
export function pipe(...fns: ReadonlyArray<(arg: unknown) => unknown>) {
  return (initial: unknown): unknown => fns.reduce((acc, fn) => fn(acc), initial);
}

export const clampString = (maxLength: number) => (input: string): string =>
  input.trim().slice(0, maxLength);

export const sanitizeIdentifier = (input: string): string =>
  input
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 128);
