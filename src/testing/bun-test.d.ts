declare module "bun:test" {
  export interface TestFn {
    // bun accepts a per-test timeout in milliseconds as the third argument; the shim omitted
    // it, so a test that legitimately runs longer than the default could not be typed.
    (name: string, fn: () => void | Promise<void>, timeoutMs?: number): void;
    skip: (name: string, fn: () => void | Promise<void>, timeoutMs?: number) => void;
    skipIf: (
      condition: boolean,
    ) => (name: string, fn: () => void | Promise<void>, timeoutMs?: number) => void;
    only: (name: string, fn: () => void | Promise<void>, timeoutMs?: number) => void;
  }
  // bun gives describe the same skip/skipIf/only that test has, and the shim declared none of
  // them, so a suite whose subject cannot be decided in this tree could not be typed as skipped
  // and had to red instead. `describe.skipIf` is used by src/app/offline/page.test.tsx, where the
  // condition is a stale offline chapter set.
  export interface DescribeFn {
    (name: string, fn: () => void | Promise<void>): void;
    skip: (name: string, fn: () => void | Promise<void>) => void;
    skipIf: (condition: boolean) => (name: string, fn: () => void | Promise<void>) => void;
    only: (name: string, fn: () => void | Promise<void>) => void;
  }
  export const describe: DescribeFn;
  export const test: TestFn;
  export const it: TestFn;
  export function expect(actual: unknown, message?: string): any;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
}
