/**
 * Additional ambient declarations for bun:test mocking utilities.
 */

declare module "bun:test" {
  export interface BunMock {
    module: (name: string, factory: () => unknown) => void;
    restore: () => void;
  }
  export const mock: BunMock;

  /** A method spy keeps the original callable signature when replacing its implementation. */
  export type BunSpy<Method extends (...args: never[]) => unknown> = Method & {
    mockImplementation(implementation: Method): BunSpy<Method>;
    mockRestore(): BunSpy<Method>;
  };

  export function spyOn<Target extends object, Key extends keyof Target>(
    target: Target,
    method: Key & (Target[Key] extends (...args: never[]) => unknown ? Key : never),
  ): BunSpy<Extract<Target[Key], (...args: never[]) => unknown>>;
}
