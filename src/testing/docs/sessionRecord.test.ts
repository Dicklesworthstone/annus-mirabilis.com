import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SessionValidationError, validateSessionRecord } from "../../comprehension/session.ts";
import type { SessionRecord } from "../../comprehension/types.ts";

describe("sessionRecord schema and validation", () => {
  it("validates a session record storing accomplishment history per session", () => {
    const validRecord: SessionRecord = {
      sessionId: "s-bm-20270412-01",
      paper: "brownian-motion",
      route: "no-algebra",
      argumentId: "arg-bm-diffusion-equation",
      facilitator: "open-comprehension-brownian-motion",
      date: "2027-04-12",
      buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c",
      initialAccomplishment: "appreciate",
      accomplishmentChanges: [
        {
          timestamp: "2027-04-12T10:15:30Z",
          from: "appreciate",
          to: "explain",
          reason: "Participant requested deeper explanation of density transition.",
        },
      ],
      currentAccomplishment: "explain",
      outcomeReached: true,
      supportLadder: {
        rungsUsed: ["workedExample", "partialComparison", "explanation"],
        rungOrder: ["workedExample", "partialComparison", "explanation"],
        wentStraightToExplanation: false,
        stoppedAt: "explanation",
        transferCaseResolved: true,
      },
      stumblingPoints: [
        {
          code: "undefined-symbol",
          target: "#s4-formula-2",
          observation: "Uncertain about tau notation.",
        },
      ],
    };

    const validated = validateSessionRecord(validRecord);
    assert.equal(validated.sessionId, "s-bm-20270412-01");
    assert.equal(validated.currentAccomplishment, "explain");
    assert.equal(validated.accomplishmentChanges.length, 1);
    assert.equal(validated.accomplishmentChanges[0]?.from, "appreciate");
    assert.equal(validated.accomplishmentChanges[0]?.to, "explain");
  });

  it("refuses a fixture attempting to store accomplishment against a participant identifier", () => {
    const antiPatternRecord = {
      sessionId: "s-bm-20270412-01",
      participantId: "p-user-1234", // VIOLATION: person-level identifier
      paper: "brownian-motion",
      route: "no-algebra",
      argumentId: "arg-bm-diffusion-equation",
      facilitator: "open-comprehension-brownian-motion",
      date: "2027-04-12",
      buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c",
      initialAccomplishment: "appreciate",
      accomplishmentChanges: [],
      currentAccomplishment: "appreciate",
      outcomeReached: true,
      supportLadder: {
        rungsUsed: ["workedExample"],
        rungOrder: ["workedExample"],
        wentStraightToExplanation: false,
        stoppedAt: "workedExample",
        transferCaseResolved: true,
      },
      stumblingPoints: [],
    };

    assert.throws(
      () => validateSessionRecord(antiPatternRecord),
      (err: unknown) => {
        return (
          err instanceof SessionValidationError &&
          err.code === "forbidden-person-identifier" &&
          err.path.includes("participantId")
        );
      },
    );
  });

  it("refuses facilitator with @ sign (embedded email)", () => {
    const invalidFacilitator = {
      sessionId: "s-bm-20270412-01",
      paper: "brownian-motion",
      route: "no-algebra",
      argumentId: "arg-bm-diffusion-equation",
      facilitator: "facilitator@example.com", // VIOLATION: email instead of owner id
      date: "2027-04-12",
      buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c",
      initialAccomplishment: "appreciate",
      accomplishmentChanges: [],
      currentAccomplishment: "appreciate",
      outcomeReached: true,
      supportLadder: {
        rungsUsed: ["workedExample"],
        rungOrder: ["workedExample"],
        wentStraightToExplanation: false,
        stoppedAt: "workedExample",
        transferCaseResolved: true,
      },
      stumblingPoints: [],
    };

    assert.throws(
      () => validateSessionRecord(invalidFacilitator),
      (err: unknown) => {
        return err instanceof SessionValidationError && err.code === "facilitator-contains-email";
      },
    );
  });
});
