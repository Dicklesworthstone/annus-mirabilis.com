import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import {
  type FieldsBoostOwner,
  familyParityCases,
} from "../../experiments/interactions/parity.suite.ts";
import { fieldInvariants, transformSI } from "../../physics/reference/fields.ts";

/** The real owner, fields.ts. */
const FIELDS_OWNER: FieldsBoostOwner = { transformSI, fieldInvariants };
/** A deliberately wrong owner: the Galilean field transformation, E' = E + v x B and B' = B, which
 * leaves E'y at 1 V/m and no magnetic field. The case must fail on it. */
const GALILEAN_OWNER: FieldsBoostOwner = {
  transformSI: ({ E, B, boost }) => ({
    E: { x: E.x, y: E.y - boost * B.z, z: E.z + boost * B.y },
    B,
  }),
  fieldInvariants,
};

describe("CoefficientEditor: Fields & Boosts Parity Tests (am-inst-interaction-families-m2ps)", () => {
  it("passes fields-boosts parity cases for SR-08 field transformation and invariant preservation", async () => {
    const results = await familyParityCases("fields-boosts", {
      owner: FIELDS_OWNER,
      ownerSource: "reference-evaluator",
      ownerLabel: "fields.ts",
    });

    assert.ok(results.length > 0);
    for (const res of results) {
      assert.equal(res.family, "fields-boosts");
      assert.equal(res.ownerSource, "reference-evaluator");
      assert.equal(res.ownerLabel, "fields.ts");
      assert.equal(res.passed, true);
    }
  });

  it("fails the case when no owner is supplied, which is how it used to pass", async () => {
    const results = await familyParityCases("fields-boosts", {
      owner: {},
      ownerSource: "reference-evaluator",
      ownerLabel: "fields.ts",
    });
    assert.ok(results.length > 0);
    for (const res of results) assert.equal(res.passed, false);
  });

  it("fails the case on a wrong owner: the Galilean transformation", async () => {
    const results = await familyParityCases("fields-boosts", {
      owner: GALILEAN_OWNER,
      ownerSource: "reference-evaluator",
      ownerLabel: "galilean-plant",
    });
    assert.ok(results.length > 0);
    for (const res of results) assert.equal(res.passed, false);
  });

  it("validates fields-boosts action contract with visual and accessible equivalent affordances", () => {
    const validContract = {
      actionId: "edit-field-component",
      family: "fields-boosts",
      question: "How do electromagnetic field components transform under a boost along x?",
      inputs: ["selectedComponentId", "magnitude"],
      commandClass: "observer-change",
      acceptedResult: {
        outputs: ["transformedComponents", "fieldInvariant"],
        allowedStatuses: ["value"],
      },
      visualAffordance: "Rotate field vector arrow and drag coefficient handles",
      equivalentAffordance:
        "Select component and enter signed magnitude, then inspect transformed components",
      announcement: "Field component updated; transformed components recalculated in moving frame",
    };

    const validated = validateActionContract(validContract);
    assert.equal(validated.family, "fields-boosts");
    checkAccessibleEquivalence(validated);
  });
});
