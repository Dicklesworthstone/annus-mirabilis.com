import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import { familyParityCases } from "../../experiments/interactions/parity.suite.ts";

describe("EventSelector: Clock & Event Parity Tests (am-inst-interaction-families-m2ps)", () => {
  it("passes clock-event parity cases for SR-03 simultaneity under boost", async () => {
    const results = await familyParityCases("clock-event", {
      owner: {},
      ownerSource: "reference-evaluator",
      ownerLabel: "events.ts",
    });

    assert.ok(results.length > 0);
    for (const res of results) {
      assert.equal(res.family, "clock-event");
      assert.equal(res.ownerSource, "reference-evaluator");
      assert.equal(res.ownerLabel, "events.ts");
      assert.equal(res.passed, true);
    }
  });

  it("validates clock-event action contract with visual and accessible equivalent affordances", () => {
    const validContract = {
      actionId: "select-clock-events",
      family: "clock-event",
      question: "Which events are simultaneous in moving frame S'?",
      inputs: ["selectedEventIds", "frameVelocity"],
      commandClass: "measurement-change",
      acceptedResult: {
        outputs: ["transformedCoordinates", "simultaneityVerdict"],
        allowedStatuses: ["value", "not-applicable"],
      },
      visualAffordance: "Select event points on space-time diagram",
      equivalentAffordance: "Choose named events from table and inspect simultaneity in frame S'",
      announcement: "Events selected and simultaneity evaluated in frame S'",
    };

    const validated = validateActionContract(validContract);
    assert.equal(validated.family, "clock-event");
    checkAccessibleEquivalence(validated);
  });
});
