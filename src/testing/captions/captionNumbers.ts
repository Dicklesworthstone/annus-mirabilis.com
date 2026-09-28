/**
 * DO THE NUMBERS IN AN INSTRUMENT'S CAPTION APPEAR IN ITS WORKED EXAMPLE? (am-83lc)
 *
 * WHICH HALF OF THE QUESTION THIS ANSWERS, stated first because the other half is the larger one.
 * It answers: does this printed number occur among the values the instrument's generated example
 * actually holds, at the precision the caption prints it to. It does NOT answer whether the number
 * is the right one for the sentence it sits in, whether the example itself is correct, or whether a
 * number the example lacks is wrong. A caption could quote a real value of the instrument in a
 * sentence that misdescribes it and pass here.
 *
 * THE POPULATION IS A RULE, NOT AN ALLOWLIST. Three rules decide what is looked at, and none of them
 * names a lab, a phrase or a value, so none of them can absorb an awkward case:
 *
 *   1. A NUMBER IS A LITERAL WITH A DECIMAL POINT OR AN EXPONENT. That is am-83lc's own counting
 *      rule, and it excludes by construction the things a caption states that are not results:
 *      years (1905), step and path counts (16 paths, 2000 walkers), section numbers, and the
 *      integer coefficients of an algebraic identity.
 *   2. A NUMBER WITH FEWER THAN THREE SIGNIFICANT DIGITS IS TOO COARSE TO DISCRIMINATE. Against an
 *      example holding a few dozen scalars, a two-digit match is arithmetic coincidence rather than
 *      evidence, and counting it as judged would inflate the coverage this check reports. These are
 *      excluded, counted, and reported as excluded rather than as passed.
 *   3. ONLY SCALARS ARE MATCHED AGAINST. An example's array-valued results hold thousands of
 *      numbers, and a three-digit literal matches one of those by coincidence nearly always, so a
 *      match there would prove nothing. A caption number that occurs only inside a profile is
 *      reported unjudged.
 *
 * A NUMBER THE EXAMPLE DOES NOT CONTAIN IS UNJUDGED, NOT PASSED. The counts are reported with their
 * denominator on every run, because a check that judges a fraction of its population and prints one
 * word is indistinguishable from one that judges all of it.
 *
 * PRECISION IS THE QUESTION, so the comparison is at the caption's own printed precision: half a
 * unit in its last printed digit, through withinTolerance from src/units/tolerance.ts rather than a
 * hand-rolled difference. A value carrying more digits than the caption prints is a match; one that
 * rounds differently at the caption's precision is not.
 *
 * MAGNITUDE IS NOT COMPARED, and this is the check's sharpest limitation. A caption writes
 * "1.25 μm^2/s" where the example holds 1.25e-12 m^2/s, so the comparison is between SIGNIFICANDS
 * and the decimal exponent is ignored. A caption that quoted the right digits at the wrong scale
 * would pass. Closing that needs the caption's unit, which the records do not carry.
 */
import { withinTolerance } from "../../units/tolerance.ts";

/** A literal with a decimal point or an exponent. Rule 1. */
export const CAPTION_NUMBER = /\d+\.\d+(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+/g;

/** Below this, a match is coincidence rather than evidence. Rule 2. */
export const MIN_SIGNIFICANT_DIGITS = 3;

/** How many digits a literal prints, leading zeros excluded, so "0.0625" is three and "1.250" four. */
export function significantDigits(literal: string): number {
  const mantissa = literal.replace(/[eE][+-]?\d+$/, "").replace(".", "");
  return mantissa.replace(/^0+/, "").length;
}

/** A value's digits without its decimal exponent: 9.865e-13 and 0.9865 both give 9.865. */
export function significandOf(value: number): number {
  const magnitude = Math.abs(value);
  if (!Number.isFinite(magnitude) || magnitude === 0) return 0;
  return magnitude / 10 ** Math.floor(Math.log10(magnitude));
}

export type CaptionVerdict = Readonly<{
  /** Literals matching rule 1. */
  population: number;
  /** Of those, the ones rule 2 excludes, with the literals for a reader of a failing run. */
  tooCoarse: readonly string[];
  /** Of the rest, the ones an example scalar carries at the caption's precision. */
  judged: readonly string[];
  /** Of the rest, the ones no example scalar carries. Reported, never failed on its own. */
  unjudged: readonly string[];
}>;

/**
 * Judge one caption's numbers against one example's scalar values. `scalars` is the example's
 * declared parameters and its scalar results; an array-valued result contributes nothing (rule 3).
 */
export function judgeCaptionNumbers(text: string, scalars: readonly number[]): CaptionVerdict {
  const references = scalars.filter((n) => Number.isFinite(n)).map(significandOf);
  const tooCoarse: string[] = [];
  const judged: string[] = [];
  const unjudged: string[] = [];
  for (const match of text.matchAll(CAPTION_NUMBER)) {
    const literal = match[0];
    const digits = significantDigits(literal);
    if (digits < MIN_SIGNIFICANT_DIGITS) {
      tooCoarse.push(literal);
      continue;
    }
    const printed = significandOf(Number(literal));
    // Half a unit in the caption's last printed digit, on a significand in [1, 10).
    const absolute = 0.5 * 10 ** -(digits - 1);
    const found = references.some(
      (reference) => withinTolerance(reference, printed, { absolute }).ok,
    );
    (found ? judged : unjudged).push(literal);
  }
  return {
    population: tooCoarse.length + judged.length + unjudged.length,
    tooCoarse,
    judged,
    unjudged,
  };
}

/** One line carrying every count beside its denominator, for the run log and a failing message. */
export function summarizeCaptionVerdict(label: string, verdict: CaptionVerdict): string {
  return (
    `${label}: ${verdict.population} numbers, ${verdict.tooCoarse.length} excluded as too coarse, ` +
    `${verdict.judged.length} judged, ${verdict.unjudged.length} unjudged`
  );
}
