import assert from "node:assert/strict";
import test from "node:test";
import { fixtureBrownianPedagogicalReconstruction } from "../../equations/derivations/fixtures.ts";
import { parseDerivationStep } from "../../equations/derivations/schema.ts";
import type { DerivationStep } from "../../equations/derivations/types.ts";
import { missingReadingFields } from "../../equations/derivations/types.ts";

test("stepReadings: missingReadingFields identifies missing r0, r1, or r2", () => {
  const baseStep = fixtureBrownianPedagogicalReconstruction.steps[0];
  assert.ok(baseStep);

  const complete = missingReadingFields(baseStep);
  assert.equal(complete.length, 0);

  const missingR1: DerivationStep = {
    ...baseStep,
    reasons: { ...baseStep.reasons, r1: "" },
  };
  const reported = missingReadingFields(missingR1);
  assert.deepEqual(reported, ["r1"]);
});

test("stepReadings: schema validation fails when readings object is missing required fields", () => {
  const rawStep = {
    id: "step-missing-readings",
    from: { kind: "symbol", termId: "x", quantityId: "x" },
    to: { kind: "symbol", termId: "y", quantityId: "y" },
    changedSubexpressionIds: ["x"],
    rule: {
      kind: "substitute",
      params: {
        targetId: "x",
        replacement: { kind: "symbol", termId: "y", quantityId: "y" },
        citedEquality: "x=y",
      },
    },
    reasonKind: "algebra",
    reasons: { r0: "r0 text" }, // Missing r1 and r2
    premiseRefs: [],
    isMove: false,
    verification: { status: "verified" },
  };

  assert.throws(() => parseDerivationStep(rawStep, "step"), /r1 reason text is required/);
});
