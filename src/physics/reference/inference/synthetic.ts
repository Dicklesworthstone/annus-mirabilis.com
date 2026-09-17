/** Fixed logical path for BM-07. This exercise never uses ambient k_B or N_A.
 * Stream allocations: docs/FRANKENSIM_BINDING.md, bm-07.*.v1.
 * Host Gaussian arithmetic is reproducible in one engine, not strict WASM math.
 */

import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import { constantValue, createDeclaredConstantSet } from "../constants.ts";
import type { Computation } from "../diffusion/ftcs.ts";
import { createPhiloxStream, parseU64 } from "../philox.ts";
export const INFERENCE_GRID_DT = 0.25;
export const INFERENCE_GRID_STEPS = 4096;
export const INFERENCE_STREAMS = Object.freeze({ latent: 0x19050003, parameter: 0x19050007 });
export const INFERENCE_CONSTANTS = createDeclaredConstantSet({
  id: "scenario-bm07-hidden-number",
  era: 2026,
  provenance:
    "A synthetic inverse exercise; not an observed gas measurement or historical transcription.",
  precisionNote: "R is a chosen instructional input; host calculations use binary64.",
  gasConstantProvenance: "not-applicable",
  entries: [
    {
      quantityId: "molarGasConstant",
      value: 8.314471,
      exactDecimal: "8.314471",
      unit: "J/(mol K)",
      kind: "declared-scenario",
      evidentialRole: "theoretical-estimate",
      provenance: "Chosen exercise input, not independent evidence.",
      dependsOn: ["bm07-instructional-scenario"],
    },
  ],
});
export type SyntheticSetup = Readonly<{
  seed: string;
  generatorT: number;
  generatorEta: number;
  generatorRadius: number;
}>;
export type InferenceRecording = Readonly<{
  setup: SyntheticSetup;
  hiddenNumber: number;
  D: number;
  positions: Float64Array;
  steps: number;
  draws: number;
  replicate: number;
}>;
export type InferenceExecutionOptions = Readonly<{
  cancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
  chunkSteps?: number;
}>;
const bad = (requirements: string): Computation<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "invalid-parameter",
    { capabilityId: "diffusion.inference" },
    { details: { requirements } },
  ),
});
const cancelled = (): Computation<never> => ({
  kind: "outcome",
  outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
});
export function drawHiddenMolecularNumber(seed: string): number {
  const stream = createPhiloxStream({ seed, kernel: INFERENCE_STREAMS.parameter, tile: 0 });
  return 3e23 * Math.exp(Math.log(4) * stream.nextF64());
}
/** replicate is a logical particle id, never a scheduling/worker id. */
export async function recordInferencePath(
  setup: SyntheticSetup,
  options: InferenceExecutionOptions = {},
  replicate = 0,
  steps = INFERENCE_GRID_STEPS,
): Promise<Computation<InferenceRecording>> {
  try {
    if (typeof setup.seed !== "string") throw new TypeError();
    parseU64(setup.seed);
  } catch {
    return { kind: "refused", refusal: makeRefusal("invalid-seed", { parameterIds: ["seed"] }) };
  }
  if (
    ![setup.generatorT, setup.generatorEta, setup.generatorRadius].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    !Number.isSafeInteger(replicate) ||
    replicate < 0 ||
    replicate >= 65536 ||
    !Number.isSafeInteger(steps) ||
    steps < 1 ||
    steps > INFERENCE_GRID_STEPS
  )
    return bad("Use positive generator conditions and a bounded logical recording.");
  const chunk = options.chunkSteps ?? 256;
  if (!Number.isSafeInteger(chunk) || chunk < 1 || chunk > 4096)
    return bad("The chunk size must be between 1 and 4096 grid steps.");
  const hiddenNumber = drawHiddenMolecularNumber(setup.seed);
  const R = constantValue(INFERENCE_CONSTANTS, "molarGasConstant").value;
  const D =
    (R * setup.generatorT) /
    (6 * Math.PI * setup.generatorEta * setup.generatorRadius * hiddenNumber);
  const scale = Math.sqrt(2 * D * INFERENCE_GRID_DT);
  if (![D, scale].every((n) => Number.isFinite(n) && n > 0))
    return bad("The generator scale is outside the representable numerical range.");
  if (options.cancelled?.()) return cancelled();
  const positions = new Float64Array((steps + 1) * 2);
  const yieldControl =
    options.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  for (let start = 0; start < steps; start += chunk) {
    if (options.cancelled?.()) return cancelled();
    for (let s = start; s < Math.min(steps, start + chunk); s++) {
      const stream = createPhiloxStream({
        seed: setup.seed,
        kernel: INFERENCE_STREAMS.latent,
        tile: replicate * 65536 + s,
      });
      // Coordinate c consumes draw indices 2c and 2c+1 in this substep's stream.
      for (let c = 0; c < 2; c++) {
        const prev = positions[s * 2 + c] ?? 0;
        const x = prev + scale * stream.nextNormal();
        if (!Number.isFinite(x)) return bad("The generated path exceeds the numerical range.");
        positions[(s + 1) * 2 + c] = x;
      }
    }
    await yieldControl();
  }
  if (options.cancelled?.()) return cancelled();
  return {
    kind: "accepted",
    data: Object.freeze({
      setup: Object.freeze({ ...setup }),
      hiddenNumber,
      D,
      positions,
      steps,
      draws: 1 + 4 * steps,
      replicate,
    }),
  };
}
export function observationGrid(
  M: number,
  d: number,
  dt: number,
  steps = INFERENCE_GRID_STEPS,
): Computation<number> {
  if (
    !Number.isSafeInteger(M) ||
    M < 1 ||
    M > 1000 ||
    ![1, 2].includes(d) ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return bad(
      "Use 1–1000 non-overlapping displacements, one or two coordinates and a positive interval.",
    );
  const stride = dt / INFERENCE_GRID_DT;
  if (!Number.isSafeInteger(stride) || stride < 1) {
    const value = Math.max(INFERENCE_GRID_DT, Math.round(stride) * INFERENCE_GRID_DT);
    return {
      kind: "refused",
      refusal: makeRefusal(
        "off-replay-grid",
        { parameterIds: ["dt"] },
        {
          rankedRepairs: [
            {
              label: "Use the nearest available interval on the quarter-second recording grid.",
              action: {
                parameterId: "dt",
                value: Math.min(value, Math.floor(steps / M) * INFERENCE_GRID_DT),
              },
            },
          ],
        },
      ),
    };
  }
  if (M * stride > steps)
    return bad(
      `The recording contains ${steps * INFERENCE_GRID_DT} seconds. Request at most ${Math.floor(steps / stride)} increments at this spacing, or use a shorter spacing.`,
    );
  return { kind: "accepted", data: stride };
}
export function observeInferencePath(
  recording: InferenceRecording,
  { M, d, dt }: { M: number; d: number; dt: number },
): Computation<{ increments: Float64Array; positions: Float64Array; times: Float64Array }> {
  const grid = observationGrid(M, d, dt, recording.steps);
  if (grid.kind !== "accepted") return grid;
  const positions = new Float64Array((M + 1) * d),
    increments = new Float64Array(M * d),
    times = new Float64Array(M + 1);
  for (let i = 0; i <= M; i++) {
    times[i] = i * dt;
    for (let c = 0; c < d; c++) {
      const pos = recording.positions[i * grid.data * 2 + c] ?? 0;
      positions[i * d + c] = pos;
      if (i > 0) {
        const prev = positions[(i - 1) * d + c] ?? 0;
        increments[(i - 1) * d + c] = pos - prev;
      }
    }
  }
  return { kind: "accepted", data: { increments, positions, times } };
}
