/**
 * THE MAP FROM AN AUTHORED CONTROL-TAPE RECORD TO A PERMALINK TAPE (am-3zt7).
 *
 * Two tape types meet here, and until now nothing carried a value across the seam.
 *
 *   - `src/experiments/tapes/schema.ts` is the CONTROL TAPE: the authored record under
 *     `content/experiments/tapes/`, written by an editor, reviewed as content.
 *   - `src/experiments/permalink/types.ts` is the PERMALINK TapeV2: what a `?tape=` link carries
 *     through a bounded URL and what `checkTapeCompatibility` judges.
 *
 * THE TYPE DECISION, AND ITS REASON. `modelVersion` is a string on the control-tape side and a
 * finite number on the permalink side, and it STAYS that way on both. This is a decision about
 * what each side is for, not a formatting preference:
 *
 *   - The control-tape record is authored prose-adjacent content. An editor pinning a walkthrough
 *     to a model may legitimately need to write `"1.2.0"`, or a date, or a revision that is not an
 *     integer. Narrowing the record to a number would forbid a version scheme the edition has not
 *     chosen yet, to buy nothing the record needs.
 *   - The permalink tape is a wire format inside a URL with a hard length bound, compared field by
 *     field with `!==`. A number is compact, has one spelling, and cannot be quoted by accident.
 *     Widening it to `string | number` would reintroduce exactly the defect am-w3g8 records, where
 *     a refusal named two values that print identically.
 *
 * So the boundary is crossed HERE, once, explicitly, and a version that cannot cross it is refused
 * by name rather than coerced. All 22 authored records write `"1"` and every laboratory binding
 * writes `1`, so this conversion is the whole of that difference.
 *
 * WHAT THIS DOES NOT DO, WHICH IS THE POINT. It does not reconcile the record's identity against
 * any laboratory's environment. `draftTapeForSettings` builds a tape from the BINDING and carries
 * only the walkthrough's opening settings, which is honest for opening a laboratory at a setting
 * and is not a replay. This function is the other half: it carries what the AUTHOR recorded, so
 * that `checkTapeCompatibility` can answer the real question. When the answer is a refusal, the
 * refusal is the finding, and silently substituting the laboratory's own identity to obtain a
 * compatible tape would destroy the only evidence that the record and the instrument disagree.
 */

import type { ControlTapeV2, TapeEventEntry } from "../tapes/schema.ts";
import { TapeValidationError, validateTapeV2 } from "./schema.ts";
import type { TapeControlEvent, TapePredictionEvent, TapeV2 } from "./types.ts";

export type ControlTapeConversion =
  | Readonly<{ kind: "converted"; tape: TapeV2 }>
  | Readonly<{ kind: "unconvertible"; field: string; reason: string; repair: string }>;

/** A canonical non-negative integer, the only string a permalink `modelVersion` can represent
 *  without losing information. `"01"`, `"1.0"`, `"v1"` and `"1.2.0"` are all refused: each either
 *  has a second spelling or is not a number at all. */
const CANONICAL_INTEGER = /^(?:0|[1-9]\d*)$/;

function unconvertible(field: string, reason: string, repair: string): ControlTapeConversion {
  return Object.freeze({ kind: "unconvertible" as const, field, reason, repair });
}

/** The record's mixed event list, split into the two the permalink tape keeps apart. */
function isControl(e: TapeEventEntry): e is Extract<TapeEventEntry, { kind: "control" }> {
  return e.kind === "control";
}

export function permalinkTapeFromControlTape(record: ControlTapeV2): ControlTapeConversion {
  const version = record.modelIdentity.modelVersion;
  if (!CANONICAL_INTEGER.test(version))
    return unconvertible(
      "modelIdentity.modelVersion",
      `The record's model version is ${JSON.stringify(version)}, which a shared link cannot carry: a link records the version as a number, and this one has no unambiguous numeric spelling.`,
      "Record the model version as a plain non-negative integer, or extend the permalink tape to carry a version string and update every laboratory binding with it.",
    );

  const checkpoint = record.checkpoints.at(-1);
  if (!checkpoint)
    return unconvertible(
      "checkpoints",
      "The record carries no checkpoint, so there is no accepted state for the link to name.",
      "Record at least one checkpoint, or open the laboratory at the tape's settings instead of linking to a recorded state.",
    );

  const predictions: TapePredictionEvent[] = [];
  for (const e of record.events) {
    if (e.kind !== "prediction") continue;
    const p = e.payload;
    // `candidate` and `sketch` carry the same information on both sides. `verbal` and `values` do
    // not: the record names a direction and a shape, or a list of target ids, where the link wants
    // a choice index and a list of number pairs. There is no faithful map, so this refuses rather
    // than inventing an index the author never chose.
    if (p.form === "candidate")
      predictions.push({
        promptId: e.promptId,
        form: "candidate",
        payload: { candidateId: p.candidateId },
      });
    else if (p.form === "sketch")
      predictions.push({ promptId: e.promptId, form: "sketch", payload: { points: p.points } });
    else
      return unconvertible(
        `events[${e.actionIndex}].payload`,
        `A ${p.form} prediction names its answer in terms a shared link does not carry: the record identifies it by name, and the link carries an index.`,
        "Record this prediction as a candidate or a sketch, or extend the permalink prediction payload to carry the named form.",
      );
  }

  const events: TapeControlEvent[] = record.events.filter(isControl).map((e) => ({
    actionIndex: e.actionIndex,
    commandClass: e.commandClass,
    paramId: e.parameterId,
    value: e.value,
    ...(e.previousValue === undefined ? {} : { previousValue: e.previousValue }),
  }));

  const tape: TapeV2 = {
    tapeVersion: 2,
    experimentId: record.experimentId,
    mode: record.mode,
    modelIdentity: {
      modelId: record.modelIdentity.modelId,
      modelVersion: Number(version),
      artifactDigest: record.modelIdentity.artifactDigest,
    },
    constantSetId: record.constantSetId,
    seed: record.seed,
    streamVersion: record.streamVersion,
    allocationId: record.allocationId,
    ...(record.replayGrid === undefined ? {} : { replayGrid: record.replayGrid }),
    initialConditions: record.initialConditions,
    events,
    ...(predictions.length === 0 ? {} : { predictions }),
    teachingTapeRef: { tapeId: record.tapeId, stepIndex: 0 },
    acceptedCheckpoint: {
      acceptedActionIndex: checkpoint.actionIndex,
      // The control-tape record does not carry an input revision, and this does not invent one.
      // Compatibility never reads it; it names which accepted state a restore is resuming.
      acceptedInputRevision: 0,
      digest: checkpoint.digest,
    },
    ...(record.title === undefined ? {} : { title: record.title }),
    ...(record.description === undefined ? {} : { description: record.description }),
  };
  // THE OUTPUT IS CHECKED BY THE WIRE VALIDATOR ITSELF, not by a pattern copied here. A converter
  // that hands on a tape the permalink schema refuses has moved the failure downstream, where
  // `encodeTapePermalink` throws instead of refusing: measured 2026-09-28, 10 of the 22 authored
  // records carry a descriptive checkpoint digest ("host:sha256:sr10-evaluateSr10") that the
  // control-tape schema accepts and the permalink schema does not, because it requires hex. Calling
  // the real validator means the two cannot drift apart, which a second copy of DIGEST_PATTERN here
  // would guarantee they eventually did.
  try {
    validateTapeV2(tape);
  } catch (error) {
    if (!(error instanceof TapeValidationError)) throw error;
    return unconvertible(
      error.path,
      `The record cannot be carried in a shared link: ${error.message}`,
      "Correct the field the message names in the authored record, or open the laboratory at the tape's settings instead of linking to a recorded state.",
    );
  }
  return Object.freeze({ kind: "converted" as const, tape: Object.freeze(tape) });
}
