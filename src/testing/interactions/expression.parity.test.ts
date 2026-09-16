import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import { familyParityCases } from "../../experiments/interactions/parity.suite.ts";

describe("ExpressionActionPicker: Derivations Parity Tests (am-inst-interaction-families-m2ps)", () => {
  it("passes derivations parity cases for ME-01 two ledgers subtraction steps", async () => {
    const results = await familyParityCases("derivations", {
      owner: {},
      ownerSource: "reference-evaluator",
      ownerLabel: "derivation-rules",
    });

    assert.ok(results.length > 0);
    for (const res of results) {
      assert.equal(res.family, "derivations");
      assert.equal(res.ownerSource, "reference-evaluator");
      assert.equal(res.ownerLabel, "derivation-rules");
      assert.equal(res.passed, true);
    }
  });

  it("validates derivations action contract with visual and accessible equivalent affordances", () => {
    const validContract = {
      actionId: "step-derivation",
      family: "derivations",
      question: "Which algebraic or premise step simplifies the energy balance equations?",
      inputs: ["selectedSubexpressionId", "activeStepIndex"],
      commandClass: "presentation-change",
      acceptedResult: {
        outputs: ["derivationStep", "simplifiedExpression"],
        allowedStatuses: ["value", "symbolic"],
      },
      visualAffordance: "Highlight clickable equation subexpressions",
      equivalentAffordance:
        "Select named subexpression, read role, and trigger justified derivation step",
      announcement: "Derivation step advanced and justified rule applied",
    };

    const validated = validateActionContract(validContract);
    assert.equal(validated.family, "derivations");
    checkAccessibleEquivalence(validated);
  });
});
