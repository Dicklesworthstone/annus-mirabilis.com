/**
 * Fixture for extractKernelSource.test.ts: a plain exported function with a
 * JSDoc comment, an arrow-function export, and a private helper that must
 * never be pulled in by name-based extraction.
 */

function privateHelper(x: number): number {
  return x * 2;
}

/**
 * Doubles `x` using the private helper.
 * @param x the input
 */
export function publicDoubler(x: number): number {
  return privateHelper(x);
}

export const arrowDoubler = (x: number): number => x * 2;
