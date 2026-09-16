import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SessionValidationError,
  validateSupportDefaultChange,
  validateSupportLadderUsage,
} from "../../comprehension/session.ts";
import type { SupportDefaultChangeRecord, SupportLadderUsage } from "../../comprehension/types.ts";

describe("supportLadderRecord schema and validation", () => {
  it("support ladder rungs used, order, and stopping point round-trip cleanly", () => {
    const usage: SupportLadderUsage = {
      rungsUsed: ["workedExample", "partialComparison", "prediction", "explanation"],
      rungOrder: ["workedExample", "partialComparison", "prediction", "explanation"],
      wentStraightToExplanation: false,
      stoppedAt: "explanation",
      transferCaseResolved: true,
    };

    const validated = validateSupportLadderUsage(usage);
    assert.deepEqual(validated.rungsUsed, usage.rungsUsed);
    assert.deepEqual(validated.rungOrder, usage.rungOrder);
    assert.equal(validated.wentStraightToExplanation, false);
    assert.equal(validated.stoppedAt, "explanation");
    assert.equal(validated.transferCaseResolved, true);
  });

  it("validates a support-default change citing round IDs", () => {
    const validChange: SupportDefaultChangeRecord = {
      stageId: "bm-variance-argument",
      previousDefaultRung: "partialComparison",
      newDefaultRung: "explanation",
      justifyingRoundIds: ["round-brownian-slice-20270412-01", "round-brownian-slice-20270412-02"],
      changeDate: "2027-04-13",
      rationale:
        "Rounds 01 and 02 showed readers consistently going straight to the explanation for the variance step.",
    };

    const validated = validateSupportDefaultChange(validChange);
    assert.equal(validated.stageId, "bm-variance-argument");
    assert.equal(validated.previousDefaultRung, "partialComparison");
    assert.equal(validated.newDefaultRung, "explanation");
    assert.equal(validated.justifyingRoundIds.length, 2);
  });

  it("support-default change without round IDs fails review check", () => {
    const invalidChange = {
      stageId: "bm-variance-argument",
      previousDefaultRung: "partialComparison",
      newDefaultRung: "explanation",
      justifyingRoundIds: [], // VIOLATION: Empty round IDs
      changeDate: "2027-04-13",
      rationale: "Author opinion that explanation default is better.",
    };

    assert.throws(
      () => validateSupportDefaultChange(invalidChange),
      (err: unknown) => {
        return err instanceof SessionValidationError && err.code === "missing-justifying-round-ids";
      },
    );
  });
});
