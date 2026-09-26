/**
 * BM-06's optional grid stepped by FrankenSim's compiled diffusion1d_frames
 * (am-frankensim-repin-and-bind-jvhg).
 *
 * The host reference (ftcs1d and ftcsAdvance, src/physics/reference/diffusion/ftcs.ts) and the
 * module step the same explicit scheme on the same grid: n cells of width dx, zero-flux walls,
 * a spike of height 1/dx in cell floor(n/2), and r = (D * dt) / (dx * dx) in that operation
 * order. One call with frames = 2 and steps_per_frame = steps returns the spike and the field
 * after every step, and the second frame is the field. With no steps (t = 0), frames = 1 returns
 * the spike alone. The call is one synchronous chunk: the site's budget holds a run to 4,000,000
 * cell updates, a few milliseconds of module time, and cancellation is checked either side of it.
 *
 * Admission is the site's, not the engine's, as for BM-01's recorder:
 * - a setup the host would refuse before stepping, other than for stability, goes to the host,
 *   which returns the same typed refusal;
 * - a stability refusal is the module's own, with its ratio and repairs, restated in the form
 *   the page offers (a dt, a dx or a D to use);
 * - a run the site admits but the module's budget does not goes to the host whole. The module
 *   restarts from the spike on every call, so it holds at most 1,048,576 frames x steps, which is
 *   524,288 steps at two frames. The site admits up to 4,000,000 / n steps, so only grids of 3 to
 *   7 cells can ask for more. Such a run is stepped by the host and published under the host's
 *   name, so its label says host calculation.
 *
 * Whoever stepped the field, its owner travels with the result (GridField.ownerId). Nothing here
 * decides a label: the page reads the owner the snapshot names.
 */

import { BM06_FRANKENSIM_GRID_OWNER } from "../../experiments/bm06/definition.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import type { RequestRefusal } from "../../experiments/results/refusals.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  type Bm06GridStepper,
  type GridControl,
  type GridField,
  type GridRun,
  HOST_GRID_STEPPER,
} from "../operations/bm06.ts";
import { callDiffusion1dFrames, type FrankenSimExports } from "./frankensimCalls.ts";

/** diffusion1d_frames' own budgets at FrankenSim 01824653 (crates/fs-wasm/src/diffusion1d.rs). */
export const DIFFUSION1D_BUDGET = Object.freeze({ values: 2_097_152, frameSteps: 1_048_576 });

function malformed(reason: string): Computation<never> {
  return {
    kind: "outcome",
    outcome: {
      outcome: "malformed-response",
      ...executionOutcomeRegistry["malformed-response"],
      details: { reason },
    },
  };
}

/** True when the host reference would refuse this run for a reason other than stability. */
function hostRefusesFirst(run: GridRun): boolean {
  const { n, D, dx, dt } = run;
  if (!Number.isSafeInteger(n) || n < 3 || !Number.isSafeInteger(run.steps) || run.steps < 0)
    return true;
  if (![D, dx, dt].every(Number.isFinite) || D <= 0 || dx <= 0 || dt <= 0) return true;
  const r = (D * dt) / (dx * dx);
  if (!Number.isFinite(r) || r === 0) return true;
  if (r <= 0.5) return false;
  // The host words its own refusal when a repair is not representable in binary64.
  return ![(dx * dx) / (2 * D), Math.sqrt(2 * D * dt), (dx * dx) / (2 * dt)].every(
    (v) => Number.isFinite(v) && v > 0,
  );
}

/** The neighbouring positive binary64 value, one unit in the last place away. */
function adjacent(value: number, upward: boolean): number {
  const bits = new BigInt64Array(new Float64Array([value]).buffer);
  bits[0] = (bits[0] ?? 0n) + (upward ? 1n : -1n);
  return new Float64Array(bits.buffer)[0] ?? Number.NaN;
}

/**
 * A repair the module named, moved at most four units in the last place until applying it gives
 * r <= 0.5. The module states the bound; a bound that rounds to r = 0.5000000000000001 would offer
 * the reader a repair that is itself refused.
 */
function executable(
  value: number | null,
  upward: boolean,
  ratio: (v: number) => number,
): number | null {
  if (value === null) return null;
  let v = value;
  for (let i = 0; i < 4; i++) {
    if (!(v > 0) || !Number.isFinite(v)) return null;
    const r = ratio(v);
    if (r > 0 && r <= 0.5) return v;
    v = adjacent(v, upward);
  }
  return null;
}

/** The module's stability refusal, with its repairs as actions the page can apply. */
function stabilityRefusal(refusal: RequestRefusal, run: GridRun): RequestRefusal | null {
  const details = refusal.details as { repairs?: unknown } | undefined;
  const repairs = Array.isArray(details?.repairs) ? (details.repairs as unknown[]) : [];
  const named = (parameterId: string): number | null => {
    const repair = repairs.find(
      (r): r is { parameterId: string; value: number } =>
        typeof r === "object" &&
        r !== null &&
        (r as { parameterId?: unknown }).parameterId === parameterId &&
        typeof (r as { value?: unknown }).value === "number",
    );
    return repair ? repair.value : null;
  };
  const { D, dx, dt } = run;
  const dtRepair = executable(named("dt"), false, (v) => (D * v) / (dx * dx));
  const dxRepair = executable(named("dx"), true, (v) => (D * dt) / (v * v));
  const dRepair = executable(named("diffusion"), false, (v) => (v * dt) / (dx * dx));
  if (dtRepair === null || dxRepair === null || dRepair === null) return null;
  return {
    ...refusal,
    affected: { parameterIds: ["dt", "dx", "D"] },
    rankedRepairs: [
      {
        label: "Reduce the time step to the explicit scheme's limit.",
        action: { parameterId: "dt", value: dtRepair },
      },
      { label: "Use a coarser spatial grid.", action: { parameterId: "dx", value: dxRepair } },
      {
        label: "Choose a smaller diffusivity; this changes the physical setup.",
        action: { parameterId: "D", value: dRepair },
      },
    ],
  };
}

export function frankensimGridStepper(exports: FrankenSimExports): Bm06GridStepper {
  return Object.freeze({
    async step(run: GridRun, control: GridControl): Promise<Computation<GridField>> {
      const frames = run.steps === 0 ? 1 : 2;
      const stepsPerFrame = Math.max(1, run.steps);
      if (
        hostRefusesFirst(run) ||
        frames * stepsPerFrame > DIFFUSION1D_BUDGET.frameSteps ||
        frames * run.n > DIFFUSION1D_BUDGET.values
      )
        return HOST_GRID_STEPPER.step(run, control);
      if (control.cancelled())
        return {
          kind: "outcome",
          outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
        };
      const call = callDiffusion1dFrames(exports, {
        n: run.n,
        frames,
        stepsPerFrame,
        diffusion: run.D,
        dx: run.dx,
        dt: run.dt,
        profile: 0,
      });
      if (call.kind === "outcome") return { kind: "outcome", outcome: call.outcome };
      if (call.kind === "refused") {
        if (call.refusal.code === "ftcs-unstable") {
          const refusal = stabilityRefusal(call.refusal, run);
          // No executable repair near the boundary: the host words that case itself.
          return refusal ? { kind: "refused", refusal } : HOST_GRID_STEPPER.step(run, control);
        }
        // Unreachable after hostRefusesFirst; kept typed, and naming the capability that refused.
        return {
          kind: "refused",
          refusal: Object.keys(call.refusal.affected).length
            ? call.refusal
            : { ...call.refusal, affected: { capabilityId: BM06_FRANKENSIM_GRID_OWNER } },
        };
      }
      const { ok, values } = call;
      const layout = ok.layout as { n?: unknown; frames?: unknown } | undefined;
      if (ok.quantityId !== "probabilityDensity")
        return malformed("diffusion1d_frames bound another quantity.");
      if (layout?.n !== run.n || layout.frames !== frames || values.length !== frames * run.n)
        return malformed("diffusion1d_frames returned another layout.");
      // The module computes r from the same binary64 inputs in the same order, so it is equal to
      // the site's r exactly. A different r is a module that stepped a different grid.
      if (ok.r !== (run.D * run.dt) / (run.dx * run.dx))
        return malformed("diffusion1d_frames stepped another diffusion number.");
      const field = values.slice((frames - 1) * run.n);
      if (!field.every(Number.isFinite))
        return malformed("diffusion1d_frames returned a nonfinite cell.");
      if (control.cancelled())
        return {
          kind: "outcome",
          outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
        };
      return {
        kind: "accepted",
        data: Object.freeze({
          field,
          stabilityRatio: ok.r as number,
          ownerId: BM06_FRANKENSIM_GRID_OWNER,
        }),
      };
    },
  });
}
