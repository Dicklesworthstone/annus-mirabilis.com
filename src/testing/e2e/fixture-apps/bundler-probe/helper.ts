/**
 * A trivial second module for bundleFixtures.test.ts's determinism and
 * staticInputs tests: this is a bundler correctness probe, not a shipped
 * interactive fixture (it is never added to FIXTURE_APP_REGISTRY).
 */
export function greet(name: string): string {
  return `hello, ${name}`;
}
