/**
 * Core types for the comprehension-testing protocol (am-edit-comprehension-protocol-ouih).
 *
 * Requirements:
 * - 5 Accomplishments (Appreciate, Explain, Predict, Derive, Critique) as non-hierarchical activities.
 * - 5 Support Ladder rungs (workedExample, partialComparison, prediction, explanation, transferCase).
 * - 6 Rubric dimensions (meaning, mechanism, prediction, assumptions, evidence, navigation).
 * - 5 Stumbling-point codes (undefined-symbol, omitted-inference, misleading-visual-cue, inaccessible-control, too-much-at-once).
 * - Session records storing accomplishments per-session, never against a person.
 * - Support-default changes requiring justifying round IDs.
 */

import type { ValidPaper, ValidRoute } from "../testing/docs/participantCodes.ts";

export const ACCOMPLISHMENTS = ["appreciate", "explain", "predict", "derive", "critique"] as const;

export type Accomplishment = (typeof ACCOMPLISHMENTS)[number];

export const SUPPORT_RUNGS = [
  "workedExample",
  "partialComparison",
  "prediction",
  "explanation",
  "transferCase",
] as const;

export type SupportRung = (typeof SUPPORT_RUNGS)[number];

export const RUBRIC_DIMENSIONS = [
  "meaning",
  "mechanism",
  "prediction",
  "assumptions",
  "evidence",
  "navigation",
] as const;

export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

export const STUMBLING_POINT_CODES = [
  "undefined-symbol",
  "omitted-inference",
  "misleading-visual-cue",
  "inaccessible-control",
  "too-much-at-once",
] as const;

export type StumblingPointCode = (typeof STUMBLING_POINT_CODES)[number];

export const RUBRIC_SCALE = ["unaided", "recovered", "prompted", "not-reached"] as const;

export type RubricValue = (typeof RUBRIC_SCALE)[number];

export const BARRIER_DISPOSITIONS = ["open", "fixed", "accepted"] as const;

export type BarrierDisposition = (typeof BARRIER_DISPOSITIONS)[number];

/**
 * A barrier observed in a round, with what the site is doing about it
 * (PROTOCOL.md sections 14 and 15).
 *
 * `met` and `resolved` are participant counts, never scores. A barrier is
 * recurrent when `met >= RECURRENT_BARRIER_THRESHOLD` in one round, or when the
 * same code and anchor appear in two or more reports; a recurrent or blocking
 * barrier must name the bead that tracks its repair, because "an issue was
 * logged" in prose is exactly the kind of evidence this project has been
 * burned by.
 */
export interface BarrierRecord {
  readonly code: StumblingPointCode;
  /** Passage anchor "#s<n>..." or action id "<instrument>:<action>". */
  readonly anchor: string;
  readonly met: number;
  readonly resolved: number;
  readonly blocking: boolean;
  readonly disposition: BarrierDisposition;
  /** Tracker id, required for a recurrent or blocking barrier and for every non-open disposition. */
  readonly bead?: string | undefined;
  /** The later round id that recorded no participant meeting this barrier. Required when fixed. */
  readonly verifiedBy?: string | undefined;
  /** Required when accepted: why the site will not repair it. */
  readonly reason?: string | undefined;
}

/** Participants meeting a barrier in one round, at or above which it is recurrent. */
export const RECURRENT_BARRIER_THRESHOLD = 2;

export interface AccomplishmentChange {
  readonly timestamp: string; // ISO 8601
  readonly from: Accomplishment;
  readonly to: Accomplishment;
  readonly reason?: string | undefined;
}

export interface SupportLadderUsage {
  readonly rungsUsed: readonly SupportRung[];
  readonly rungOrder: readonly SupportRung[];
  readonly wentStraightToExplanation: boolean;
  readonly stoppedAt: SupportRung;
  readonly transferCaseResolved: boolean;
}

export interface StumblingPointRecord {
  readonly code: StumblingPointCode;
  readonly target: string; // passage anchor "#s<n>..." or action id "<instrument>:<action>"
  readonly observation: string;
}

export interface StopRuleObservationRecord {
  readonly capabilityId: string;
  readonly obstacle: string;
  readonly participantsMet: number;
  readonly participantsResolved: number;
  readonly facilitatorNote: string;
}

export interface SessionRecord {
  readonly sessionId: string; // per-session code (e.g. "s-bm-20270412-01"), NEVER a person identifier
  readonly paper: ValidPaper | string;
  readonly route: ValidRoute | string;
  readonly argumentId: string;
  readonly facilitator: string; // facilitator ID from docs/OWNERS.md (no @ sign)
  readonly date: string; // YYYY-MM-DD
  readonly buildCommit: string;
  readonly initialAccomplishment: Accomplishment;
  readonly accomplishmentChanges: readonly AccomplishmentChange[];
  readonly currentAccomplishment: Accomplishment;
  readonly outcomeReached: boolean;
  readonly supportLadder: SupportLadderUsage;
  readonly stumblingPoints: readonly StumblingPointRecord[];
  readonly stopRuleObservations?: readonly StopRuleObservationRecord[] | undefined;
}

export interface SupportDefaultChangeRecord {
  readonly stageId: string;
  readonly previousDefaultRung: SupportRung;
  readonly newDefaultRung: SupportRung;
  readonly justifyingRoundIds: readonly string[]; // Must be non-empty!
  readonly changeDate: string;
  readonly rationale: string;
}

export interface AccomplishmentDefinition {
  readonly accomplishment: Accomplishment;
  readonly outcomeInRound: string;
  readonly whatMustRemainInReach: string;
}

export const ACCOMPLISHMENT_DEFINITIONS: readonly AccomplishmentDefinition[] = [
  {
    accomplishment: "appreciate",
    outcomeInRound:
      "The participant explains why the question mattered and what was surprising about the answer",
    whatMustRemainInReach: "A concrete example and the original passage",
  },
  {
    accomplishment: "explain",
    outcomeInRound:
      "The participant reconstructs the main reasoning in words, a picture, or a small table",
    whatMustRemainInReach: "Definitions, the assumptions in force, and a bridge to the symbols",
  },
  {
    accomplishment: "predict",
    outcomeInRound:
      "The participant anticipates how a specified change affects an observable, and says why",
    whatMustRemainInReach: "Units, a numerical example, and the model that applies",
  },
  {
    accomplishment: "derive",
    outcomeInRound: "The participant reproduces the mathematical steps and identifies each premise",
    whatMustRemainInReach:
      "Every intermediate step, any alternative derivation, and the printed notation",
  },
  {
    accomplishment: "critique",
    outcomeInRound:
      "The participant separates what follows, what is suggested, what has been measured, and what remains undetermined",
    whatMustRemainInReach: "Countermodels, uncertainty, primary sources, and later qualifications",
  },
];
