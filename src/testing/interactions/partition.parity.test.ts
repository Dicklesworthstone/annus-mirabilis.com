import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import { familyParityCases } from "../../experiments/interactions/parity.suite.ts";
import { radiationEntropyVolumeChange } from "../../physics/reference/radiation/entropy.ts";

describe("PartitionControl: Radiation Entropy Parity Tests (am-inst-interaction-families-m2ps)", () => {
  it("passes radiation-entropy parity cases for LQ-04 subvolume entropy reduction", async () => {
    // The real owner, radiation/entropy.ts. Until 2ec3daeb the case computed ln(0.5) inline and this
    // test passed owner: {}, so it exercised no owner at all.
    const results = await familyParityCases("radiation-entropy", {
      owner: { radiationEntropyVolumeChange },
      ownerSource: "reference-evaluator",
      ownerLabel: "radiation/entropy.ts",
    });

    assert.ok(results.length > 0);
    for (const res of results) {
      assert.equal(res.family, "radiation-entropy");
      assert.equal(res.ownerSource, "reference-evaluator");
      assert.equal(res.ownerLabel, "radiation/entropy.ts");
      assert.equal(res.passed, true);
    }
  });

  it("fails the radiation-entropy case with no owner, or with an owner whose entropy change is wrong", async () => {
    const run = (owner: unknown) =>
      familyParityCases("radiation-entropy", {
        owner,
        ownerSource: "reference-evaluator",
        ownerLabel: "radiation/entropy.ts",
      });
    for (const res of await run({})) assert.equal(res.passed, false);
    // A plausible wrong owner: the entropy change doubled, as if each quantum counted twice.
    const doubled = {
      radiationEntropyVolumeChange: (p: Parameters<typeof radiationEntropyVolumeChange>[0]) => {
        const r = radiationEntropyVolumeChange(p);
        return r.status === "value" ? { ...r, deltaS: 2 * r.deltaS } : r;
      },
    };
    for (const res of await run(doubled)) assert.equal(res.passed, false);
  });

  it("validates radiation-entropy action contract with visual and accessible equivalent affordances", () => {
    const validContract = {
      actionId: "resize-radiation-volume",
      family: "radiation-entropy",
      question:
        "How does entropy change when subvolume ratio V/V0 changes at fixed energy and band?",
      inputs: ["volumeRatio"],
      commandClass: "setup-change",
      acceptedResult: {
        outputs: ["entropyDifference"],
        allowedStatuses: ["value", "outside-domain"],
      },
      visualAffordance: "Drag volume partition boundary slider",
      equivalentAffordance:
        "Enter volume ratio or select half, same, or double preset with fixed energy and band",
      announcement: "Volume ratio updated; entropy difference recalculated at fixed energy",
    };

    const validated = validateActionContract(validContract);
    assert.equal(validated.family, "radiation-entropy");
    checkAccessibleEquivalence(validated);
  });
});
