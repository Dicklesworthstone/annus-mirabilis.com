/**
 * The foundations that have a construction or extension, readable on the server.
 *
 * FoundationConstruction is a client component, so a server component cannot ask it whether it
 * will render anything without shipping it. The lesson body used to render it for every lesson
 * and let it return null, which put its code on every page that embeds a lesson: all six
 * constructions, about 8 KB brotli, on paper routes where none appears. Blocks now asks this list
 * first and mounts the construction's own chunk only where it will draw something.
 *
 * FoundationConstruction dispatches on the same type, so a construction added there without an
 * entry here does not compile; constructionIds.test.tsx renders every id and every other lesson
 * to check the two agree in both directions.
 */
export const FOUNDATION_CONSTRUCTION_IDS = [
  "functions-graphs",
  "derivatives",
  "partial-derivatives",
  "exponentials",
  "logarithms",
  "taylor-expansion",
  "unit-system-1905",
  "ratios-scaling",
  "orders-of-magnitude",
  "quantities-units",
  "error-and-inference",
  "matrices-linear-maps",
  "hyperbolic-functions-rapidity",
  "vectors-components",
  "dot-cross-products",
  "conservation-symmetry",
  "two-measurements-two-unknowns",
  "entropy-multiplicity",
] as const;

export type FoundationConstructionId = (typeof FOUNDATION_CONSTRUCTION_IDS)[number];

/** The construction id for a foundation, with or without its `foundation:` prefix, or null. */
export function foundationConstructionId(foundationId: string): FoundationConstructionId | null {
  const clean = foundationId.replace(/^foundation:/, "");
  return (FOUNDATION_CONSTRUCTION_IDS as readonly string[]).includes(clean)
    ? (clean as FoundationConstructionId)
    : null;
}
