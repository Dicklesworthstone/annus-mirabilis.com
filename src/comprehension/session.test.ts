/**
 * Test coverage for comprehension session and support ladder validators.
 * Every refusal throw site in src/comprehension/session.ts is tested via an accept/reject pair
 * and cited by exact site line number (am-muyh).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SessionValidationError,
  validateSessionRecord,
  validateSupportDefaultChange,
  validateSupportLadderUsage,
} from "./session.ts";
import type { SessionRecord, SupportDefaultChangeRecord, SupportLadderUsage } from "./types.ts";

const BASE_VALID_SESSION: SessionRecord = {
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

const BASE_VALID_LADDER: SupportLadderUsage = {
  rungsUsed: ["workedExample", "partialComparison", "explanation"],
  rungOrder: ["workedExample", "partialComparison", "explanation"],
  wentStraightToExplanation: false,
  stoppedAt: "explanation",
  transferCaseResolved: true,
};

const BASE_VALID_DEFAULT_CHANGE: SupportDefaultChangeRecord = {
  stageId: "bm-variance-argument",
  previousDefaultRung: "partialComparison",
  newDefaultRung: "explanation",
  justifyingRoundIds: ["round-brownian-slice-20270412-01"],
  changeDate: "2027-04-13",
  rationale: "Rounds 01 and 02 showed readers consistently going straight to explanation.",
};

describe("validateSessionRecord refusal throw sites", () => {
  it("rejects non-object raw input (session.ts:46)", () => {
    assert.throws(
      () => validateSessionRecord(null),
      (err: unknown) =>
        err instanceof SessionValidationError &&
        err.code === "invalid-record" &&
        err.path === "SessionRecord",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects forbidden person-level identifier (session.ts:61)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          participantId: "user-1234",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "forbidden-person-identifier",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects empty or missing sessionId (session.ts:70)", () => {
    assert.throws(
      () => validateSessionRecord({ ...BASE_VALID_SESSION, sessionId: "   " }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-session-id",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects invalid paper identifier (session.ts:78)", () => {
    assert.throws(
      () => validateSessionRecord({ ...BASE_VALID_SESSION, paper: "general-relativity" }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "invalid-paper",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects invalid reading route (session.ts:86)", () => {
    assert.throws(
      () => validateSessionRecord({ ...BASE_VALID_SESSION, route: "hyperbolic-math" }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "invalid-route",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects missing argumentId (session.ts:94)", () => {
    assert.throws(
      () => validateSessionRecord({ ...BASE_VALID_SESSION, argumentId: "" }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-argument-id",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects missing facilitator (session.ts:102)", () => {
    assert.throws(
      () => validateSessionRecord({ ...BASE_VALID_SESSION, facilitator: "  " }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-facilitator",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects facilitator containing email address (session.ts:110)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          facilitator: "curator@example.com",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "facilitator-contains-email",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects invalid date format (session.ts:118)", () => {
    assert.throws(
      () => validateSessionRecord({ ...BASE_VALID_SESSION, date: "04-12-2027" }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "invalid-date",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects missing build commit hash (session.ts:122)", () => {
    assert.throws(
      () => validateSessionRecord({ ...BASE_VALID_SESSION, buildCommit: "" }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "missing-build-commit",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects invalid initial accomplishment (session.ts:130)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          initialAccomplishment: "unknownAccomplishment",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "invalid-accomplishment",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects non-array accomplishmentChanges (session.ts:138)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          accomplishmentChanges: "none",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "missing-accomplishment-changes",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects invalid change record inside accomplishmentChanges (session.ts:147)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          accomplishmentChanges: [null],
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "invalid-change-record",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects missing timestamp in accomplishment change (session.ts:154)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          accomplishmentChanges: [{ timestamp: "  ", from: "appreciate", to: "explain" }],
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-timestamp",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects invalid from accomplishment (session.ts:161)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          accomplishmentChanges: [
            { timestamp: "2027-04-12T10:00:00Z", from: "bogus", to: "explain" },
          ],
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "invalid-from-accomplishment",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects invalid to accomplishment (session.ts:168)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          accomplishmentChanges: [
            { timestamp: "2027-04-12T10:00:00Z", from: "appreciate", to: "bogus" },
          ],
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "invalid-to-accomplishment",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects identical from and to accomplishment transition (session.ts:175)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          initialAccomplishment: "explain",
          currentAccomplishment: "explain",
          accomplishmentChanges: [
            {
              timestamp: "2027-04-12T10:00:00Z",
              from: "explain",
              to: "explain",
            },
          ],
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "identical-accomplishment-transition",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects invalid current accomplishment (session.ts:190)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          currentAccomplishment: "nonExistent",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "invalid-current-accomplishment",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects inconsistent current accomplishment when changes are empty (session.ts:200)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          initialAccomplishment: "appreciate",
          accomplishmentChanges: [],
          currentAccomplishment: "explain",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "inconsistent-current-accomplishment",
    );
    const validUnchanged = {
      ...BASE_VALID_SESSION,
      initialAccomplishment: "appreciate" as const,
      accomplishmentChanges: [],
      currentAccomplishment: "appreciate" as const,
    };
    assert.doesNotThrow(() => validateSessionRecord(validUnchanged));
  });

  it("rejects broken accomplishment chain at start (session.ts:209)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          initialAccomplishment: "appreciate",
          accomplishmentChanges: [
            {
              timestamp: "2027-04-12T10:00:00Z",
              from: "explain",
              to: "predict",
            },
          ],
          currentAccomplishment: "predict",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "broken-accomplishment-chain",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects broken accomplishment chain in intermediate transitions (session.ts:219)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          initialAccomplishment: "appreciate",
          accomplishmentChanges: [
            {
              timestamp: "2027-04-12T10:00:00Z",
              from: "appreciate",
              to: "explain",
            },
            {
              timestamp: "2027-04-12T10:05:00Z",
              from: "predict",
              to: "derive",
            },
          ],
          currentAccomplishment: "derive",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "broken-accomplishment-chain",
    );
    const validChained = {
      ...BASE_VALID_SESSION,
      initialAccomplishment: "appreciate" as const,
      accomplishmentChanges: [
        {
          timestamp: "2027-04-12T10:00:00Z",
          from: "appreciate" as const,
          to: "explain" as const,
        },
        {
          timestamp: "2027-04-12T10:05:00Z",
          from: "explain" as const,
          to: "predict" as const,
        },
      ],
      currentAccomplishment: "predict" as const,
    };
    assert.doesNotThrow(() => validateSessionRecord(validChained));
  });

  it("rejects inconsistent current accomplishment differing from final transition target (session.ts:228)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          initialAccomplishment: "appreciate",
          accomplishmentChanges: [
            {
              timestamp: "2027-04-12T10:00:00Z",
              from: "appreciate",
              to: "explain",
            },
          ],
          currentAccomplishment: "derive",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "inconsistent-current-accomplishment",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects non-boolean outcomeReached (session.ts:237)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          outcomeReached: "true" as unknown as boolean,
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "missing-outcome-reached",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects non-array stumblingPoints (session.ts:247)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          stumblingPoints: null,
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "missing-stumbling-points",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects non-object stumbling point entry (session.ts:256)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          stumblingPoints: ["string-not-object"],
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "invalid-stumbling-point",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects invalid stumbling point code (session.ts:263)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          stumblingPoints: [
            {
              code: "unknown-code",
              target: "#s4",
              observation: "confused",
            },
          ],
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "invalid-stumbling-point-code",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects missing target in stumbling point (session.ts:270)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          stumblingPoints: [
            {
              code: "undefined-symbol",
              target: "   ",
              observation: "confused",
            },
          ],
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-target",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });

  it("rejects non-string observation in stumbling point (session.ts:277)", () => {
    assert.throws(
      () =>
        validateSessionRecord({
          ...BASE_VALID_SESSION,
          stumblingPoints: [
            {
              code: "undefined-symbol",
              target: "#s4",
              observation: 42 as unknown as string,
            },
          ],
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-observation",
    );
    assert.doesNotThrow(() => validateSessionRecord(BASE_VALID_SESSION));
  });
});

describe("validateSupportLadderUsage refusal throw sites", () => {
  it("rejects non-object support ladder usage (session.ts:315)", () => {
    assert.throws(
      () => validateSupportLadderUsage(null),
      (err: unknown) =>
        err instanceof SessionValidationError &&
        err.code === "invalid-record" &&
        err.path === "SupportLadderUsage",
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects non-array rungsUsed (session.ts:323)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          rungsUsed: "workedExample",
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-rungs-used",
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects invalid rung in rungsUsed (session.ts:331)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          rungsUsed: ["invalidRung"],
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "invalid-rung",
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects non-array rungOrder (session.ts:340)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          rungOrder: null,
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-rung-order",
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects invalid rung in rungOrder (session.ts:348)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          rungOrder: ["invalidRung"],
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "invalid-rung",
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects rung in rungsUsed missing from rungOrder (session.ts:362)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          rungsUsed: ["workedExample", "explanation"],
          rungOrder: ["workedExample"],
          stoppedAt: "workedExample",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError &&
        err.code === "rung-order-mismatch" &&
        err.path.endsWith(".rungOrder"),
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects rung in rungOrder missing from rungsUsed (session.ts:372)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          rungsUsed: ["workedExample"],
          rungOrder: ["workedExample", "explanation"],
          stoppedAt: "workedExample",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError &&
        err.code === "rung-order-mismatch" &&
        err.path.endsWith(".rungsUsed"),
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects non-boolean wentStraightToExplanation (session.ts:381)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          wentStraightToExplanation: "false" as unknown as boolean,
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "missing-went-straight",
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects wentStraightToExplanation when explanation is missing from rungsUsed (session.ts:390)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          wentStraightToExplanation: true,
          rungsUsed: ["transferCase"],
          rungOrder: ["transferCase"],
          stoppedAt: "transferCase",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "went-straight-contradiction",
    );
    const validStraight = {
      rungsUsed: ["explanation" as const],
      rungOrder: ["explanation" as const],
      wentStraightToExplanation: true,
      stoppedAt: "explanation" as const,
      transferCaseResolved: true,
    };
    assert.doesNotThrow(() => validateSupportLadderUsage(validStraight));
  });

  it("rejects wentStraightToExplanation when prior ladder rungs were used (session.ts:399)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          wentStraightToExplanation: true,
          rungsUsed: ["workedExample", "explanation"],
          rungOrder: ["workedExample", "explanation"],
          stoppedAt: "explanation",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "went-straight-contradiction",
    );
    const validStraight = {
      rungsUsed: ["explanation" as const],
      rungOrder: ["explanation" as const],
      wentStraightToExplanation: true,
      stoppedAt: "explanation" as const,
      transferCaseResolved: true,
    };
    assert.doesNotThrow(() => validateSupportLadderUsage(validStraight));
  });

  it("rejects invalid stoppedAt rung (session.ts:409)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          stoppedAt: "unknownRung",
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "invalid-stopped-at",
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects stoppedAt rung not present in rungsUsed (session.ts:417)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          rungsUsed: ["workedExample"],
          rungOrder: ["workedExample"],
          stoppedAt: "explanation",
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "stopped-at-not-used",
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });

  it("rejects non-boolean transferCaseResolved (session.ts:425)", () => {
    assert.throws(
      () =>
        validateSupportLadderUsage({
          ...BASE_VALID_LADDER,
          transferCaseResolved: 1 as unknown as boolean,
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "missing-transfer-case",
    );
    assert.doesNotThrow(() => validateSupportLadderUsage(BASE_VALID_LADDER));
  });
});

describe("validateSupportDefaultChange refusal throw sites", () => {
  it("rejects non-object default change record (session.ts:446)", () => {
    assert.throws(
      () => validateSupportDefaultChange(undefined),
      (err: unknown) =>
        err instanceof SessionValidationError &&
        err.code === "invalid-record" &&
        err.path === "SupportDefaultChangeRecord",
    );
    assert.doesNotThrow(() => validateSupportDefaultChange(BASE_VALID_DEFAULT_CHANGE));
  });

  it("rejects empty stageId (session.ts:454)", () => {
    assert.throws(
      () =>
        validateSupportDefaultChange({
          ...BASE_VALID_DEFAULT_CHANGE,
          stageId: "  ",
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-stage-id",
    );
    assert.doesNotThrow(() => validateSupportDefaultChange(BASE_VALID_DEFAULT_CHANGE));
  });

  it("rejects invalid previousDefaultRung (session.ts:458)", () => {
    assert.throws(
      () =>
        validateSupportDefaultChange({
          ...BASE_VALID_DEFAULT_CHANGE,
          previousDefaultRung: "notARung",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "invalid-previous-default",
    );
    assert.doesNotThrow(() => validateSupportDefaultChange(BASE_VALID_DEFAULT_CHANGE));
  });

  it("rejects invalid newDefaultRung (session.ts:466)", () => {
    assert.throws(
      () =>
        validateSupportDefaultChange({
          ...BASE_VALID_DEFAULT_CHANGE,
          newDefaultRung: "notARung",
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "invalid-new-default",
    );
    assert.doesNotThrow(() => validateSupportDefaultChange(BASE_VALID_DEFAULT_CHANGE));
  });

  it("rejects identical previous and new default rung (session.ts:474)", () => {
    assert.throws(
      () =>
        validateSupportDefaultChange({
          ...BASE_VALID_DEFAULT_CHANGE,
          previousDefaultRung: "explanation",
          newDefaultRung: "explanation",
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "identical-default-rung",
    );
    assert.doesNotThrow(() => validateSupportDefaultChange(BASE_VALID_DEFAULT_CHANGE));
  });

  it("rejects empty justifyingRoundIds (session.ts:482)", () => {
    assert.throws(
      () =>
        validateSupportDefaultChange({
          ...BASE_VALID_DEFAULT_CHANGE,
          justifyingRoundIds: [],
        }),
      (err: unknown) =>
        err instanceof SessionValidationError && err.code === "missing-justifying-round-ids",
    );
    assert.doesNotThrow(() => validateSupportDefaultChange(BASE_VALID_DEFAULT_CHANGE));
  });

  it("rejects empty string in justifyingRoundIds (session.ts:492)", () => {
    assert.throws(
      () =>
        validateSupportDefaultChange({
          ...BASE_VALID_DEFAULT_CHANGE,
          justifyingRoundIds: ["  "],
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "invalid-round-id",
    );
    assert.doesNotThrow(() => validateSupportDefaultChange(BASE_VALID_DEFAULT_CHANGE));
  });

  it("rejects invalid changeDate format (session.ts:501)", () => {
    assert.throws(
      () =>
        validateSupportDefaultChange({
          ...BASE_VALID_DEFAULT_CHANGE,
          changeDate: "2027/04/13",
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "invalid-change-date",
    );
    assert.doesNotThrow(() => validateSupportDefaultChange(BASE_VALID_DEFAULT_CHANGE));
  });

  it("rejects missing rationale (session.ts:509)", () => {
    assert.throws(
      () =>
        validateSupportDefaultChange({
          ...BASE_VALID_DEFAULT_CHANGE,
          rationale: "  ",
        }),
      (err: unknown) => err instanceof SessionValidationError && err.code === "missing-rationale",
    );
    assert.doesNotThrow(() => validateSupportDefaultChange(BASE_VALID_DEFAULT_CHANGE));
  });
});
