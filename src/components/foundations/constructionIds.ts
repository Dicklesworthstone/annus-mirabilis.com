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
  "work-energy",
  "entropy-temperature",
  "viscosity-stokes-drag",
  "temperature-thermal-energy",
  "free-energy-osmotic-pressure",
  // The no-algebra route's bridges (dispatch 401). Each draws the picture its own prose had asked
  // the reader to draw on paper; none has a control, so none is in CONSTRUCTIONS_WITH_CONTROLS.
  "bridge-a-graph",
  "bridge-sum-average",
  "bridge-negative-numbers-direction",
  "bridge-fractions-ratios",
  "bridge-scientific-notation-units",
  // The three of dispatch 409. Each draws a claim its own lesson makes in words and could not show:
  // an account whose two sides are one length, the four ways two tokens can land, and four cells of
  // one mean square filling the mean square of twice the displacement. None has a control either.
  "bridge-equals-sign-relationship",
  "bridge-probability-notation",
  "bridge-squaring-square-roots",
  // Not a bridge, and the first entry here that is not (dispatch 418). foundation:flux-continuity
  // had 22 rendered formulas and no picture of the region its subject is about. Static, with no
  // control, so it is not in CONSTRUCTIONS_WITH_CONTROLS either.
  "flux-continuity",
  "diffusion-equation",
  "random-walks",
  "gaussian-distributions",
  "distributions",
  "integration",
  "frames-events",
] as const;

export type FoundationConstructionId = (typeof FOUNDATION_CONSTRUCTION_IDS)[number];

/**
 * The constructions a reader operates: buttons, fields, sliders or choices. Without JavaScript
 * those controls change nothing, so FoundationConstruction puts a notice before them.
 * constructionNoScript.test.tsx renders every construction and requires this list to match the
 * ones whose markup holds a control, in both directions.
 */
export const CONSTRUCTIONS_WITH_CONTROLS: readonly FoundationConstructionId[] = [
  "functions-graphs",
  "derivatives",
  "partial-derivatives",
  "exponentials",
  "logarithms",
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
  "work-energy",
  "temperature-thermal-energy",
];

/** The construction id for a foundation, with or without its `foundation:` prefix, or null. */
export function foundationConstructionId(foundationId: string): FoundationConstructionId | null {
  const clean = foundationId.replace(/^foundation:/, "");
  return (FOUNDATION_CONSTRUCTION_IDS as readonly string[]).includes(clean)
    ? (clean as FoundationConstructionId)
    : null;
}
