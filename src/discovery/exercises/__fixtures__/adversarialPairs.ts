/**
 * The adversarial corpus of the exercise checker (am-disc-exercise-checker-i4h2): "a gate, not a
 * sample". Each pair carries the verdict the checker must reach and the reason the pair is
 * dangerous. adversarialPairs.test.ts runs every entry.
 *
 * A limit this corpus records rather than hides: a pair that disagrees only at one interior point
 * the samples do not land on, (x − 0.3)/(x − 0.3) against 1 on [0, 1], is reported equivalent,
 * because no finite set of sample points can see a single missing point between them. The corpus
 * gates the singular point the samples do reach, x = 0.5; a post-verdict domain probe is the
 * bead's separate criterion for the rest.
 */
import type { FunctionName } from "../grammar.ts";
import type { Domain } from "../samplePoints.ts";

export type RequiredVerdict = "equivalent" | "not-equivalent" | "could-not-compare";

export interface AdversarialPair {
  readonly id: string;
  readonly reader: string;
  readonly reference: string;
  readonly names: readonly string[];
  readonly domains: Readonly<Record<string, Domain>>;
  readonly tolerance: Readonly<{ absolute: number; relative: number }>;
  readonly verdict: RequiredVerdict;
  /** Why the pair is dangerous: what a weaker checker would get wrong. */
  readonly reason: string;
}

const TIGHT = { absolute: 1e-9, relative: 1e-9 } as const;

export const ADVERSARIAL_PAIRS: readonly AdversarialPair[] = [
  {
    id: "sin-32-pi-x-unit-grid",
    reader: "x^2 + sin(32*pi*x)",
    reference: "x^2",
    names: ["x", "pi"],
    domains: { x: { min: 0, max: 1 } },
    tolerance: TIGHT,
    verdict: "not-equivalent",
    reason:
      "sin(32πx) vanishes at every base-2 grid point with denominator up to 32, to about 1e-14, yet differs by exactly 1 at x = 0.328125. A checker sampling only a binary grid calls this equivalent.",
  },
  {
    id: "sin-grid-affine-domain",
    reader: "x^2 + sin(8*pi*(x-2))",
    reference: "x^2",
    names: ["x", "pi"],
    domains: { x: { min: 2, max: 6 } },
    tolerance: TIGHT,
    verdict: "not-equivalent",
    reason:
      "The same construction carried through the affine map of the domain [2, 6], written with literals: mapping the domain onto the unit interval does not protect a grid.",
  },
  {
    id: "sin-27-pi-y-base-3",
    reader: "x + y + sin(27*pi*y)",
    reference: "x + y",
    names: ["x", "y", "pi"],
    domains: { x: { min: 0, max: 1 }, y: { min: 0, max: 1 } },
    tolerance: TIGHT,
    verdict: "not-equivalent",
    reason:
      "A second variable is sampled on a base-3 grid, where sin(27πy) vanishes: the aliasing attack moved to the dimension a grid-only checker would not think to guard.",
  },
  {
    id: "cos-32-pi-x-unit-grid",
    reader: "x^2 + cos(32*pi*x) - 1",
    reference: "x^2",
    names: ["x", "pi"],
    domains: { x: { min: 0, max: 1 } },
    tolerance: TIGHT,
    verdict: "not-equivalent",
    reason:
      "cos(32πx) − 1 vanishes on the same binary grid as the sine case: cos is on the allow-list, so it needs its own entry.",
  },
  {
    id: "differs-only-outside-domain",
    reader: "abs(x)",
    reference: "x",
    names: ["x"],
    domains: { x: { min: 1, max: 10 } },
    tolerance: TIGHT,
    verdict: "equivalent",
    reason:
      "|x| and x differ only for negative x, outside the declared [1, 10]. The checker's claim is scoped to the stated ranges, so it must say equivalent and not overreach.",
  },
  {
    id: "single-singular-point-sampled",
    reader: "(x-0.5)/(x-0.5)",
    reference: "1",
    names: ["x"],
    domains: { x: { min: 0, max: 1 } },
    tolerance: TIGHT,
    verdict: "could-not-compare",
    reason:
      "Agrees everywhere but x = 0.5, where the expression is undefined and the samples land. Neither verdict is honest there, so the checker must say it could not compare.",
  },
  {
    id: "below-tolerance-everywhere",
    reader: "x + 1e-12",
    reference: "x",
    names: ["x"],
    domains: { x: { min: 0, max: 1 } },
    tolerance: TIGHT,
    verdict: "equivalent",
    reason:
      "The difference, 1e-12, is below the declared tolerance everywhere, so this corpus cannot be satisfied by quietly tightening the tolerance until every near pair fails.",
  },
];

/**
 * Every function on the grammar's allow-list needs a corpus entry or a recorded reason that no
 * grid-vanishing construction exists for it: each new periodic function is a new way to vanish
 * on a rational grid.
 */
export const FUNCTION_COVERAGE: Readonly<
  Record<FunctionName, { readonly entry: string } | { readonly reason: string }>
> = {
  sin: { entry: "sin-32-pi-x-unit-grid" },
  cos: { entry: "cos-32-pi-x-unit-grid" },
  sqrt: {
    reason:
      "Monotone on its domain: it cannot supply the oscillation a difference needs to vanish at every grid point while differing between them.",
  },
  exp: { reason: "Monotone everywhere: no oscillation to align with a grid." },
  ln: { reason: "Monotone on its domain: no oscillation to align with a grid." },
  abs: {
    reason:
      "Piecewise linear with one corner: a difference built from it is zero on a whole interval or on neither side of the corner, never at isolated grid points alone.",
  },
};
