import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import {
  BM01_ALLOCATION,
  BM05_ALLOCATION,
  bm01Tile,
  bm05Tile,
} from "../../../experiments/streams/allocation.ts";
import { createPhiloxStream, parseU64 } from "../philox.ts";
import type { Computation } from "./ftcs.ts";
import { WALK_BUDGET } from "./walks.ts";

export type BrownianFramesParameters = Readonly<{
  nSeries: number;
  steps: number;
  stepKernel: number;
  seed: string | bigint;
  diffusion: number;
  dt: number;
  streamKernelId?: number;
  allocationId?: string;
}>;

const invalid = (requirements: string): Computation<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "invalid-parameter",
    { capabilityId: "diffusion.brownianFrames" },
    { details: { requirements } },
  ),
});

const failed = (reason: string): Computation<never> => ({
  kind: "outcome",
  outcome: {
    outcome: "invariant-violation",
    ...executionOutcomeRegistry["invariant-violation"],
    details: { reason },
  },
});

/**
 * TypeScript fallback for upstream `brownian_frames` export (am-fs-export-brownian-frames-nhm).
 * Layout: `nSeries * (steps + 1)` Float64Array in row-major order:
 * Series `p` at step `s` is stored at index `p * (steps + 1) + s`.
 * Step kernels (docs/FRANKENSIM_BINDING.md §5.3 Decision a):
 * 0: coin (physical) - 1 draw, step +/- s where s = Math.sqrt(2 * D * dt)
 * 1: uniform (physical) - 1 draw, step in [-h, h) where h = Math.sqrt(6 * D * dt)
 * 2: unit Gaussian teaching walk (dimensionless) - 2 draws, step z ~ N(0, 1) without scaling
 * 3: Gaussian with exact D (physical) - 2 draws, step z * s where s = Math.sqrt(2 * D * dt)
 */
export function brownianFrames(p: BrownianFramesParameters): Computation<Float64Array> {
  if (
    !p ||
    !Number.isInteger(p.nSeries) ||
    p.nSeries < 1 ||
    p.nSeries > 0xffffffff ||
    !Number.isInteger(p.steps) ||
    p.steps < 1 ||
    !Number.isInteger(p.stepKernel) ||
    p.stepKernel < 0 ||
    p.stepKernel > 3 ||
    !Number.isFinite(p.diffusion) ||
    p.diffusion < 0 ||
    !Number.isFinite(p.dt) ||
    p.dt <= 0
  ) {
    return invalid(
      "Use stepKernel in 0..3, 1..u32 nSeries, positive steps, nonnegative diffusion, and positive dt.",
    );
  }

  // Reject JavaScript numbers for seeds to prevent IEEE 754 precision loss
  if (typeof p.seed !== "string" && typeof p.seed !== "bigint") {
    return { kind: "refused", refusal: makeRefusal("invalid-seed", { parameterIds: ["seed"] }) };
  }
  try {
    parseU64(p.seed);
  } catch {
    return { kind: "refused", refusal: makeRefusal("invalid-seed", { parameterIds: ["seed"] }) };
  }

  const workUnits = p.nSeries * p.steps;
  const totalEntries = p.nSeries * (p.steps + 1);
  const allocationBytes = totalEntries * 8;

  if (workUnits > WALK_BUDGET.workUnits || allocationBytes > WALK_BUDGET.allocationBytes) {
    return {
      kind: "outcome",
      outcome: {
        outcome: "budget-exhausted",
        ...executionOutcomeRegistry["budget-exhausted"],
        requested: { workUnits, allocationBytes },
        allowed: WALK_BUDGET,
        details: {
          reason: "Reduce the series count or recorded steps; the trial is never silently reduced.",
        },
      },
    };
  }

  const buffer = new Float64Array(totalEntries);
  if (p.diffusion === 0) {
    return { kind: "accepted", data: buffer };
  }

  const stride = p.steps + 1;
  const streamKernel = p.streamKernelId ?? BM05_ALLOCATION.streamKernelId;
  const s = Math.sqrt(2.0 * p.diffusion * p.dt);
  const h = Math.sqrt(6.0 * p.diffusion * p.dt);

  for (let series = 0; series < p.nSeries; series++) {
    const tile =
      p.allocationId === BM01_ALLOCATION.allocationId
        ? bm01Tile(Math.floor(series / 3), series % 3)
        : p.allocationId === BM05_ALLOCATION.allocationId
          ? bm05Tile(series)
          : series;

    const rng = createPhiloxStream({ seed: p.seed, kernel: streamKernel, tile });
    let x = 0.0;
    const baseOffset = series * stride;
    buffer[baseOffset] = 0.0;

    for (let step = 1; step <= p.steps; step++) {
      let increment = 0.0;
      switch (p.stepKernel) {
        case 0:
          increment = rng.nextU64() >> 63n ? s : -s;
          break;
        case 1:
          increment = (2.0 * rng.nextF64() - 1.0) * h;
          break;
        case 2:
          increment = rng.nextNormal();
          break;
        case 3:
          increment = rng.nextNormal() * s;
          break;
      }
      x += increment;
      if (!Number.isFinite(x)) {
        return failed(
          "A walk coordinate exceeded the representable range; no partial trial was accepted.",
        );
      }
      buffer[baseOffset + step] = x;
    }
  }

  return { kind: "accepted", data: buffer };
}
