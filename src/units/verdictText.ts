/**
 * Reader-facing and diagnostic wording for tolerance and comparison verdicts.
 * (am-ver-precision-display-5e5)
 *
 * Consumes verdict objects from tolerance.ts and produces consistent wording.
 * NEVER implements its own comparison formulas.
 *
 * NO PRODUCTION MODULE IMPORTS THIS, AND NOBODY HAS REIMPLEMENTED IT EITHER (am-50bk, triaged
 * 2026-10-24). The verdicts are produced and consumed: `src/units/tolerance.ts` returns them and
 * `src/equations/derivations/spotCheck.ts` reads `verdict.ok`, `.kind`, `.diff` and `.allowed`
 * as fields, carrying them into its own typed result. No caller turns one into a sentence, here
 * or anywhere, so a tolerance comparison has no reader-facing wording at all.
 *
 * That makes this an unmounted capability rather than a twin, and it is worth saying which,
 * because "unused formatter" invites someone to delete it. The sentences AGENTS.md asks for are
 * precisely the distinctions these four functions keep apart: a probability confidence interval
 * is not an interval-arithmetic enclosure, and a numerical error bar is not a measurement
 * uncertainty. The wording above is diagnostic rather than reader-facing despite the first line
 * of this docblock, so whoever mounts it writes the reader's half against the editorial voice
 * and keeps these as the diagnostic forms.
 */

import type {
  BitwiseVerdict,
  ClassificationVerdict,
  RoundsToVerdict,
  ToleranceVerdict,
} from "./tolerance.ts";

export function formatToleranceVerdict(verdict: ToleranceVerdict): string {
  switch (verdict.kind) {
    case "within":
      return `within tolerance (diff: ${verdict.diff}, allowed: ${verdict.allowed})`;
    case "outside":
      return `outside tolerance (diff: ${verdict.diff}, allowed: ${verdict.allowed})`;
    case "invalid-spec": {
      const issueDetails = verdict.issues.map((i) => i.message).join("; ");
      return `invalid tolerance specification: ${issueDetails}`;
    }
    case "nonfinite-actual":
      return "actual value is non-finite (NaN or infinity)";
    case "nonfinite-reference":
      return "reference value is non-finite";
  }
}

export function formatBitwiseVerdict(verdict: BitwiseVerdict): string {
  switch (verdict.kind) {
    case "match":
      return `exact bitwise match (${verdict.detail})`;
    case "mismatch":
      return `bitwise mismatch (${verdict.detail})`;
    case "type-mismatch":
      return `type mismatch (${verdict.detail})`;
    case "length-mismatch":
      return `length mismatch (${verdict.detail})`;
  }
}

export function formatClassificationVerdict(verdict: ClassificationVerdict): string {
  switch (verdict.sign) {
    case "indeterminate":
      return `indeterminate within band of ${verdict.allowed}`;
    case "zero":
      return "exact zero";
    case "positive":
      return "positive";
    case "negative":
      return "negative";
  }
}

export function formatRoundsToVerdict(verdict: RoundsToVerdict): string {
  const { interval, convention } = verdict;
  if (verdict.ok) {
    return `rounds to ${interval.printedValue} under ${convention} (in [${interval.low}, ${interval.high}))`;
  }
  return `does not round to ${interval.printedValue} under ${convention} (in [${interval.low}, ${interval.high}))`;
}
