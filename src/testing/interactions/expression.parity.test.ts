import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import { fixturePaper4TwoLedgers } from "../../equations/derivations/fixtures.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";
import { familyParityCases } from "../../experiments/interactions/parity.suite.ts";

describe("ExpressionActionPicker: Derivations Parity Tests (am-inst-interaction-families-m2ps)", () => {
  it("passes derivations parity cases for ME-01 two ledgers subtraction steps", async () => {
    // The real owner: verifyChain with the me-two-ledgers chain. Until 57fc06fc the case counted a
    // hard-coded list and this test passed owner: {}, so it exercised no owner at all.
    const results = await familyParityCases("derivations", {
      owner: { verifyChain, chain: fixturePaper4TwoLedgers },
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

  it("fails the derivations case with no owner, or with a verifier that approves everything", async () => {
    const run = (owner: unknown) =>
      familyParityCases("derivations", {
        owner,
        ownerSource: "reference-evaluator",
        ownerLabel: "derivation-rules",
      });
    for (const res of await run({})) assert.equal(res.passed, false);
    const approvesEverything = {
      verifyChain: (chain: { steps: readonly unknown[] }) => ({
        passed: true,
        stepReports: chain.steps.map(() => ({ passed: true })),
      }),
      chain: fixturePaper4TwoLedgers,
    };
    for (const res of await run(approvesEverything)) assert.equal(res.passed, false);
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
