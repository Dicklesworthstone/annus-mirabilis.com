import type { ParameterAction, ScientificResult } from "./types.ts";

/**
 * A reference owner that squares or multiplies a large input can hand back a "value" that is not a
 * finite number: E² − c²B² overflows once B passes about 10^146 T, and a 10^300 THz frequency is
 * already infinite in hertz. The store's decoder refuses a non-finite value, as the worker protocol
 * requires. Until 2026-09-23 sr-02, sr-09 and sr-12 threw that refusal out of the session's apply()
 * and nothing caught it, so a reader who typed a large number pressed Apply and saw nothing change:
 * the field showed the new number above the old results.
 *
 * This types each such output as outside-domain instead, so the finite outputs still publish beside
 * it (these sessions allow partial snapshots) and the reader is told why one quantity has no value.
 * It is a limit of the arithmetic, not of the physics, so the domain kind is numerical and the reason
 * makes no physical claim.
 *
 * The suggested repair names the candidate input with the largest magnitude, because that is the one
 * that overflowed: the others are ordinary values many orders of magnitude smaller.
 */
export type NumberRangeCandidate = Readonly<{
  parameterId: string;
  value: number;
  /** A value the reader can return to that is known to compute, usually the default. */
  admissible: number;
}>;

/* Worded for the calculation, not the quantity: sr-09's Doppler factor ν′/ν does not depend on the
   frequency (0.5 at the default speed and angle), and it has no value at 10^300 THz only because
   both frequencies overflowed (∞/∞). */
export const BEYOND_NUMBER_RANGE_REASON =
  "At these settings the calculation runs past the largest number it can represent. Choose a smaller value.";

function finite(value: number | Float64Array): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  for (const x of value) if (!Number.isFinite(x)) return false;
  return true;
}

export function refuseNonFiniteValues(
  outputs: readonly ScientificResult[],
  // Non-empty by type, so there is always an input to name: the refusal needs one to point at.
  candidates: readonly [NumberRangeCandidate, ...NumberRangeCandidate[]],
): ScientificResult[] {
  if (outputs.every((o) => o.status !== "value" || finite(o.value))) return [...outputs];
  const culprit = candidates.reduce(
    (best, c) => (Math.abs(c.value) > Math.abs(best.value) ? c : best),
    candidates[0],
  );
  const boundary: ParameterAction = { parameterId: culprit.parameterId, value: culprit.admissible };
  return outputs.map((o) =>
    o.status === "value" && !finite(o.value)
      ? {
          quantityId: o.quantityId,
          unit: o.unit,
          semanticKind: o.semanticKind,
          ownerId: o.ownerId,
          status: "outside-domain",
          condition: "result-beyond-number-range",
          domainKind: "numerical",
          reason: BEYOND_NUMBER_RANGE_REASON,
          boundary,
        }
      : o,
  );
}
