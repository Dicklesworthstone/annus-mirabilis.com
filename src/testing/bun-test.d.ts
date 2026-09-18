declare module "bun:test" {
  export interface TestFn {
    (name: string, fn: () => void | Promise<void>): void;
    skip: (name: string, fn: () => void | Promise<void>) => void;
    skipIf: (condition: boolean) => (name: string, fn: () => void | Promise<void>) => void;
    only: (name: string, fn: () => void | Promise<void>) => void;
  }
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export const test: TestFn;
  export const it: TestFn;
  export function expect(actual: unknown, message?: string): any;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
}
