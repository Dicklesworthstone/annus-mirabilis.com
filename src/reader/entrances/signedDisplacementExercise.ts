/**
 * The 1904 desk's arithmetic exercise, using the first encounter's existing owner and examples.
 * Coordinates are chosen by the reader, not sampled from a physical model or called measurements.
 */
import { readTypedNumber } from "../../experiments/controls/typedNumber.ts";
import { makeRefusal, type RequestRefusal } from "../../experiments/results/refusals.ts";
import {
  AUTHORED_BROWNIAN_DISPLACEMENTS,
  calculateSignedDisplacements,
  describeDisplacementInWords,
  FOUR_ENTRY_BOUND,
  type SignedDisplacementTotals,
  scaleDisplacements,
} from "./signedDisplacements.ts";

/** Four integer squares and their sum remain exact within the exercise's declared range. */
export const SIGNED_DISPLACEMENT_LIMIT = 1_000_000;

export type SignedDisplacementRow = Readonly<{
  id: string;
  label: string;
  displacement: number;
  description: string;
  absolute: number;
  square: number;
}>;

export type SignedDisplacementSnapshot = Readonly<{
  entries: readonly number[];
  rows: readonly SignedDisplacementRow[];
  totals: Readonly<SignedDisplacementTotals>;
}>;

export type SignedDisplacementEvaluation =
  | Readonly<{ kind: "accepted"; data: SignedDisplacementSnapshot }>
  | Readonly<{ kind: "refused"; refusal: RequestRefusal; fieldIndex?: number }>;

function snapshot(entries: readonly number[]): SignedDisplacementSnapshot {
  const accepted = Object.freeze([...entries]);
  return Object.freeze({
    entries: accepted,
    rows: Object.freeze(
      accepted.map((displacement, index) => {
        const single = calculateSignedDisplacements([displacement]);
        return Object.freeze({
          id: `mark-${index + 1}`,
          label: `Mark ${index + 1}`,
          displacement,
          description: describeDisplacementInWords(displacement),
          absolute: single.meanAbsolute,
          square: single.meanSquare,
        });
      }),
    ),
    totals: Object.freeze(calculateSignedDisplacements(accepted)),
  });
}

/** Also used by the desk's server-rendered, reading-only worked example. */
export const DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT = snapshot(AUTHORED_BROWNIAN_DISPLACEMENTS);

function invalid(requirements: string, fieldIndex?: number): SignedDisplacementEvaluation {
  return {
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      {
        parameterIds:
          fieldIndex === undefined ? ["displacements"] : [`displacement-${fieldIndex + 1}`],
      },
      { details: { requirements }, rankedRepairs: [{ label: requirements }] },
    ),
    ...(fieldIndex === undefined ? {} : { fieldIndex }),
  };
}

/** Refuses an incomplete, nonfinite, fractional, or out-of-range example; never rounds or clamps. */
export function evaluateSignedDisplacements(input: unknown): SignedDisplacementEvaluation {
  if (!Array.isArray(input) || input.length !== FOUR_ENTRY_BOUND)
    return invalid("Enter exactly four signed displacements.");
  for (let index = 0; index < input.length; index++) {
    const value: unknown = input[index];
    if (typeof value !== "number" || !Number.isFinite(value))
      return invalid(`Enter mark ${index + 1}'s displacement as a finite whole number.`, index);
    if (!Number.isInteger(value))
      return invalid(
        `Use a whole number for mark ${index + 1}. This arithmetic exercise does not round fractional coordinates.`,
        index,
      );
    if (Math.abs(value) > SIGNED_DISPLACEMENT_LIMIT)
      return invalid(
        `Keep mark ${index + 1} between −1,000,000 and +1,000,000 exercise units so its square and the totals remain exact.`,
        index,
      );
  }
  return { kind: "accepted", data: snapshot(input as number[]) };
}

/** Text is kept as a draft until Apply, including blanks and partially entered numbers. */
export function evaluateSignedDisplacementDraft(draft: unknown): SignedDisplacementEvaluation {
  if (!Array.isArray(draft) || draft.length !== FOUR_ENTRY_BOUND)
    return invalid("Enter exactly four signed displacements.");
  const entries: number[] = [];
  for (let index = 0; index < draft.length; index++) {
    const text: unknown = draft[index];
    if (typeof text !== "string")
      return invalid(`Enter mark ${index + 1}'s displacement as a number.`, index);
    const checked = readTypedNumber(text, `mark ${index + 1}'s displacement`);
    if (checked.kind === "refused")
      return { kind: "refused", refusal: checked.refusal, fieldIndex: index };
    entries.push(checked.value);
  }
  return evaluateSignedDisplacements(entries);
}

/** Scale the accepted coordinates through the same arithmetic owner, then recheck their range. */
export function doubleSignedDisplacements(
  accepted: SignedDisplacementSnapshot,
): SignedDisplacementEvaluation {
  return evaluateSignedDisplacements(scaleDisplacements(accepted.entries, 2));
}
