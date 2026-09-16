import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import { familyParityCases } from "../../experiments/interactions/parity.suite.ts";

describe("BoundaryChannelSelector: Energy Accounting Parity Tests (am-inst-interaction-families-m2ps)", () => {
  it("passes energy-accounting parity cases for ME-03 opposite pulses boundary ledger", async () => {
    const results = await familyParityCases("energy-accounting", {
      owner: {},
      ownerSource: "reference-evaluator",
      ownerLabel: "massEnergy.ts",
    });

    assert.ok(results.length > 0);
    for (const res of results) {
      assert.equal(res.family, "energy-accounting");
      assert.equal(res.ownerSource, "reference-evaluator");
      assert.equal(res.ownerLabel, "massEnergy.ts");
      assert.equal(res.passed, true);
    }
  });

  it("validates energy-accounting action contract with visual and accessible equivalent affordances", () => {
    const validContract = {
      actionId: "select-system-boundary",
      family: "energy-accounting",
      question: "When energy leaves a body, which system loses mass, and which does not?",
      inputs: ["boundary", "disposition"],
      commandClass: "measurement-change",
      acceptedResult: {
        outputs: ["energyChange", "massChange", "systemEnergyChange", "systemMassChange"],
        allowedStatuses: ["value", "not-applicable"],
      },
      visualAffordance: "Drag a boundary around objects",
      equivalentAffordance:
        "Select the objects included in the system and inspect energy crossing that boundary",
      announcement: "System boundary updated; energy and mass changes recalculated",
    };

    const validated = validateActionContract(validContract);
    assert.equal(validated.family, "energy-accounting");
    checkAccessibleEquivalence(validated);
  });
});
