/** Minimal Result type for domain operations that may fail without throwing. */
export type Result<T, E = Error> = Ok<T> | Err<E>;

export class Ok<T> {
  readonly isOk = true as const;
  readonly isErr = false as const;
  constructor(readonly value: T) {}
  unwrap(): T {
    return this.value;
  }
}

export class Err<E> {
  readonly isOk = false as const;
  readonly isErr = true as const;
  constructor(readonly error: E) {}
  unwrap(): never {
    throw this.error instanceof Error ? this.error : new Error(String(this.error));
  }
}

export const ok = <T>(value: T): Ok<T> => new Ok(value);
export const err = <E>(error: E): Err<E> => new Err(error);
