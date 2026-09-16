import { BM06_BUDGET, BM06_OUTPUTS } from "../../experiments/bm06/definition.ts";
import { decodeResult } from "../../experiments/results/codec.ts";
import {
  type ExecutionOutcomeId,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { getConstantSet } from "../../physics/reference/constants.ts";
import {
  gaussianPropagator,
  intervalProbability,
  moments,
  mostLikelyRadius2d,
  rmsDisplacement,
  stokesEinsteinD,
} from "../../physics/reference/diffusion/distributions.ts";
import {
  type Computation,
  ftcs1d,
  ftcsAdvance,
  ftcsAnalyticComparison,
} from "../../physics/reference/diffusion/ftcs.ts";

export type Bm06Evaluation = Readonly<{
  outputs: readonly ScientificResult[];
  stepIndex: number;
  simulationTime: number;
}>;
export type EvaluationControl = Readonly<{
  cancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
  /** Deterministic scientific steps per chunk, not a time budget. */
  chunkSteps?: number;
}>;

import { validateBm06Parameters } from "../../experiments/bm06/parameters.ts";

export { validateBm06Parameters } from "../../experiments/bm06/parameters.ts";

const gridKeys = [
  "gridDensity",
  "cellMasses",
  "cellProbabilities",
  "maxCellMassDifference",
  "wallContact",
  "stabilityRatio",
  "gridTimeStep",
] as const;
function outcome(id: Exclude<ExecutionOutcomeId, "budget-exhausted">): Computation<never> {
  return { kind: "outcome", outcome: { outcome: id, ...executionOutcomeRegistry[id] } };
}
function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}
function value(quantityId: string, value: number | Float64Array): ScientificResult {
  const c = BM06_OUTPUTS[quantityId];
  if (!c) throw new TypeError(`Undeclared output ${quantityId}`);
  return decodeResult({
    quantityId,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
    status: "value",
    value,
  });
}
function scalar(result: ScientificResult): number {
  if (result.status !== "value" || typeof result.value !== "number")
    throw new RangeError("The requested model quantity has no representable scalar value.");
  return result.value;
}
/** Carries an owner's typed status/value through under a different published quantity id, so
 * `moments(2, ...)` and `moments(3, ...)` -- which both use the dimension-independent ids
 * `meanRadialDistance`/`rmsRadialDistance` -- can be published as BM-06's own, distinct
 * `meanRadius2d`/`meanRadius3d` outputs without misattributing which owner produced the number. */
function rename(result: ScientificResult, quantityId: string): ScientificResult {
  const c = BM06_OUTPUTS[quantityId];
  if (!c) throw new TypeError(`Undeclared output ${quantityId}`);
  return decodeResult({
    ...result,
    quantityId,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
  });
}
/** All model numbers and sampled curves are assembled here, never in the React view. */
export async function evaluateBm06(
  input: unknown,
  control: EvaluationControl = {},
): Promise<Computation<Bm06Evaluation>> {
  const validated = validateBm06Parameters(input);
  if (validated.kind !== "accepted") return validated;
  const p = validated.data;
  const chunkSteps = control.chunkSteps ?? 64;
  if (!Number.isSafeInteger(chunkSteps) || chunkSteps < 1 || chunkSteps > 1024)
    return refused(["chunkSteps"], "Use 1–1024 scientific steps per chunk.");
  const cancelled = control.cancelled ?? (() => false);
  const yieldControl =
    control.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  if (cancelled()) return outcome("cancelled");
  const workUnits = p.gridEnabled ? p.n * (p.t === 0 ? 0 : p.steps) : 0;
  const allocationBytes = p.gridEnabled ? p.n * 64 + 8192 : 8192;
  if (workUnits > BM06_BUDGET.workUnits || allocationBytes > BM06_BUDGET.allocationBytes)
    return {
      kind: "outcome",
      outcome: {
        outcome: "budget-exhausted",
        ...executionOutcomeRegistry["budget-exhausted"],
        requested: { workUnits, allocationBytes },
        allowed: BM06_BUDGET,
      },
    };
  try {
    const diffusivity = stokesEinsteinD(p, getConstantSet("modern-si-2019")).result;
    // A copied D (recorded on the parameters, never a live subscription -- see
    // Bm06Parameters.copiedDiffusivityValue) replaces the model's own T/eta/a-derived value for
    // every downstream calculation. `diffusivity`/`diffusionCoefficient` keeps reporting what
    // T/eta/a alone would give, honestly attributed to stokesEinsteinD; `activeDiffusionCoefficient`
    // reports whichever value this run actually used.
    const modelD = scalar(diffusivity);
    const D = p.copiedDiffusivityValue > 0 ? p.copiedDiffusivityValue : modelD;
    const activeDiffusivity = value("activeDiffusionCoefficient", D);
    const rms = rmsDisplacement(D, p.t).result;
    const sigma = scalar(rms);
    const probability = intervalProbability(p.lower, p.upper, p.t, D).result;
    scalar(probability);
    // Fixed standardized sampling makes the curve independent of display size.
    const xs = Float64Array.from({ length: 81 }, (_, i) => (i / 10 - 4) * (sigma || 1e-6));
    const density =
      p.t === 0
        ? gaussianPropagator(0, 0, D).result
        : value(
            "probabilityDensity",
            Float64Array.from(xs, (x) => scalar(gaussianPropagator(x, p.t, D).result)),
          );
    const times = new Float64Array([1, 10, 60]);
    const radial2d = moments(2, D, p.t);
    const radial3d = moments(3, D, p.t);
    const outputs: ScientificResult[] = [
      diffusivity,
      activeDiffusivity,
      rms,
      moments(1, D, p.t).marginal.result,
      probability,
      value("positionCoordinate1d", xs),
      density,
      value("comparisonTimes", times),
      value(
        "comparisonRms",
        Float64Array.from(times, (t) => scalar(rmsDisplacement(D, t).result)),
      ),
      rename(radial2d.meanRadius.result, "meanRadius2d"),
      rename(radial2d.rmsRadius.result, "rmsRadius2d"),
      rename(mostLikelyRadius2d(D, p.t).result, "mostLikelyRadius2d"),
      rename(radial3d.meanRadius.result, "meanRadius3d"),
      rename(radial3d.rmsRadius.result, "rmsRadius3d"),
    ];
    let stepIndex = 0;
    if (p.gridEnabled) {
      const dt = p.t === 0 ? (0.25 * p.dx * p.dx) / D : p.t / p.steps;
      // The dimensional owner supplies the stability refusal and its ranked repairs.
      const initial = ftcs1d({ n: p.n, frames: 1, stepsPerFrame: 1, D, dx: p.dx, dt, profile: 0 });
      if (initial.kind !== "accepted") {
        if (initial.kind === "refused" && initial.refusal.code === "ftcs-unstable") {
          const stepRepair = initial.refusal.rankedRepairs.find(
            (r) => r.action?.parameterId === "dt",
          )?.action;
          if (stepRepair && typeof stepRepair.value === "number") {
            let requiredSteps = Math.max(1, Math.ceil(p.t / stepRepair.value));
            // Division to dt can round back above the strict boundary. Recheck, do not relax it.
            if ((D * (p.t / requiredSteps)) / (p.dx * p.dx) > 0.5) requiredSteps++;
            return {
              kind: "refused",
              refusal: {
                ...initial.refusal,
                rankedRepairs: [
                  ...(Number.isSafeInteger(requiredSteps) && requiredSteps <= 4_000_000
                    ? [
                        {
                          label: `Use ${requiredSteps} time steps for this elapsed time.`,
                          action: { parameterId: "steps", value: requiredSteps },
                        },
                      ]
                    : []),
                  ...initial.refusal.rankedRepairs.filter((r) => r.action?.parameterId === "dx"),
                ],
              },
            };
          }
        }
        return initial;
      }
      let field = initial.data.values;
      const totalSteps = p.t === 0 ? 0 : p.steps;
      while (stepIndex < totalSteps) {
        if (cancelled()) return outcome("cancelled");
        const count = Math.min(chunkSteps, totalSteps - stepIndex);
        const advanced = ftcsAdvance(field, initial.data.stabilityRatio, count);
        if (advanced.kind !== "accepted") return advanced;
        field = advanced.data;
        stepIndex += count;
        // Yield to real worker messages; no skipped simulation steps or time-based chunk sizes.
        await yieldControl();
      }
      if (cancelled()) return outcome("cancelled");
      const comparison = ftcsAnalyticComparison({
        field,
        dx: p.dx,
        t: p.t,
        D,
        startCell: Math.floor(p.n / 2),
      });
      if (comparison.kind !== "accepted") return comparison;
      outputs.push(
        value("gridDensity", field),
        value("cellMasses", comparison.data.cellMasses),
        value("cellProbabilities", comparison.data.cellProbabilities),
        comparison.data.maxCellMassDifference,
        value("wallContact", Number(comparison.data.wallContact)),
        value("stabilityRatio", p.t === 0 ? 0 : initial.data.stabilityRatio),
        value("gridTimeStep", p.t === 0 ? 0 : dt),
      );
    } else
      for (const quantityId of gridKeys) {
        const c = BM06_OUTPUTS[quantityId]!;
        outputs.push({
          quantityId,
          unit: c.unit,
          semanticKind: c.semanticKind,
          ownerId: c.ownerId,
          status: "not-applicable",
          reason: "The optional numerical grid is switched off.",
        });
      }
    for (const result of outputs) decodeResult(result);
    return { kind: "accepted", data: { outputs, stepIndex, simulationTime: p.t } };
  } catch {
    // This is a software/numerical failure, never a claim of physical impossibility.
    return outcome("invariant-violation");
  }
}
