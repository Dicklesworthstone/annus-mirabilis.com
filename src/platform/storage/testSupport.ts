/**
 * A real, spec-shaped in-memory `Storage` implementation for tests, with optional failure
 * injection (a throwing accessor, a throwing getter, a quota error on write). This is a test
 * double for the *environment* (`window.localStorage`, a Web API boundary outside this project's
 * code), never a mock of the storage layer under test.
 */

export interface InMemoryStorageOptions {
  /** Throws when set, simulating an environment where merely touching storage throws. */
  throwOnAnyAccess?: Error;
  /** Throws only from `getItem`. */
  throwOnGet?: Error;
  /** Throws only from `setItem`, e.g. a `QuotaExceededError`. */
  throwOnSet?: Error;
}

export class InMemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  private readonly options: InMemoryStorageOptions;

  constructor(options: InMemoryStorageOptions = {}) {
    this.options = options;
  }

  private assertAccessible(): void {
    if (this.options.throwOnAnyAccess) throw this.options.throwOnAnyAccess;
  }

  get length(): number {
    this.assertAccessible();
    return this.data.size;
  }

  key(index: number): string | null {
    this.assertAccessible();
    return Array.from(this.data.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    this.assertAccessible();
    if (this.options.throwOnGet) throw this.options.throwOnGet;
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.assertAccessible();
    if (this.options.throwOnSet) throw this.options.throwOnSet;
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.assertAccessible();
    this.data.delete(key);
  }

  clear(): void {
    this.assertAccessible();
    this.data.clear();
  }

  /** Test-only escape hatch to seed or inspect raw content without going through the public API. */
  rawSet(key: string, value: string): void {
    this.data.set(key, value);
  }
  rawGet(key: string): string | undefined {
    return this.data.get(key);
  }
}

export function quotaExceededError(): DOMException {
  return new DOMException("The quota has been exceeded.", "QuotaExceededError");
}
