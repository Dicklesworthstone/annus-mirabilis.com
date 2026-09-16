/**
 * Typed scoring of a recorded prediction (am-inst-predict-mode-ti7m).
 * Statuses are about the relation, never about the person. A form the
 * model cannot compare is `undetermined`, never a pass.
 */
import { withinTolerance } from "../../units/tolerance.ts";
import type { PredictionChoice } from "./predictState.ts";

export const PREDICT_SCORE_STATUSES = ["match", "close", "not-close", "undetermined"] as const;
export type PredictScoreStatus = (typeof PREDICT_SCORE_STATUSES)[number];

export type PredictAdjudication = Readonly<{
  status: PredictScoreStatus;
  /** Ordinary-language note about the relation. Never addresses the reader as having failed. */
  statement: string;
}>;

export type AdjudicationSpec = Readonly<{
  choice: PredictionChoice | null;
  supportedCandidateId?: string | null;
  expectedValues?: readonly Readonly<{ targetId: string; value: number }>[];
  closeRelative?: number;
  supportedVerbal?: Readonly<{ directionId: string; shapeId: string }> | null;
}>;

const UNDETERMINED_NO_RECORD: PredictAdjudication = Object.freeze({
  status: "undetermined",
  statement: "This prediction cannot be scored here: nothing was recorded to compare.",
});

const UNDETERMINED_SKETCH: PredictAdjudication = Object.freeze({
  status: "undetermined",
  statement:
    "This prediction cannot be scored here: a freehand sketch is not compared with the model.",
});

const UNDETERMINED_NO_SUPPORT: PredictAdjudication = Object.freeze({
  status: "undetermined",
  statement:
    "This prediction cannot be scored here: the model does not name a supported candidate for this prompt.",
});

export function adjudicatePrediction(spec: AdjudicationSpec): PredictAdjudication {
  const { choice } = spec;
  if (choice === null) return UNDETERMINED_NO_RECORD;
  if (choice.form === "sketch") return UNDETERMINED_SKETCH;
  if (choice.form === "candidate") {
    const supported = spec.supportedCandidateId;
    if (!supported) return UNDETERMINED_NO_SUPPORT;
    if (choice.candidateId === supported) {
      return Object.freeze({
        status: "match",
        statement: "This is the relation the model supports.",
      });
    }
    return Object.freeze({
      status: "not-close",
      statement: "This is not the relation the model supports.",
    });
  }
  if (choice.form === "verbal") {
    const supported = spec.supportedVerbal;
    if (!supported) {
      return Object.freeze({
        status: "undetermined",
        statement:
          "This prediction cannot be scored here: no supported direction and shape are named for this prompt.",
      });
    }
    if (choice.directionId === supported.directionId && choice.shapeId === supported.shapeId) {
      return Object.freeze({
        status: "match",
        statement: "This is the relation the model supports.",
      });
    }
    return Object.freeze({
      status: "not-close",
      statement: "This is not the relation the model supports.",
    });
  }
  const expected = spec.expectedValues;
  if (!expected || expected.length === 0) {
    return Object.freeze({
      status: "undetermined",
      statement: "This prediction cannot be scored here: no named values are given to compare.",
    });
  }
  const closeRelative = spec.closeRelative ?? 0.05;
  let allExact = true;
  let allClose = true;
  for (const target of expected) {
    const hit = choice.targets.find((t) => t.targetId === target.targetId);
    if (!hit) {
      allExact = false;
      allClose = false;
      break;
    }
    if (hit.value !== target.value) allExact = false;
    const verdict = withinTolerance(hit.value, target.value, {
      relative: closeRelative,
      relativeTo: "larger",
      absolute: 1e-18,
    });
    if (!verdict.ok) allClose = false;
  }
  if (allExact) {
    return Object.freeze({
      status: "match",
      statement: "The typed values match the model's values.",
    });
  }
  if (allClose) {
    return Object.freeze({
      status: "close",
      statement: "The typed values are close to the model's values.",
    });
  }
  return Object.freeze({
    status: "not-close",
    statement: "The typed values are not close to the model's values.",
  });
}
