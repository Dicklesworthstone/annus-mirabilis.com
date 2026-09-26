import {
  BM06_BUDGET,
  BM06_HOST_GRID_OWNER,
  BM06_OUTPUTS,
} from "../../experiments/bm06/definition.ts";
import { decodeResult } from "../../experiments/results/codec.ts";
import {
  type ExecutionOutcomeId,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { ownerAdmitted } from "../../experiments/store/instanceStore.ts";
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

/** One stepping of the optional grid: `steps` explicit steps of width `dt` from the centred spike. */
export type GridRun = Readonly<{ n: number; D: number; dx: number; dt: number; steps: number }>;
/**
 * The stepped field and its diffusion number, with the owner that actually produced them. The
 * owner travels with the result, not with the stepper, so a stepper that hands a request to the
 * host reference cannot publish the host's field under FrankenSim's name.
 */
export type GridField = Readonly<{ field: Float64Array; stabilityRatio: number; ownerId: string }>;
export type GridControl = Readonly<{
  cancelled: () => boolean;
  yieldControl: () => Promise<void>;
  chunkSteps: number;
}>;
/**
 * Who steps the grid. The host reference by default; FrankenSim's compiled diffusion1d_frames
 * when the worker has loaded the pinned module (src/workers/wasm/frankensimFtcsGrid.ts). One host
 * keeps one stepper for its lifetime, so a run never switches engines part-way.
 */
export type Bm06GridStepper = Readonly<{
  step(run: GridRun, control: GridControl): Promise<Computation<GridField>>;
}>;
function cancelledOutcome(): Computation<never> {
  return {
    kind: "outcome",
    outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
  };
}
export const HOST_GRID_STEPPER: Bm06GridStepper = Object.freeze({
  async step(run: GridRun, control: GridControl): Promise<Computation<GridField>> {
    // The dimensional owner supplies the stability refusal and its ranked repairs.
    const initial = ftcs1d({
      n: run.n,
      frames: 1,
      stepsPerFrame: 1,
      D: run.D,
      dx: run.dx,
      dt: run.dt,
      profile: 0,
    });
    if (initial.kind !== "accepted") return initial;
    let field = initial.data.values;
    let stepIndex = 0;
    while (stepIndex < run.steps) {
      if (control.cancelled()) return cancelledOutcome();
      const count = Math.min(control.chunkSteps, run.steps - stepIndex);
      const advanced = ftcsAdvance(field, initial.data.stabilityRatio, count);
      if (advanced.kind !== "accepted") return advanced;
      field = advanced.data;
      stepIndex += count;
      // Yield to real worker messages; no skipped simulation steps or time-based chunk sizes.
      await control.yieldControl();
    }
    return {
      kind: "accepted",
      data: { field, stabilityRatio: initial.data.stabilityRatio, ownerId: BM06_HOST_GRID_OWNER },
    };
  },
});

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
function value(
  quantityId: string,
  value: number | Float64Array,
  ownerId?: string,
): ScientificResult {
  const c = BM06_OUTPUTS[quantityId];
  if (!c) throw new TypeError(`Undeclared output ${quantityId}`);
  return decodeResult({
    quantityId,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: ownerId ?? c.ownerId,
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
  stepper: Bm06GridStepper = HOST_GRID_STEPPER,
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
      const totalSteps = p.t === 0 ? 0 : p.steps;
      const stepped = await stepper.step(
        { n: p.n, D, dx: p.dx, dt, steps: totalSteps },
        { cancelled, yieldControl, chunkSteps },
      );
      if (stepped.kind !== "accepted") {
        // Whichever engine refused, the reader is offered a number of time steps, which is what
        // this form sets, rather than a time step it has no field for.
        if (stepped.kind === "refused" && stepped.refusal.code === "ftcs-unstable") {
          const stepRepair = stepped.refusal.rankedRepairs.find(
            (r) => r.action?.parameterId === "dt",
          )?.action;
          if (stepRepair && typeof stepRepair.value === "number") {
            let requiredSteps = Math.max(1, Math.ceil(p.t / stepRepair.value));
            // Division to dt can round back above the strict boundary. Recheck, do not relax it.
            if ((D * (p.t / requiredSteps)) / (p.dx * p.dx) > 0.5) requiredSteps++;
            return {
              kind: "refused",
              refusal: {
                ...stepped.refusal,
                rankedRepairs: [
                  ...(Number.isSafeInteger(requiredSteps) && requiredSteps <= 4_000_000
                    ? [
                        {
                          label: `Use ${requiredSteps} time steps for this elapsed time.`,
                          action: { parameterId: "steps", value: requiredSteps },
                        },
                      ]
                    : []),
                  ...stepped.refusal.rankedRepairs.filter((r) => r.action?.parameterId === "dx"),
                ],
              },
            };
          }
        }
        return stepped;
      }
      const { field, stabilityRatio, ownerId: gridOwner } = stepped.data;
      const gridContract = BM06_OUTPUTS.gridDensity;
      if (field.length !== p.n || !gridContract || !ownerAdmitted(gridContract, gridOwner))
        return outcome("invariant-violation");
      stepIndex = totalSteps;
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
        value("gridDensity", field, gridOwner),
        value("cellMasses", comparison.data.cellMasses),
        value("cellProbabilities", comparison.data.cellProbabilities),
        comparison.data.maxCellMassDifference,
        value("wallContact", Number(comparison.data.wallContact)),
        value("stabilityRatio", p.t === 0 ? 0 : stabilityRatio, gridOwner),
        value("gridTimeStep", p.t === 0 ? 0 : dt),
      );
    } else
      for (const quantityId of gridKeys) {
        const c = BM06_OUTPUTS[quantityId];
        if (!c) continue;
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
