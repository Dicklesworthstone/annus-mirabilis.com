/** Exact Brownian endpoints and integrated subinterval bridge averages.
 * A uniform camera exposure is an integral, not an endpoint interpolation.
 * Stream allocations follow docs/FRANKENSIM_BINDING.md (BM-08).
 */

import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import type { Computation } from "../diffusion/ftcs.ts";
import { createPhiloxStream, parseU64 } from "../philox.ts";
export const CAMERA_GRID_DT = 0.25;
export const CAMERA_GRID_STEPS = 4112;
export const CAMERA_KERNELS = Object.freeze({
  latent: 0x19050001,
  localization: 0x19050002,
  stationary: 0x19050008,
});
export type CameraSetup = Readonly<{ seed: string; D: number; flowDrift: number }>;
export type CameraRecording = Readonly<{
  setup: CameraSetup;
  replicate: number;
  steps: number;
  positions: Float64Array;
  averages: Float64Array;
  draws: number;
  bytes: number;
}>;
export type CameraObservation = Readonly<{
  dt: number;
  M: number;
  d: number;
  exposure: number;
  sigma: number;
  stageDrift: number;
  noiseSeed: string;
  clickSeed: string;
  clicks: number;
}>;
export type CameraFrames = Readonly<{
  times: Float64Array;
  ideal: Float64Array;
  blurred: Float64Array;
  observed: Float64Array;
  increments: Float64Array;
  stationary: Float64Array;
  measurementDraws: number;
}>;
export type CameraOptions = Readonly<{
  chunkSteps?: number;
  cancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
}>;
const bad = (requirements: string): Computation<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "invalid-parameter",
    { capabilityId: "diffusion.inference" },
    { details: { requirements } },
  ),
});
const cancel = (): Computation<never> => ({
  kind: "outcome",
  outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
});
export async function recordCameraPath(
  setup: CameraSetup,
  options: CameraOptions = {},
  replicate = 0,
  steps = CAMERA_GRID_STEPS,
): Promise<Computation<CameraRecording>> {
  try {
    parseU64(setup.seed);
  } catch {
    return bad("Use an exact unsigned 64-bit seed.");
  }
  if (
    ![setup.D, setup.flowDrift].every(Number.isFinite) ||
    setup.D <= 0 ||
    !Number.isSafeInteger(replicate) ||
    replicate < 0 ||
    replicate > 100 ||
    !Number.isSafeInteger(steps) ||
    steps < 1 ||
    steps > CAMERA_GRID_STEPS
  )
    return bad("Use positive diffusivity and a bounded recording.");
  const chunk = options.chunkSteps ?? 128;
  if (!Number.isSafeInteger(chunk) || chunk < 1 || chunk > CAMERA_GRID_STEPS)
    return bad("Use a positive bounded chunk size.");
  if (options.cancelled?.()) return cancel();
  const positions = new Float64Array((steps + 1) * 2),
    averages = new Float64Array(steps * 2);
  const latent = createPhiloxStream({
    seed: setup.seed,
    kernel: CAMERA_KERNELS.latent,
    tile: replicate * 4,
  });
  const bridge = createPhiloxStream({
    seed: setup.seed,
    kernel: CAMERA_KERNELS.latent,
    tile: replicate * 4 + 1,
  });
  const scale = Math.sqrt(2 * setup.D * CAMERA_GRID_DT),
    bridgeScale = Math.sqrt((setup.D * CAMERA_GRID_DT) / 6);
  if (!(scale > 0) || !(bridgeScale > 0) || !Number.isFinite(scale))
    return bad("The recording scale is outside the numerical range.");
  const yieldControl =
    options.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  for (let step = 0; step < steps; step++) {
    for (let c = 0; c < 2; c++) {
      const a = positions[step * 2 + c]!;
      const b = a + (c === 0 ? setup.flowDrift * CAMERA_GRID_DT : 0) + scale * latent.nextNormal();
      positions[(step + 1) * 2 + c] = b;
      averages[step * 2 + c] = (a + b) / 2 + bridgeScale * bridge.nextNormal();
      if (!Number.isFinite(b) || !Number.isFinite(averages[step * 2 + c]))
        return bad("The path cannot be represented at this scale.");
    }
    if ((step + 1) % chunk === 0) {
      await yieldControl();
      if (options.cancelled?.()) return cancel();
    }
  }
  return {
    kind: "accepted",
    data: Object.freeze({
      setup: Object.freeze({ ...setup }),
      replicate,
      steps,
      positions,
      averages,
      draws: steps * 8,
      bytes: positions.byteLength + averages.byteLength,
    }),
  };
}
export function cameraGrid(
  p: CameraObservation,
  steps = CAMERA_GRID_STEPS,
): Computation<Readonly<{ stride: number; exposureSteps: number }>> {
  if (
    ![1, 2, 3, 4].includes(p.dt) ||
    !Number.isSafeInteger(p.M) ||
    p.M < 3 ||
    p.M > 1000 ||
    ![1, 2].includes(p.d) ||
    ![p.exposure, p.sigma, p.stageDrift].every(Number.isFinite) ||
    p.sigma < 0 ||
    p.exposure < 0 ||
    p.exposure > p.dt ||
    !Number.isSafeInteger(p.clicks) ||
    p.clicks < 5 ||
    p.clicks > 200
  )
    return bad(
      "Use 3–1000 displacements, 1–4 second frame spacing, 5–200 stationary clicks, nonnegative noise and exposure no longer than spacing.",
    );
  try {
    parseU64(p.noiseSeed);
    parseU64(p.clickSeed);
  } catch {
    return bad("Noise and stationary-click seeds must be exact unsigned 64-bit strings.");
  }
  const exposureSteps = p.exposure / CAMERA_GRID_DT;
  if (!Number.isInteger(exposureSteps))
    return {
      kind: "refused",
      refusal: makeRefusal(
        "off-replay-grid",
        { parameterIds: ["exposure"], capabilityId: "diffusion.inference" },
        {
          details: {
            requirements: "Exposure must be a multiple of the recorded quarter-second grid.",
          },
          rankedRepairs: [
            {
              action: {
                parameterId: "exposure",
                value: Math.floor(exposureSteps) * CAMERA_GRID_DT,
              },
              label: "Use the preceding recorded exposure",
            },
          ],
        },
      ),
    };
  const stride = p.dt / CAMERA_GRID_DT;
  if (p.M * stride + exposureSteps > steps)
    return bad(
      "This exposure extends beyond the retained path. Reduce the number of frames or frame spacing explicitly.",
    );
  return { kind: "accepted", data: { stride, exposureSteps } };
}
export function observeCameraPath(
  recording: CameraRecording,
  p: CameraObservation,
): Computation<CameraFrames> {
  const grid = cameraGrid(p, recording.steps);
  if (grid.kind !== "accepted") return grid;
  const { stride, exposureSteps } = grid.data;
  const times = Float64Array.from({ length: p.M + 1 }, (_, i) => i * p.dt);
  const ideal = new Float64Array((p.M + 1) * p.d),
    blurred = ideal.slice(),
    observed = ideal.slice();
  for (let i = 0; i <= p.M; i++) {
    const index = i * stride;
    // Timestamp-indexed noise: changing frame count or spacing cannot shuffle
    // the error at an already observed timestamp. Both latent axes always exist.
    const noise = createPhiloxStream(
      { seed: p.noiseSeed, kernel: CAMERA_KERNELS.localization, tile: recording.replicate },
      BigInt(index) * 4n,
    );
    for (let c = 0; c < 2; c++) {
      const error = noise.nextNormal();
      if (c >= p.d) continue;
      const at = i * p.d + c;
      ideal[at] = recording.positions[index * 2 + c]!;
      let average = ideal[at]!;
      if (exposureSteps) {
        average = 0;
        for (let k = 0; k < exposureSteps; k++)
          average += recording.averages[(index + k) * 2 + c]! / exposureSteps;
      }
      blurred[at] = average;
      observed[at] =
        average + p.sigma * error + (c === 0 ? p.stageDrift * (times[i]! + p.exposure / 2) : 0);
    }
  }
  const increments = new Float64Array(p.M * p.d);
  for (let i = 0; i < increments.length; i++) increments[i] = observed[i + p.d]! - observed[i]!;
  const stationary = new Float64Array(p.clicks * p.d);
  for (let i = 0; i < p.clicks; i++) {
    const click = createPhiloxStream(
      { seed: p.clickSeed, kernel: CAMERA_KERNELS.stationary, tile: i },
      BigInt(recording.replicate) * 4n,
    );
    for (let c = 0; c < 2; c++) {
      const z = click.nextNormal();
      if (c < p.d) stationary[i * p.d + c] = p.sigma * z;
    }
  }
  if (![ideal, blurred, observed, increments, stationary].every((a) => a.every(Number.isFinite)))
    return bad("The observed positions cannot be represented at this scale.");
  return {
    kind: "accepted",
    data: Object.freeze({
      times,
      ideal,
      blurred,
      observed,
      increments,
      stationary,
      measurementDraws: 4 * (p.M + 1 + p.clicks),
    }),
  };
}
