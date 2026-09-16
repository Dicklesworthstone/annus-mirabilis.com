import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import { familyParityCases } from "../../experiments/interactions/parity.suite.ts";

describe("PartitionControl: Radiation Entropy Parity Tests (am-inst-interaction-families-m2ps)", () => {
  it("passes radiation-entropy parity cases for LQ-04 subvolume entropy reduction", async () => {
    const results = await familyParityCases("radiation-entropy", {
      owner: {},
      ownerSource: "reference-evaluator",
      ownerLabel: "radiation.ts",
    });

    assert.ok(results.length > 0);
    for (const res of results) {
      assert.equal(res.family, "radiation-entropy");
      assert.equal(res.ownerSource, "reference-evaluator");
      assert.equal(res.ownerLabel, "radiation.ts");
      assert.equal(res.passed, true);
    }
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
