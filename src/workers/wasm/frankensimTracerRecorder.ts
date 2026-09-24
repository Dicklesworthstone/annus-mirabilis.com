/**
 * BM-01's tracer ensemble recorded by FrankenSim's compiled brownian_frames
 * (am-frankensim-repin-and-bind-jvhg).
 *
 * The host reference (recordTracers, src/physics/reference/diffusion/tracers.ts) and this recorder
 * use the same streams. Each series, one tracer on one axis, keys a Philox stream by (seed,
 * kernel 0x19050001, tile 3*tracer + axis), and advances it by normal * sqrt(2 D h). So
 * brownian_frames(3M, steps, kernel 3, seed, D, h) has exactly recordTracers' layout
 * `series * (steps + 1) + step`. The two differ only in the normal transform:
 * - FrankenSim uses fs-math's deterministic ln and cos;
 * - the host uses Math.
 * Their positions therefore agree within a stated tolerance, not bitwise
 * (frankensimTracerRecorder.test.ts measures it). The integer draws agree bitwise.
 *
 * Admission is the site's, not the engine's. Any setup the host would refuse or budget out is
 * handed to recordTracers, which returns the same typed refusal before it samples anything.
 * An engine choice therefore never changes what is admitted. FrankenSim's own output budget
 * (2,097,152 values) is larger than the site's (8 MiB, 1,048,576 values).
 */

import { BM01_FRANKENSIM_RECORDER_OWNER } from "../../experiments/bm01/definition.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import { BM01_ALLOCATION } from "../../experiments/streams/allocation.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  recordTracers,
  TRACER_BUDGET,
  type TracerRecording,
  type TracerSetup,
} from "../../physics/reference/diffusion/tracers.ts";
import { parseU64 } from "../../physics/reference/philox.ts";
import type { Bm01Recorder } from "../operations/bm01.ts";
import { callBrownianFrames, type FrankenSimExports } from "./frankensimCalls.ts";

export const FRANKENSIM_NORMAL_VERSION = "fs-rand-box-muller-det-v1";

/** True when recordTracers would refuse this setup before sampling. */
function hostRefuses(p: TracerSetup): boolean {
  if (
    !Number.isInteger(p.M) ||
    p.M < 1 ||
    p.M > 10000 ||
    !Number.isInteger(p.steps) ||
    p.steps < 1 ||
    p.steps > 30000 ||
    !Number.isFinite(p.h) ||
    p.h <= 0 ||
    !Number.isFinite(p.D) ||
    p.D < 0
  )
    return true;
  try {
    parseU64(p.seed);
  } catch {
    return true;
  }
  if (
    p.M * 3 * p.steps > TRACER_BUDGET.workUnits ||
    p.M * 3 * (p.steps + 1) * 8 > TRACER_BUDGET.allocationBytes
  )
    return true;
  const amplitude = Math.sqrt(2 * p.D * p.h);
  return !Number.isFinite(amplitude) || (p.D > 0 && amplitude === 0);
}

function cancelledOutcome(): Computation<never> {
  return {
    kind: "outcome",
    outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
  };
}

export function frankensimTracerRecorder(exports: FrankenSimExports): Bm01Recorder {
  return Object.freeze({
    ownerId: BM01_FRANKENSIM_RECORDER_OWNER,
    async record(
      p: TracerSetup,
      options: Parameters<typeof recordTracers>[1] = {},
    ): Promise<Computation<TracerRecording>> {
      if (hostRefuses(p)) return recordTracers(p, options);
      if (options.cancelled?.()) return cancelledOutcome();
      const call = callBrownianFrames(exports, {
        nParticles: p.M * 3,
        steps: p.steps,
        stepKernel: 3,
        seed: p.seed,
        diffusion: p.D,
        dt: p.h,
      });
      if (call.kind === "refused") return { kind: "refused", refusal: call.refusal };
      if (call.kind === "outcome") return { kind: "outcome", outcome: call.outcome };
      if (call.ok.quantityId !== "latentPosition1d" || call.ok.unit !== "metre")
        return {
          kind: "outcome",
          outcome: {
            outcome: "malformed-response",
            ...executionOutcomeRegistry["malformed-response"],
            details: { reason: "brownian_frames bound another quantity." },
          },
        };
      if (options.cancelled?.()) return cancelledOutcome();
      return {
        kind: "accepted",
        data: Object.freeze({
          setup: Object.freeze({ ...p }),
          values: call.values,
          allocationId: BM01_ALLOCATION.allocationId,
          normalVersion: FRANKENSIM_NORMAL_VERSION,
          draws: p.M * 3 * p.steps * BM01_ALLOCATION.drawsPerStep,
        }),
      };
    },
  });
}
