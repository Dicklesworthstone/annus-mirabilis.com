/**
 * ROW 5: "An arbitrary entropy-density constant cancels" (am-ver-adversarial-audit-1ef).
 *
 * Wien's spectral entropy density is fixed only up to an additive function of frequency. A reader
 * who assumes C(nu) cancels in a volume change asserts the entropy difference is unchanged by it.
 * At fixed energy and band it adds dNu * C(nu) * (V - V0), which the owner returns as `extraTerm`.
 *
 * The owner labels itself `historicalStatus: "adversarial-derivation-variant"` and its own note
 * says "adversarial derivation variant, not a model of radiation" -- so the variant existed and had
 * no paired test, which is this bead's thesis about its own corpus.
 */

import { expect, test } from "bun:test";
import { entropyWithUnfixedConstant } from "../../physics/reference/radiation/entropy.ts";
import { wrongEntropyAssumesConstantCancels } from "./wrongComputations.ts";

/** Fixed energy and band, with the volume doubled. */
const P = { E: 1e-6, nu: 5e14, dNu: 1e12, V: 2e-3, V0: 1e-3, C: 3.3 };

test("the retained constant adds exactly dNu * C * (V - V0)", () => {
  const out = entropyWithUnfixedConstant(P);
  expect(out.status).toBe("value");
  expect(out.extraTerm).toBeCloseTo(P.dNu * P.C * (P.V - P.V0), 6);
  expect(out.deltaSWithC).toBeCloseTo(out.deltaS + out.extraTerm, 6);
});

test("the WRONG assumption fails on the entropy difference, and not by a little", () => {
  const out = entropyWithUnfixedConstant(P);
  const wrong = wrongEntropyAssumesConstantCancels(out.deltaS);
  expect(wrong).not.toBeCloseTo(out.deltaSWithC, 6);
  // The extra term dominates utterly at these values: deltaS is about 2.9e-11 and the term 3.3e9.
  expect(Math.abs(out.extraTerm)).toBeGreaterThan(Math.abs(out.deltaS) * 1e10);
});

test("the term vanishes only when the volume does not change, which is the honest cancellation", () => {
  // Without this the row would read as "C never cancels", which is false and would misdescribe the
  // physics: at V = V0 there is no volume change and nothing to add.
  const noChange = entropyWithUnfixedConstant({ ...P, V: P.V0 });
  expect(noChange.extraTerm).toBeCloseTo(0, 12);
  expect(noChange.deltaSWithC).toBeCloseTo(noChange.deltaS, 12);
  expect(noChange.deltaS).toBeCloseTo(0, 12);
});

test("the term scales with C and with the band width, so it is not a fixed offset", () => {
  const doubleC = entropyWithUnfixedConstant({ ...P, C: P.C * 2 });
  const doubleBand = entropyWithUnfixedConstant({ ...P, dNu: P.dNu * 2 });
  const base = entropyWithUnfixedConstant(P);
  expect(doubleC.extraTerm / base.extraTerm).toBeCloseTo(2, 9);
  expect(doubleBand.extraTerm / base.extraTerm).toBeCloseTo(2, 9);
});

test("the owner declares itself an adversarial variant rather than a model", () => {
  // AGENTS.md keeps model status separate from execution status; this is that rule observable.
  const out = entropyWithUnfixedConstant(P);
  expect(out.historicalStatus).toBe("adversarial-derivation-variant");
  expect(out.modelNote).toContain("not a model of radiation");
});
