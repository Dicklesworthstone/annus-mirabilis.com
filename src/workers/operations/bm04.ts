import { BM04_BUDGET, BM04_OUTPUTS } from "../../experiments/bm04/definition.ts";
import { validateBm04Parameters } from "../../experiments/bm04/parameters.ts";
import { decodeResult } from "../../experiments/results/codec.ts";
import {
  type ExecutionOutcomeId,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { getConstantSet, thermalConstant } from "../../physics/reference/constants.ts";
import { driftDiffusionFrames1d } from "../../physics/reference/diffusion/driftDiffusion.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  decayLengths,
  equilibriumBalance,
  osmoticEquilibriumProfile,
  stokesMobility,
} from "../../physics/reference/diffusion/routeA.ts";

export type Bm04Evaluation = Readonly<{
  outputs: readonly ScientificResult[];
  stepIndex: number;
  simulationTime: number;
}>;

export type EvaluationControl = Readonly<{
  cancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
  chunkSteps?: number;
}>;

export { validateBm04Parameters } from "../../experiments/bm04/parameters.ts";

function outcome(id: Exclude<ExecutionOutcomeId, "budget-exhausted">): Computation<never> {
  return { kind: "outcome", outcome: { outcome: id, ...executionOutcomeRegistry[id] } };
}

function value(quantityId: string, val: number | Float64Array): ScientificResult {
  const c = BM04_OUTPUTS[quantityId];
  if (!c) throw new TypeError(`Undeclared output ${quantityId}`);
  return decodeResult({
    quantityId,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
    status: "value",
    value: val,
  });
}

function scalar(result: ScientificResult): number {
  if (result.status !== "value" || typeof result.value !== "number") {
    throw new RangeError("The requested model quantity has no representable scalar value.");
  }
  return result.value;
}

/** Evaluates BM-04 drift-diffusion balance and flux equilibrium. */
export async function evaluateBm04(
  input: unknown,
  control: EvaluationControl = {},
): Promise<Computation<Bm04Evaluation>> {
  const validated = validateBm04Parameters(input);
  if (validated.kind !== "accepted") return validated;
  const p = validated.data;

  const cancelled = control.cancelled ?? (() => false);
  const yieldControl =
    control.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  if (cancelled()) return outcome("cancelled");

  const workUnits = p.cells * p.steps;
  const allocationBytes = p.cells * 2 * 8 + 8192;
  if (workUnits > BM04_BUDGET.workUnits || allocationBytes > BM04_BUDGET.allocationBytes) {
    return {
      kind: "outcome",
      outcome: {
        outcome: "budget-exhausted",
        ...executionOutcomeRegistry["budget-exhausted"],
        requested: { workUnits, allocationBytes },
        allowed: BM04_BUDGET,
      },
    };
  }

  try {
    const set = getConstantSet("modern-si-2019");
    const muEval = stokesMobility(p.eta, p.a);
    const mu = scalar(muEval.result);

    const D_mobility = mu * thermalConstant(set).value * p.T;
    const D_kicks = p.m * D_mobility;
    const u = mu * p.F;
    const reynolds = (998 * Math.abs(u) * p.a) / p.eta;

    const kickModelVal = p.m === 1 ? 1 : p.m === 0 ? 0 : 2;

    const balanceEval = equilibriumBalance(
      {
        force: p.F,
        temperature: p.T,
        eta: p.eta,
        a: p.a,
        kickDiffusivity: D_kicks,
      },
      set,
    );

    if (!("mobilityD" in balanceEval)) {
      return outcome("invariant-violation");
    }

    const decayEval = decayLengths(
      {
        force: p.F,
        temperature: p.T,
        kickDiffusivity: D_kicks,
        mobility: mu,
      },
      set,
    );

    // Run explicit Scharfetter-Gummel drift-diffusion stepper
    const framesResult = driftDiffusionFrames1d({
      cells: p.cells,
      width: p.W,
      frames: 2,
      stepsPerFrame: p.steps,
      dt: p.dt,
      kickDiffusivity: D_kicks,
      mobility: mu,
      force: p.F,
      temperature: p.T,
      profile: p.profile,
      set,
    });

    if (framesResult.kind !== "accepted") {
      return framesResult;
    }

    await yieldControl();
    if (cancelled()) return outcome("cancelled");

    const dx = p.W / p.cells;
    const finalDensity = framesResult.data.values.subarray(p.cells, 2 * p.cells);

    // Compute osmotic equilibrium profile across cell centers
    const osmoticDensity = new Float64Array(p.cells);
    for (let i = 0; i < p.cells; i++) {
      const x = (i + 0.5) * dx;
      const osEval = osmoticEquilibriumProfile(x, p.W, p.F, p.T, 1.0, set);
      osmoticDensity[i] = osEval.result.status === "value" ? (osEval.result.value as number) : 0;
    }

    // Compute average drift, diffusion, and total fluxes
    let maxAbsTotalFlux = 0;
    let avgDriftFlux = 0;
    let avgDiffusionFlux = 0;
    const faceCount = framesResult.data.faceFlux.length;

    for (const face of framesResult.data.faceFlux) {
      if (Math.abs(face.total) > maxAbsTotalFlux) {
        maxAbsTotalFlux = Math.abs(face.total);
      }
      avgDriftFlux += face.drift;
      avgDiffusionFlux += face.diffusion;
    }

    if (faceCount > 0) {
      avgDriftFlux /= faceCount;
      avgDiffusionFlux /= faceCount;
    }

    // Steady state indicator
    let maxDensity = 0;
    for (let i = 0; i < p.cells; i++) {
      const val = finalDensity[i];
      if (val !== undefined && val > maxDensity) maxDensity = val;
    }
    const fluxScale = Math.max(Math.abs(u), p.m > 0 ? D_kicks / dx : 0) * (maxDensity || 1);
    const steadyStateReached =
      fluxScale > 0 ? maxAbsTotalFlux <= 1e-4 * fluxScale : p.m === 0 && p.F === 0;

    const outputs: ScientificResult[] = [
      value("densityProfile", finalDensity),
      value("osmoticProfile", osmoticDensity),
      balanceEval.mobilityD.result,
      balanceEval.balanceD.result,
      muEval.result,
      value("driftVelocity", u),
      value("particleReynoldsNumber", reynolds),
      value("kickModel", kickModelVal),
      decayEval.osmotic.result,
      decayEval.kinetic.result,
      value("driftFlux", avgDriftFlux),
      value("diffusionFlux", avgDiffusionFlux),
      value("totalFlux", avgDriftFlux + avgDiffusionFlux),
      value("steadyState", steadyStateReached ? 1 : 0),
      value("pecletNumber", framesResult.data.peclet),
      value("stabilityRatio", framesResult.data.sigma),
    ];

    for (const r of outputs) decodeResult(r);

    return {
      kind: "accepted",
      data: {
        outputs,
        stepIndex: p.steps,
        simulationTime: p.steps * p.dt,
      },
    };
  } catch {
    return outcome("invariant-violation");
  }
}
