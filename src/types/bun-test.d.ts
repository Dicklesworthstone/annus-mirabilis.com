/**
 * Additional ambient declarations for bun:test mocking utilities.
 */

declare module "bun:test" {
  export interface BunMock {
    module: (name: string, factory: () => unknown) => void;
  }
  export const mock: BunMock;
}
