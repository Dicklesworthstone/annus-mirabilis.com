/**
 * Numeric parts of the exercise checker (am-disc-exercise-checker-i4h2). The reader types a value
 * and picks a unit; the value is converted to SI through the unit adapters (src/units/adapters.ts)
 * and compared with a reference computed at build time by a named reference evaluator, through
 * withinTolerance (src/units/tolerance.ts). A miss is described by its ratio to the reference: a
 * declared common slip names its likely cause, and a factor near a power of ten is put in words.
 *
 * The reference is a number the page carries, not an answer string, together with its quantity,
 * constant set, owner and execution label. referenceFromEvaluation refuses, with a code, an
 * evaluation that is not a value, so a page whose authored reference is outside-domain or
 * underdetermined fails the build instead of shipping a checker with nothing to check against.
 */
import { convertValue, listUnitsInFamily } from "../../units/adapters.ts";
import { exponentialParts } from "../../units/scientific.ts";
import { withinTolerance } from "../../units/tolerance.ts";

export interface NumericReference {
  /** In the family's base SI unit. */
  readonly value: number;
  readonly quantityId: string;
  readonly constantSetId: string;
  readonly owner: string;
  readonly executionLabel: "Ideal model, host calculation";
}

export interface CommonSlip {
  /** The ratio of the reader's value to the reference that this slip produces. */
  readonly factor: number;
  readonly message: string;
}

export interface NumericExercisePart {
  readonly id: string;
  readonly prompt: string;
  readonly workedExplanation: string;
  /** A unit family from the adapters, for example "length". */
  readonly family: string;
  /** Accepted units, all in the family; the first is the default choice. */
  readonly units: readonly string[];
  readonly reference: NumericReference;
  readonly tolerance: Readonly<{ absolute: number; relative: number }>;
  /** Why this tolerance: what agreement the question can honestly ask for. */
  readonly toleranceReason: string;
  readonly commonSlips?: readonly CommonSlip[];
}

export type NumericVerdict =
  | Readonly<{ kind: "input-error"; message: string }>
  | Readonly<{ kind: "agrees"; message: string }>
  | Readonly<{ kind: "slip"; message: string; ratio: number }>
  | Readonly<{ kind: "differs"; message: string; ratio: number }>;

/** A reference evaluation that did not produce a value. The code lets a test name the refusal. */
export class ExerciseReferenceError extends Error {
  readonly code: "exercise-reference-not-a-value";
  constructor(code: ExerciseReferenceError["code"], message: string) {
    super(message);
    this.name = "ExerciseReferenceError";
    this.code = code;
  }
}

/**
 * The reference for a numeric part, from a reference evaluator's typed result. Anything but a
 * finite value is refused, which fails the build of the page that computes it.
 */
export function referenceFromEvaluation(
  result: Readonly<{ status: string; value?: unknown; quantityId?: string }>,
  context: Readonly<{ constantSetId: string; owner: string; exerciseId: string }>,
): NumericReference {
  // A value that is an array of samples is not one number to check an answer against either.
  if (
    result.status !== "value" ||
    typeof result.value !== "number" ||
    !Number.isFinite(result.value)
  )
    throw new ExerciseReferenceError(
      "exercise-reference-not-a-value",
      `Exercise ${context.exerciseId}: the reference from ${context.owner} is ${result.status}, not a value, so there is nothing to check an answer against.`,
    );
  return Object.freeze({
    value: result.value,
    quantityId: result.quantityId ?? "unknown",
    constantSetId: context.constantSetId,
    owner: context.owner,
    executionLabel: "Ideal model, host calculation",
  });
}

/** How a unit is written for a reader: the adapters' ASCII "um" is μm. */
export function unitLabel(unit: string): string {
  return unit === "um" ? "μm" : unit.replace("*", "·");
}

/** A value as a reader would write it: at most four significant figures, powers of ten as ×10^. */
function shown(value: number, figures = 4): string {
  const parts = exponentialParts(Number(value.toPrecision(figures)));
  return parts.kind === "plain" ? parts.text : `${parts.mantissa} × 10^${parts.exponent}`;
}

const TENS: Readonly<Record<number, readonly [string, string]>> = {
  1: ["ten times", "a tenth of"],
  2: ["a hundred times", "a hundredth of"],
  3: ["a thousand times", "a thousandth of"],
  6: ["a million times", "a millionth of"],
  9: ["a billion times", "a billionth of"],
  12: ["a trillion times", "a trillionth of"],
};

/** Reads a typed number: 0.79, 7.9e-1 or −0.79. Returns a message instead of a number. */
function readValue(raw: string): number | string {
  const text = raw.trim().replace(/−/g, "-");
  if (text === "") return "Enter a number, for example 0.79.";
  if (/^\d*,\d+$/.test(text)) return "Use a point for decimals, for example 0.79.";
  if (/^[+-]?\.\d/.test(text)) return "Put a digit before the point, for example 0.79.";
  if (!/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text))
    return "Enter a plain number such as 0.79 or 7.9e-1, and choose the unit from the list.";
  const value = Number(text);
  return Number.isFinite(value) ? value : "That number is too large to compare.";
}

/** The part's base SI unit: the family member whose factor is exactly one. */
function baseUnit(family: string): string | null {
  const base = listUnitsInFamily(family).find((u) => u.factor.num === 1n && u.factor.den === 1n);
  return base ? base.unit : null;
}

/** Checks a part's authored settings; returns the problems, empty when the part is usable. */
export function numericPartProblems(part: NumericExercisePart): readonly string[] {
  const problems: string[] = [];
  const family = new Set(listUnitsInFamily(part.family).map((u) => u.unit));
  if (!baseUnit(part.family)) problems.push(`Unknown unit family ${part.family}.`);
  if (part.units.length === 0) problems.push("List at least one accepted unit.");
  for (const unit of part.units)
    if (!family.has(unit)) problems.push(`${unit} is not a ${part.family} unit.`);
  if (!Number.isFinite(part.reference.value)) problems.push("The reference is not a number.");
  if (!(part.tolerance.relative > 0 && part.tolerance.relative < 1))
    problems.push("The relative tolerance must lie between 0 and 1.");
  if (!(part.tolerance.absolute >= 0)) problems.push("The absolute tolerance must be at least 0.");
  for (const slip of part.commonSlips ?? [])
    if (!(Number.isFinite(slip.factor) && slip.factor > 0) || !slip.message.trim())
      problems.push("Each common slip needs a positive factor and a message.");
  return problems;
}

/** The ratio in words: "about a thousand times the reference", or "0.62 times the reference". */
function ratioSentence(ratio: number): string {
  if (ratio < 0) return "Your value has the opposite sign to the reference.";
  if (ratio === 0) return "Your value is zero, and the reference is not.";
  const exponent = Math.round(Math.log10(ratio));
  const words = TENS[Math.abs(exponent)];
  const nearPower = withinTolerance(ratio, 10 ** exponent, { relative: 0.05 }).ok;
  if (words && nearPower)
    return `Your value is about ${exponent > 0 ? `${words[0]} the reference` : `${words[1]} the reference`}. A factor that size usually comes from a unit or a power of ten, so check both.`;
  return `Your value is ${shown(ratio, 2)} times the reference.`;
}

/** Checks a typed value in a chosen unit against the part's reference. Nothing throws. */
export function checkNumericAnswer(
  part: NumericExercisePart,
  rawValue: string,
  unit: string,
): NumericVerdict {
  if (numericPartProblems(part).length > 0)
    return { kind: "input-error", message: "This exercise's settings are invalid." };
  if (!part.units.includes(unit))
    return { kind: "input-error", message: "Choose a unit from the list." };
  const value = readValue(typeof rawValue === "string" ? rawValue.slice(0, 64) : "");
  if (typeof value === "string") return { kind: "input-error", message: value };
  const base = baseUnit(part.family) as string;
  const si = convertValue(value, unit, base);
  const reference = part.reference.value;
  const inChosenUnit = convertValue(reference, base, unit);
  const referenceText = `${shown(inChosenUnit)} ${unitLabel(unit)}`;
  const compared = withinTolerance(si, reference, part.tolerance);
  if (compared.ok)
    return {
      kind: "agrees",
      message: `This agrees with the reference, ${referenceText}, within ${shown(part.tolerance.relative * 100, 2)} percent. ${part.reference.executionLabel}.`,
    };
  const ratio = si / reference;
  const slip = (part.commonSlips ?? []).find(
    (s) => withinTolerance(ratio, s.factor, { relative: part.tolerance.relative }).ok,
  );
  if (slip)
    return {
      kind: "slip",
      ratio,
      message: `Your value is ${shown(ratio, 3)} times the reference. ${slip.message}`,
    };
  return { kind: "differs", ratio, message: ratioSentence(ratio) };
}
