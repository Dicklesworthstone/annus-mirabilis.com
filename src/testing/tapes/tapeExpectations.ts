/**
 * DO THE NUMBERS A TAPE RECORDS MATCH WHAT ITS INSTRUMENT PRODUCES? (am-2rl9)
 *
 * WHICH HALF OF THE QUESTION THIS ANSWERS, stated first. A checkpoint may carry
 * `expectedDisplayValues`: the numbers its author says a reader will see at that point of the
 * walkthrough. The test that guarded them asserted the records were READABLE, so a tape whose every
 * number was wrong would have passed it. This answers: replayed through the instrument the tape
 * names, does the instrument produce this quantity with this value. It does NOT answer whether the
 * label describes the right quantity, whether the walkthrough's prose around it is true, or whether
 * an expectation the instrument does not produce is wrong rather than merely unbound.
 *
 * THE POPULATION IS PARTITIONED BY RULE, and no rule names a tape, an instrument or a value, so none
 * can absorb an awkward case:
 *
 *   1. AN INSTRUMENT WITH NO PERMALINK BINDING CANNOT BE DRIVEN. The bindings are discovered by
 *      walking `src/experiments/<lab>/tape.ts` for a `*_TAPE` export and keying each by the experiment id
 *      it declares. A tape naming an instrument with no such module has nothing to replay into, so
 *      its expectations are EXCLUDED, counted, and the instrument named.
 *   2. A RECORD THAT DOES NOT CONVERT TO A WIRE TAPE CANNOT BE REPLAYED. `loadWireTeachingTapes`
 *      reports why; measured 2026-09-28, ten records carry a placeholder `acceptedCheckpoint.digest`
 *      of the form `host:sha256:<name>` where the schema requires hex. Those expectations are
 *      EXCLUDED with the conversion problem quoted, not passed.
 *   3. A LABEL THAT IS NOT A PRODUCED QUANTITY ID IS UNJUDGED. An expectation is compared only when
 *      its label is the `quantityId` of an output the replayed instrument holds with
 *      `status: "value"`. Matching by value instead would let any output carrying the same number
 *      count as agreement, which for a value like 1.25 is arithmetic coincidence rather than
 *      evidence. An unmatched label is reported WITH the quantity ids the instrument did produce, so
 *      the report says what binding it would take to judge it, and it is never counted as passing.
 *
 * WHO COMPUTES THE COMPARISON VALUE. The instrument does. The expectation is compared against the
 * `outputs` of the accepted snapshot the instrument's own session reaches after the replay, each of
 * which names the owner that produced it (`ownerId`, for example `massEnergy.movingBalanceLight`).
 * Nothing here re-derives a physical quantity; a number recomputed inside this file would be a test
 * of this file.
 *
 * WHICH CHECKPOINT STATE, which is the trap that made this check report three false mismatches
 * before it reported none. A checkpoint's position in the array is NOT how many events precede it:
 * `the-move`, `ionization-bounds` and `lq-07-journey-stage-g` each carry ONE checkpoint whose
 * `actionIndex` is 1, so it is the state AFTER their single event. Driving the replay from the array
 * position leaves the instrument at the opening state, which for those three produced exactly half
 * the recorded value twice over and zero once, and read like three wrong records. The step therefore
 * comes from the checkpoint's own `actionIndex`: the permalink tape's `stepIndex` is the INCLUSIVE
 * index of the last event to apply, so it is `actionIndex - 1`, and `null` when no event precedes.
 *
 * TOLERANCE, NEVER EQUALITY, and never a hand-rolled difference: `withinTolerance` from
 * src/units/tolerance.ts. The bound is half a unit in the recorded value's own last significant
 * digit, so a record written to seven digits is held to seven. Every comparison here is of kind
 * `tolerance`; none is bitwise or formatted.
 *
 * AND IT CARRIES A FLOATING-POINT SLACK, because the half-unit rule alone is not always askable. A
 * record written to a full double's seventeen digits at a magnitude of 1e11 asks for a bound of about
 * 5e-5, which is finer than binary64's step at that magnitude; `validateToleranceSpec` refuses such a
 * spec as `absolute-below-resolution`, and an invalid spec is `ok: false`. So three expectations whose
 * recorded and produced values were IDENTICAL first read as disagreeing. The spec therefore pairs the
 * half-unit absolute with a small relative component, and the allowance a verdict reports is the one
 * the tolerance module resolved rather than the absolute alone.
 */
import { withinTolerance } from "../../units/tolerance.ts";

/** One `expectedDisplayValues` entry of a checkpoint. */
export type TapeExpectation = Readonly<{
  label: string;
  value: number;
  unit?: string | undefined;
  constantSetId?: string | undefined;
}>;

/** One output of an accepted snapshot. Only `status: "value"` carries a number to compare. */
export type ProducedOutput = Readonly<{
  quantityId: string;
  status: string;
  value?: unknown;
  ownerId?: string | undefined;
}>;

export type ExpectationVerdict =
  | Readonly<{
      kind: "judged";
      agrees: boolean;
      recorded: number;
      produced: number;
      /** The allowance the tolerance module resolved, so a failing run states its criterion. */
      allowed: number;
      /** withinTolerance's own verdict kind: `within`, `outside`, or a refused spec. */
      kindOfComparison: string;
      ownerId: string;
    }>
  | Readonly<{ kind: "unjudged"; reason: string; available: readonly string[] }>;

/**
 * How many digits a recorded value states. `0.7947833` is seven, `1.25` is three, `8` is one, and a
 * value carrying a full double's worth gives about seventeen. Leading zeros are not digits.
 */
export function significantDigitsOf(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 1;
  const mantissa = Math.abs(value)
    .toExponential()
    .replace(/e[+-]?\d+$/i, "")
    .replace(".", "");
  return mantissa.replace(/0+$/, "").replace(/^0+/, "").length || 1;
}

/**
 * Half a unit in the recorded value's last significant digit, as an ABSOLUTE bound on the value
 * itself. An exact zero gets a bound no recorded digit can supply, so it is held to a tight absolute
 * floor rather than to a relative one, which is undefined at zero.
 */
export function toleranceFor(value: number): number {
  if (value === 0) return 1e-12;
  const digits = significantDigitsOf(value);
  const magnitude = 10 ** Math.floor(Math.log10(Math.abs(value)));
  return 0.5 * magnitude * 10 ** -(digits - 1);
}

/**
 * A few units in the last place, as a relative companion to the absolute bound above. It exists so a
 * record carrying a full double's digits does not demand a finer absolute bound than binary64 offers
 * at its magnitude, which `validateToleranceSpec` refuses outright.
 */
export const FLOAT_SLACK = 1e-15;

/** The spec a recorded value is compared under: its own printed precision, or floating-point slack. */
export function specFor(value: number): Readonly<{ absolute: number; relative?: number }> {
  return value === 0
    ? { absolute: toleranceFor(0) }
    : { absolute: toleranceFor(value), relative: FLOAT_SLACK };
}

/** Rule 3, then the comparison. `produced` is the replayed snapshot's outputs. */
export function judgeExpectation(
  expectation: TapeExpectation,
  produced: readonly ProducedOutput[],
): ExpectationVerdict {
  const available = produced
    .filter((output) => output.status === "value" && typeof output.value === "number")
    .map((output) => output.quantityId);
  const match = produced.find(
    (output) =>
      output.quantityId === expectation.label &&
      output.status === "value" &&
      typeof output.value === "number",
  );
  if (!match)
    return {
      kind: "unjudged",
      reason: `the label "${expectation.label}" is not a quantity this instrument produces with a value`,
      available,
    };
  const producedValue = match.value as number;
  const verdict = withinTolerance(producedValue, expectation.value, specFor(expectation.value));
  return {
    kind: "judged",
    agrees: verdict.ok,
    recorded: expectation.value,
    produced: producedValue,
    // The allowance the tolerance module resolved, not this file's absolute component, so a failing
    // run states the criterion actually applied and a plant can be stepped by it.
    allowed: verdict.allowed,
    kindOfComparison: verdict.kind,
    ownerId: match.ownerId ?? "(unnamed owner)",
  };
}

/** The permalink `stepIndex` a checkpoint's own `actionIndex` implies. Null when no event precedes. */
export function stepIndexForActionIndex(actionIndex: number): number | null {
  return actionIndex > 0 ? actionIndex - 1 : null;
}

export type ExpectationTally = Readonly<{
  population: number;
  judged: number;
  disagreed: number;
  excluded: number;
  unjudged: number;
}>;

/** One line carrying every count beside its denominator, for the run log and a failing message. */
export function summarizeTally(label: string, tally: ExpectationTally): string {
  return (
    `${label}: ${tally.population} recorded expectations, ${tally.excluded} excluded by rule, ` +
    `${tally.judged} judged against the instrument (${tally.disagreed} disagreeing), ` +
    `${tally.unjudged} unjudged`
  );
}
