import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import {
  type ClockEventOwner,
  familyParityCases,
} from "../../experiments/interactions/parity.suite.ts";
import { classifySimultaneity } from "../../physics/reference/events.ts";

/** The real owner, events.ts. */
const EVENTS_OWNER: ClockEventOwner = { classifySimultaneity };
/** A deliberately wrong owner: Galilean time, t′ = t, so events simultaneous at rest stay
 * simultaneous (Δt′ = 0) and Δx′ = Δx − vΔt = 10 ls. The case must fail on it. */
const GALILEAN_OWNER: ClockEventOwner = {
  classifySimultaneity: (e1, e2, beta) => ({
    status: "value",
    value: {
      deltaTPrime: e2.t - e1.t,
      deltaXPrime: e2.x - e1.x - beta * (e2.t - e1.t),
    },
  }),
};

describe("EventSelector: Clock & Event Parity Tests (am-inst-interaction-families-m2ps)", () => {
  it("passes clock-event parity cases for SR-03 simultaneity under boost", async () => {
    const results = await familyParityCases("clock-event", {
      owner: EVENTS_OWNER,
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

  it("fails the case when no owner is supplied, which is how it used to pass", async () => {
    const results = await familyParityCases("clock-event", {
      owner: {},
      ownerSource: "reference-evaluator",
      ownerLabel: "events.ts",
    });
    assert.ok(results.length > 0);
    for (const res of results) {
      assert.equal(res.passed, false);
      assert.equal(res.actual, null);
    }
  });

  it("fails the case on a wrong owner: Galilean time keeps the pair simultaneous", async () => {
    const results = await familyParityCases("clock-event", {
      owner: GALILEAN_OWNER,
      ownerSource: "reference-evaluator",
      ownerLabel: "galilean-plant",
    });
    assert.ok(results.length > 0);
    for (const res of results) assert.equal(res.passed, false);
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
