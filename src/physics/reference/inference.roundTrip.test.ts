/**
 * EINSTEIN'S SECTION 5 ROUND TRIP, AND THE CIRCLE IT MUST REFUSE.
 *
 * am-bm-results-cards-ft8k's test plan pins it: "Card 8's round trip returns 6e23 within 1e-12
 * relative." Page 559 goes forward from N to a displacement, and the section's own heading
 * promises the other direction, "Eine neue Methode zur Bestimmung der wahren Groesse der Atome".
 * Putting his stated inputs through stokesEinsteinD and then back through invertToMolecularNumber
 * returns the 6.10^23 he started from, which is the arithmetic the card claims.
 *
 * WHAT A ROUND TRIP IS AND IS NOT, and the distinction is the reason this file exists rather than
 * a bare equality assertion. Recovering N from a diffusion coefficient THAT WAS COMPUTED FROM N is
 * a check that the algebra inverts. It is not evidence that N has that value, and nothing here may
 * be read as the paper's method succeeding: the real method needs a MEASURED displacement and an
 * independently measured radius. AGENTS.md names the failure directly, "inferring a molecular
 * count from diffusion while silently using that same count to construct the supposedly
 * independent data", and the second test is the guard against the nearest version of it.
 *
 * THE RADIUS IS WHERE THE CIRCLE ENTERS. Einstein states the particle diameter as a given, from
 * microscopy, so it is independently declared. A radius inferred from the same displacements would
 * make the inference circular, and `invertToMolecularNumber` refuses that by name rather than
 * returning a number nobody could interpret.
 */

import { describe, expect, test } from "bun:test";
import { getConstantSet } from "./constants.ts";
import { stokesEinsteinD } from "./diffusion/distributions.ts";
import { invertToMolecularNumber } from "./inference.ts";

/** Page 559's stated inputs, with the printed 0,001 mm diameter already halved. */
const PLATE = { T: 290.15, eta: 0.00135, a: 5e-7 } as const;
const PRINTED_SET = "einstein-1905-brownian-printed";

/**
 * A complete StatisticalInterval. The type needs five fields beyond the bounds, and a partial
 * object literal runs perfectly well while failing `tsc`: neither test lane typechecks, so the
 * suite was green on an interval the type does not admit.
 */
function interval(d: number) {
  return {
    lower: d * 0.99,
    upper: d * 1.01,
    coverage: 0.95,
    q: 0.95,
    uncertaintyKind: "statistical-interval",
    coverageKind: "conservative",
    estimatorId: "roundTripFixture",
  } as const;
}

function forwardD(): number {
  const set = getConstantSet(PRINTED_SET);
  const d = stokesEinsteinD({ ...PLATE }, set).result;
  if (d.status !== "value" || typeof d.value !== "number")
    throw new Error("the forward step refused, so there is no round trip to test");
  return d.value;
}

describe("the section 5 round trip", () => {
  test("N out equals the 6e23 that went in, to 1e-12 relative", () => {
    const dHat = forwardD();
    const r = invertToMolecularNumber(
      {
        ...PLATE,
        radiusProvenance: "independently-declared",
        dHat,
        interval: interval(dHat),
        synthetic: false,
      },
      getConstantSet(PRINTED_SET),
    );
    expect(r.kind).toBe("accepted");
    if (r.kind !== "accepted") return;
    const relative = Math.abs(r.data.estimate / 6e23 - 1);
    console.log(
      `[census] section 5 round trip: N = ${r.data.estimate.toExponential(10)}, ` +
        `relative to the printed 6e23 ${relative.toExponential(3)}`,
    );
    expect(relative).toBeLessThan(1e-12);
    // The estimate is tagged for what it is, not as a measurement of nature.
    expect(r.data.constantSetId).toBe(PRINTED_SET);
  });

  test("it is an algebra check: the number it returns is the number it was given", () => {
    // Stated as a test so nobody can cite the round trip as evidence for N. Feeding a DIFFERENT
    // Avogadro number through the same forward step returns that one instead, which is what makes
    // this an identity rather than a determination.
    const set = getConstantSet(PRINTED_SET);
    const dHat = forwardD();
    const doubled = dHat / 2; // the D that an N twice as large would have produced
    const r = invertToMolecularNumber(
      {
        ...PLATE,
        radiusProvenance: "independently-declared",
        dHat: doubled,
        interval: interval(doubled),
        synthetic: false,
      },
      set,
    );
    expect(r.kind).toBe("accepted");
    if (r.kind !== "accepted") return;
    expect(Math.abs(r.data.estimate / 1.2e24 - 1)).toBeLessThan(1e-12);
  });
});

describe("THE CIRCLE IT REFUSES", () => {
  test("a radius taken from the same displacements is refused by name", () => {
    const dHat = forwardD();
    const r = invertToMolecularNumber(
      {
        ...PLATE,
        radiusProvenance: "same-displacements",
        dHat,
        interval: interval(dHat),
        synthetic: false,
      },
      getConstantSet(PRINTED_SET),
    );
    expect(r.kind).toBe("refused");
    if (r.kind !== "refused") return;
    // Named, so the refusal says which circle rather than "invalid input".
    expect(r.refusal.code).toBe("circular-radius-from-displacement");
    expect(r.refusal.affected.parameterIds).toContain("a");
  });

  test("the refusal is the ONLY difference: the accepted call differs by one field", () => {
    // Without this the refusal above could be failing for an unrelated reason, and the pair would
    // look like a working guard while proving nothing.
    const dHat = forwardD();
    const common = {
      ...PLATE,
      dHat,
      interval: interval(dHat),
      synthetic: false,
    };
    const set = getConstantSet(PRINTED_SET);
    expect(
      invertToMolecularNumber({ ...common, radiusProvenance: "independently-declared" }, set).kind,
    ).toBe("accepted");
    expect(
      invertToMolecularNumber({ ...common, radiusProvenance: "same-displacements" }, set).kind,
    ).toBe("refused");
  });
});
