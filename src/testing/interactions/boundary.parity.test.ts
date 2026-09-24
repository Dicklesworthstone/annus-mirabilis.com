import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import { familyParityCases } from "../../experiments/interactions/parity.suite.ts";
import { evaluateBoundaryLedger } from "../../physics/reference/massEnergy.ts";

describe("BoundaryChannelSelector: Energy Accounting Parity Tests (am-inst-interaction-families-m2ps)", () => {
  it("passes energy-accounting parity cases for ME-03 opposite pulses boundary ledger", async () => {
    // The real owner, massEnergy.ts. Until ed627c24 the case added -L and +L inline and this test
    // passed owner: {}, so it exercised no owner at all.
    const results = await familyParityCases("energy-accounting", {
      owner: { evaluateBoundaryLedger },
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

  it("fails the energy-accounting case with no owner, or with a ledger that loses energy from the isolated system", async () => {
    const run = (owner: unknown) =>
      familyParityCases("energy-accounting", {
        owner,
        ownerSource: "reference-evaluator",
        ownerLabel: "massEnergy.ts",
      });
    for (const res of await run({})) assert.equal(res.passed, false);
    // A plausible wrong ledger: the isolated system is charged with the escaping radiation's energy.
    const leaky = {
      evaluateBoundaryLedger: (...args: Parameters<typeof evaluateBoundaryLedger>) => {
        const r = evaluateBoundaryLedger(...args);
        return args[0] === "combined-isolated-system"
          ? { ...r, systemEnergyChange: { status: "value", value: -args[2] } }
          : r;
      },
    };
    for (const res of await run(leaky)) assert.equal(res.passed, false);
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
