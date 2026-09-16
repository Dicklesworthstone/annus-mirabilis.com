/**
 * The BM-01 viscosity comparison (am-bm-01-tracer-ensemble-hdly, "the viscosity comparison"
 * and preset `bm-01-viscosity-comparison`). Under a held seed, comparing two viscosities is
 * NEVER an independent trial: recordTracers keys its Philox stream only by (seed, kernel,
 * tile), never by the diffusivity, so the same seed draws the identical sequence of standard
 * normal steps for any viscosity. Positions differ only by the diffusivity's amplitude factor
 * sqrt(D), so every position scales by exactly sqrt(eta1 / eta2) -- common random numbers, the
 * technique that isolates the parameter's effect from sampling noise. This module's exported
 * label always says so, and it is a request-level error (`assertCommonRandomNumbers`, thrown as
 * an ordinary Error) to describe this comparison as an independent trial.
 */

import { getConstantSet } from "../../physics/reference/constants.ts";
import { stokesEinsteinD } from "../../physics/reference/diffusion/distributions.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { recordTracers, type TracerRecording } from "../../physics/reference/diffusion/tracers.ts";

export const COMPARISON_KIND = "common-random-numbers" as const;
export const COMPARISON_LABEL =
  "This comparison uses common random numbers to isolate the viscosity effect; it is not an independent trial.";

export type ViscosityComparisonInput = Readonly<{
  T: number;
  a: number;
  eta1: number;
  eta2: number;
  M: number;
  steps: number;
  h: number;
  seed: string;
}>;

export type ViscosityComparisonResult = Readonly<{
  comparisonKind: typeof COMPARISON_KIND;
  label: string;
  D1: number;
  D2: number;
  recording1: TracerRecording;
  recording2: TracerRecording;
  /** sqrt(D2 / D1), the exact factor every position in recording2 bears to recording1. */
  expectedRatio: number;
}>;

/** The comparison's exact ratio (sqrt(D2/D1) = sqrt(eta1/eta2)) does not depend on which
 * thermal constant is used, since it appears identically in both legs and cancels; this uses
 * the real registered `modern-si-2019` set rather than inventing a new one. A caller wanting
 * the historical constant set's own diffusivity value must supply it once that set is
 * registered (am-ref-constants-xik, still open) -- this module does not fabricate that set. */
function diffusivity(T: number, eta: number, a: number): number {
  const evaluation = stokesEinsteinD({ T, eta, a }, getConstantSet("modern-si-2019"));
  if (evaluation.result.status !== "value" || typeof evaluation.result.value !== "number") {
    throw new Error(`stokesEinsteinD did not return a scalar value: ${evaluation.result.status}`);
  }
  return evaluation.result.value;
}

/** Throws if a caller's own label affirmatively calls this an independent trial (as opposed to
 * denying it, which is exactly what `COMPARISON_LABEL` does); this is the assertion the bead
 * requires ("never called independent trials"), not a lint rule. */
export function assertCommonRandomNumbers(label: string): void {
  const claimsIndependentTrial = /independent trial/i.test(label);
  const deniesIndependentTrial = /\b(?:not|never|isn't|is not)\b[^.]*independent trial/i.test(
    label,
  );
  if (claimsIndependentTrial && !deniesIndependentTrial) {
    throw new Error(
      `A same-seed viscosity comparison must never be labeled an independent trial: "${label}"`,
    );
  }
}

export async function computeViscosityComparison(
  input: ViscosityComparisonInput,
): Promise<Computation<ViscosityComparisonResult>> {
  const D1 = diffusivity(input.T, input.eta1, input.a);
  const D2 = diffusivity(input.T, input.eta2, input.a);
  const setup = (D: number) => ({
    M: input.M,
    steps: input.steps,
    h: input.h,
    D,
    seed: input.seed,
  });

  const r1 = await recordTracers(setup(D1));
  if (r1.kind !== "accepted") return r1;
  const r2 = await recordTracers(setup(D2));
  if (r2.kind !== "accepted") return r2;

  assertCommonRandomNumbers(COMPARISON_LABEL);

  return {
    kind: "accepted",
    data: Object.freeze({
      comparisonKind: COMPARISON_KIND,
      label: COMPARISON_LABEL,
      D1,
      D2,
      recording1: r1.data,
      recording2: r2.data,
      expectedRatio: Math.sqrt(D2 / D1),
    }),
  };
}
