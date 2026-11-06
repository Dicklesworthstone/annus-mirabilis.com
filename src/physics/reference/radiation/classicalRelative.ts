/**
 * Relative consequences of the equal-shares allocation, U proportional to T nu_c^3.
 * The unspecified coefficient cancels. These functions read no constants, so the 1904
 * reconstruction can compare cutoffs without assigning an absolute energy or a numeric c.
 */
import type { RadiationOkResult, RadiationOutsideDomain } from "./types.ts";

export type ClassicalRelativeResult = RadiationOkResult<number> | RadiationOutsideDomain;

function refused(
  quantityId: string,
  condition: string,
  reason: string,
  domainKind: "input" | "numerical" = "input",
): RadiationOutsideDomain {
  return { status: "outside-domain", quantityId, unit: "1", condition, domainKind, reason };
}

function value(quantityId: string, result: number): RadiationOkResult<number> {
  return { status: "value", quantityId, unit: "1", value: result, linearRepresentable: true };
}

function positiveFinite(...inputs: readonly number[]): boolean {
  return inputs.every((input) => Number.isFinite(input) && input > 0);
}

/** U(T, cutoff) / U(referenceT, referenceCutoff), with no absolute normalization. */
export function classicalRelativeEnergy(
  T: number,
  cutoff: number,
  referenceT: number,
  referenceCutoff: number,
): ClassicalRelativeResult {
  const quantityId = "classicalEnergyRatio";
  if (!positiveFinite(T, cutoff, referenceT, referenceCutoff))
    return refused(
      quantityId,
      "nonpositive-allocation-input",
      "Both temperatures and both upper frequencies must be positive, finite numbers.",
    );

  // Prefer direct ratios when representable, preserving simple comparisons such as 2^3 = 8.
  // Log space also admits compensating extreme ratios without overflowing an intermediate cube.
  const direct = (T / referenceT) * (cutoff / referenceCutoff) ** 3;
  const ratio =
    Number.isFinite(direct) && direct > 0
      ? direct
      : Math.exp(
          Math.log(T) - Math.log(referenceT) + 3 * (Math.log(cutoff) - Math.log(referenceCutoff)),
        );
  if (!Number.isFinite(ratio) || ratio === 0)
    return refused(
      quantityId,
      "allocation-ratio-beyond-number-range",
      "The energy ratio is outside this calculation's number range. The absolute energy remains symbolic.",
      "numerical",
    );
  return value(quantityId, ratio);
}

/** Changing only the upper frequency by a positive factor changes the energy by its cube. */
export function classicalCutoffGrowth(factor: number): ClassicalRelativeResult {
  return classicalRelativeEnergy(1, factor, 1, 1);
}

/** The fraction of the finite-cutoff energy between a probe and that cutoff. */
export function classicalShareAboveProbe(cutoff: number, probe: number): ClassicalRelativeResult {
  const quantityId = "energyShareAboveProbe";
  if (!positiveFinite(cutoff, probe))
    return refused(
      quantityId,
      "nonpositive-frequency",
      "The upper frequency and the probe frequency must be positive, finite numbers.",
    );
  if (probe > cutoff)
    return refused(
      quantityId,
      "probe-above-cutoff",
      "The probe is above the upper frequency. Put the probe at or below that frequency to compare a share.",
    );
  if (probe === cutoff) return value(quantityId, 0);
  // expm1 preserves the small positive share when the probe lies just below the cutoff.
  // A ratio rounded to zero at extremely separated frequencies correctly rounds the share to one.
  const share = -Math.expm1(3 * Math.log(probe / cutoff));
  return value(quantityId, share);
}
