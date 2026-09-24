import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  familyParityCases,
  type ProbabilityDiffusionOwner,
} from "../../experiments/interactions/parity.suite.ts";
import { intervalProbability } from "../../physics/reference/diffusion/distributions.ts";

/** The real owner. */
const DIFFUSION_OWNER: ProbabilityDiffusionOwner = { intervalProbability };
/** A deliberately wrong owner: it spreads as √(Dt) instead of √(2Dt), by evaluating the real law at
 * half the diffusivity. [−σ, σ] then holds erf(1) = 0.843 instead of 0.683, while the degenerate
 * and the half-line intervals are unchanged, so only the one-sigma case can catch it. */
const HALF_SPREAD_OWNER: ProbabilityDiffusionOwner = {
  intervalProbability: (x1, x2, t, D) => intervalProbability(x1, x2, t, D / 2),
};

const run = (owner: unknown, ownerLabel: string) =>
  familyParityCases("probability-diffusion", {
    owner,
    ownerSource: "reference-evaluator",
    ownerLabel,
  });

describe("probability-diffusion parity cases call their owner (am-inst-interaction-primitives-emwy)", () => {
  it("passes all three intervals on the diffusion owner", async () => {
    const results = await run(DIFFUSION_OWNER, "diffusion.ts");
    assert.deepEqual(
      results.map((r) => r.parityCaseId),
      [
        "probability-diffusion-bm01-one-sigma",
        "probability-diffusion-bm01-degenerate",
        "probability-diffusion-bm01-wide-half",
      ],
    );
    for (const r of results) assert.equal(r.passed, true, `${r.parityCaseId}: ${r.actual}`);
  });

  it("fails every case when no owner is supplied, which is how the old case passed", async () => {
    const results = await run({}, "diffusion.ts");
    assert.ok(results.length > 0);
    for (const r of results) {
      assert.equal(r.passed, false);
      assert.equal(r.actual, null);
    }
  });

  it("fails the one-sigma case on a wrong owner, for the intended reason", async () => {
    const results = await run(HALF_SPREAD_OWNER, "half-spread-plant");
    const byId = new Map(results.map((r) => [r.parityCaseId, r]));
    const oneSigma = byId.get("probability-diffusion-bm01-one-sigma");
    assert.equal(oneSigma?.passed, false);
    assert.ok(typeof oneSigma?.actual === "number" && oneSigma.actual > 0.84);
    assert.equal(byId.get("probability-diffusion-bm01-degenerate")?.passed, true);
    assert.equal(byId.get("probability-diffusion-bm01-wide-half")?.passed, true);
  });
});
