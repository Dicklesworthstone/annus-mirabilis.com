import { describe, expect, test } from "bun:test";
import { FIXTURE_JOURNEY_BROWNIAN, FIXTURE_PARTIAL_JOURNEY } from "../testing/fixtureJourney.ts";
import { checkJourney } from "./journeyChecks.ts";

describe("checkJourney: complete and partial journeys", () => {
  test("complete fixture journey validates with zero errors", () => {
    const findings = checkJourney(FIXTURE_JOURNEY_BROWNIAN);
    const errors = findings.filter((f) => f.severity === "error");
    expect(errors.length).toBe(0);
  });

  test("partial fixture journey with declared pending elements passes validation", () => {
    const findings = checkJourney(FIXTURE_PARTIAL_JOURNEY);
    const errors = findings.filter((f) => f.severity === "error");
    expect(errors.length).toBe(0);
  });

  test("complete journey missing a required element fails with element named", () => {
    const invalid = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      worldChecks: [],
    };
    const findings = checkJourney(invalid);
    const missingWorld = findings.find((f) => f.rule === "journey-complete-missing-element" && f.element === "worldChecks");
    expect(missingWorld).toBeDefined();
  });

  test("partial journey missing an undeclared required element fails", () => {
    const invalid = {
      ...FIXTURE_PARTIAL_JOURNEY,
      shelf: [], // shelf missing but not listed in pendingElements
    };
    const findings = checkJourney(invalid);
    const undeclared = findings.find((f) => f.rule === "journey-partial-undeclared-pending-element" && f.element === "shelf");
    expect(undeclared).toBeDefined();
  });

  test("partial journey declaring a pending element that is actually present fails", () => {
    const invalid = {
      ...FIXTURE_PARTIAL_JOURNEY,
      pendingElements: [
        ...FIXTURE_PARTIAL_JOURNEY.pendingElements!,
        {
          element: "stages",
          reason: "Stages in preparation",
          ownerBead: "am-disc-journey-i-chain-n1lh",
        },
      ],
    };
    const findings = checkJourney(invalid);
    const alreadyPresent = findings.find((f) => f.rule === "journey-pending-element-already-present" && f.element === "stages");
    expect(alreadyPresent).toBeDefined();
  });

  test("instrumented exercise count out of bounds (1 or 6) fails", () => {
    const tooFew = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      exercises: [{ id: "ex-1", role: "instrumented" as const }],
    };
    const findingsFew = checkJourney(tooFew);
    expect(findingsFew.some((f) => f.rule === "journey-instrumented-exercise-count")).toBe(true);

    const tooMany = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      exercises: [
        { id: "ex-1", role: "instrumented" as const },
        { id: "ex-2", role: "instrumented" as const },
        { id: "ex-3", role: "instrumented" as const },
        { id: "ex-4", role: "instrumented" as const },
        { id: "ex-5", role: "instrumented" as const },
        { id: "ex-6", role: "instrumented" as const },
      ],
    };
    const findingsMany = checkJourney(tooMany);
    expect(findingsMany.some((f) => f.rule === "journey-instrumented-exercise-count")).toBe(true);
  });

  test("doors arriving at different equation IDs fail validation", () => {
    const mismatchedDoors = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      doors: {
        frontDoor: {
          id: "door-front",
          title: "Front Door",
          arrivesAtEquationId: "eq-target-1",
        },
        sideDoors: [
          {
            id: "door-side",
            title: "Side Door",
            arrivesAtEquationId: "eq-target-2", // mismatch
          },
        ],
      },
    };
    const findings = checkJourney(mismatchedDoors);
    expect(findings.some((f) => f.rule === "doors-arrives-at-mismatch")).toBe(true);
  });
});
