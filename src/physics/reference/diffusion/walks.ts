import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import { BM05_ALLOCATION, bm05Tile } from "../../../experiments/streams/allocation.ts";
import { createPhiloxStream, HOST_NORMAL_VERSION, parseU64 } from "../philox.ts";
import type { Computation } from "./ftcs.ts";
import { WALK_KERNELS, type WalkKernel } from "./walkLaws.ts";

export const WALK_BUDGET = Object.freeze({
  workUnits: 5_000_000,
  allocationBytes: 8 * 1024 * 1024,
});
export const WALK_TRACE_COUNT = 20;
export const WALK_MILESTONES = Object.freeze([4, 16, 64, 400]);
export type WalkSetup = Readonly<{
  walkers: number;
  runSteps: number;
  stepRms: number;
  tau: number;
  kernel: WalkKernel;
  seed: string;
}>;
/** Private worker storage: a few all-member checkpoints and at most twenty full traces.
 * The checkpoint map never crosses the publication boundary. At most eight entries
 * are retained; arbitrary observations replay a fixed stream segment, not a new trial.
 */
export type WalkRecording = Readonly<{
  setup: WalkSetup;
  /** The engine that drew this walk's normals. A replay draws through it too, never another. */
  normals: WalkNormalSource;
  /** Who drew the steps: this reference, or the owner the normal source named on its draws. */
  drawOwner: string;
  checkpoints: Map<number, Float64Array>;
  traceValues: Float64Array;
  protectedSteps: ReadonlySet<number>;
  allocationId: string;
  normalVersion: string;
  draws: number;
  retainedBytes: number;
}>;
export type WalkExecutionOptions = Readonly<{
  chunkWork?: number;
  cancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
  /** Who draws a Gaussian walk's normals; this reference's Philox stream unless given. */
  normals?: WalkNormalSource | undefined;
}>;
/** One walker's run of standard normals, named by whoever drew it. */
export type WalkDraws = Readonly<{ values: Float64Array; ownerId: string; normalVersion: string }>;
/**
 * The standard normals of a walker's stream, `count` of them from step `startStep`: kernel
 * BM05_ALLOCATION.streamKernelId, tile bm05Tile(walker), two draws per normal. The owner travels
 * with the draws, so a source that hands back this reference's draws cannot name another engine.
 */
export type WalkNormalSource = Readonly<{
  normals(seed: string, walker: number, startStep: number, count: number): Computation<WalkDraws>;
}>;
/** The draws' owner when this reference draws them, as BM-05's contracts register it. */
export const HOST_WALK_DRAW_OWNER = "diffusion.recordWalks";
export const HOST_WALK_NORMALS: WalkNormalSource = Object.freeze({
  normals(seed: string, walker: number, startStep: number, count: number): Computation<WalkDraws> {
    const rng = createPhiloxStream(
      { seed, kernel: BM05_ALLOCATION.streamKernelId, tile: bm05Tile(walker) },
      BigInt(startStep * WALK_KERNELS.gaussian.drawsPerStep),
    );
    const values = new Float64Array(count);
    for (let i = 0; i < count; i++) values[i] = rng.nextNormal();
    return {
      kind: "accepted",
      data: { values, ownerId: HOST_WALK_DRAW_OWNER, normalVersion: HOST_NORMAL_VERSION },
    };
  },
});
const invalid = (requirements: string): Computation<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "invalid-parameter",
    { capabilityId: "diffusion.recordWalks" },
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
const cancelled = (): Computation<never> => ({
  kind: "outcome",
  outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
});
function validate(p: WalkSetup): Computation<WalkSetup> {
  if (
    !p ||
    !Object.hasOwn(WALK_KERNELS, p.kernel) ||
    !Number.isInteger(p.walkers) ||
    p.walkers < 1 ||
    p.walkers > 10000 ||
    !Number.isInteger(p.runSteps) ||
    p.runSteps < 1 ||
    p.runSteps > 10000 ||
    !Number.isFinite(p.stepRms) ||
    p.stepRms <= 0 ||
    !Number.isFinite(p.tau) ||
    p.tau <= 0
  )
    return invalid(
      "Use a supported kernel, 1–10000 walkers, 1–10000 steps, and positive finite step size and interval.",
    );
  try {
    if (typeof p.seed !== "string") throw new Error();
    parseU64(p.seed);
  } catch {
    return { kind: "refused", refusal: makeRefusal("invalid-seed", { parameterIds: ["seed"] }) };
  }
  if (
    !Number.isFinite(p.stepRms * Math.sqrt(3)) ||
    !Number.isFinite(p.runSteps * p.tau) ||
    p.runSteps * p.tau === 0
  )
    return failed("Step amplitude or elapsed time is not representable.");
  const workUnits = p.walkers * p.runSteps;
  // The ceiling includes eight endpoint vectors and the full sampled traces, plus
  // scratch reductions and one observation vector. No W*N path buffer is allocated.
  const allocationBytes =
    (Math.min(WALK_TRACE_COUNT, p.walkers) * (p.runSteps + 1) + p.walkers * 12) * 8;
  if (workUnits > WALK_BUDGET.workUnits || allocationBytes > WALK_BUDGET.allocationBytes)
    return {
      kind: "outcome",
      outcome: {
        outcome: "budget-exhausted",
        ...executionOutcomeRegistry["budget-exhausted"],
        requested: { workUnits, allocationBytes },
        allowed: WALK_BUDGET,
        details: {
          reason: "Reduce the walker count or recorded steps; the trial is never silently reduced.",
        },
      },
    };
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
function execution(options: WalkExecutionOptions) {
  const chunk = options.chunkWork ?? 8192;
  if (!Number.isSafeInteger(chunk) || chunk < 1 || chunk > 65536)
    throw new RangeError("Use 1–65536 deterministic steps per chunk.");
  return {
    chunk,
    yieldControl:
      options.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0))),
  };
}
type Sampler = Readonly<{ next: () => number; ownerId: string; normalVersion: string }>;
/**
 * A walker's steps from `startStep`. A coin or uniform step reads this reference's stream; a
 * Gaussian step reads `count` normals from the given source, in one run.
 */
function sampler(
  p: WalkSetup,
  walker: number,
  startStep: number,
  count: number,
  source: WalkNormalSource,
): Computation<Sampler> {
  const amplitude = p.stepRms,
    halfWidth = Math.sqrt(3) * amplitude;
  if (p.kernel === "gaussian") {
    const drawn = source.normals(p.seed, walker, startStep, count);
    if (drawn.kind !== "accepted") return drawn;
    if (drawn.data.values.length !== count)
      return failed("A normal source returned a different number of draws than asked for.");
    const z = drawn.data.values;
    let i = 0;
    return {
      kind: "accepted",
      data: {
        next: () => (z[i++] ?? Number.NaN) * amplitude,
        ownerId: drawn.data.ownerId,
        normalVersion: drawn.data.normalVersion,
      },
    };
  }
  const rng = createPhiloxStream(
    { seed: p.seed, kernel: BM05_ALLOCATION.streamKernelId, tile: bm05Tile(walker) },
    BigInt(startStep * WALK_KERNELS[p.kernel].drawsPerStep),
  );
  const next =
    p.kernel === "coin"
      ? () => (rng.nextU64() >> 63n ? amplitude : -amplitude)
      : () => (2 * rng.nextF64() - 1) * halfWidth;
  return {
    kind: "accepted",
    data: { next, ownerId: HOST_WALK_DRAW_OWNER, normalVersion: HOST_NORMAL_VERSION },
  };
}
export async function recordWalks(
  input: WalkSetup,
  selectedStep: number,
  options: WalkExecutionOptions = {},
): Promise<Computation<WalkRecording>> {
  const valid = validate(input);
  if (valid.kind !== "accepted") return valid;
  const p = valid.data;
  if (!Number.isInteger(selectedStep) || selectedStep < 0 || selectedStep > p.runSteps)
    return invalid("Observe an integer step within the declared recording.");
  let config: ReturnType<typeof execution>;
  try {
    config = execution(options);
  } catch {
    return invalid("Use a bounded deterministic chunk size.");
  }
  if (options.cancelled?.()) return cancelled();
  const protectedSteps = new Set([
    0,
    ...WALK_MILESTONES.filter((n) => n <= p.runSteps),
    p.runSteps,
  ]);
  const checkpoints = new Map(
    [...new Set([...protectedSteps, selectedStep])]
      .sort((a, b) => a - b)
      .map((n) => [n, new Float64Array(p.walkers)]),
  );
  const traceValues = new Float64Array(Math.min(WALK_TRACE_COUNT, p.walkers) * (p.runSteps + 1));
  const source = options.normals ?? HOST_WALK_NORMALS;
  let drawOwner: string | null = null;
  let normalVersion = HOST_NORMAL_VERSION;
  let work = 0;
  for (let walker = 0; walker < p.walkers; walker++) {
    const drawn = sampler(p, walker, 0, p.runSteps, source);
    if (drawn.kind !== "accepted") return drawn;
    // One walk, one producer: every walker's draws must name the same owner.
    if (drawOwner !== null && drawn.data.ownerId !== drawOwner)
      return failed("The walkers' draws name different producers; no partial trial was accepted.");
    drawOwner = drawn.data.ownerId;
    normalVersion = drawn.data.normalVersion;
    const next = drawn.data.next;
    let x = 0;
    for (let n = 1; n <= p.runSteps; n++) {
      if (work % config.chunk === 0) {
        if (options.cancelled?.()) return cancelled();
        await config.yieldControl();
        if (options.cancelled?.()) return cancelled();
      }
      x += next();
      work++;
      if (!Number.isFinite(x))
        return failed(
          "A walk coordinate exceeded the representable range; no partial trial was accepted.",
        );
      const checkpoint = checkpoints.get(n);
      if (checkpoint) checkpoint[walker] = x;
      if (walker < WALK_TRACE_COUNT) traceValues[walker * (p.runSteps + 1) + n] = x;
    }
  }
  if (options.cancelled?.()) return cancelled();
  return {
    kind: "accepted",
    data: Object.freeze({
      setup: p,
      normals: source,
      drawOwner: drawOwner ?? HOST_WALK_DRAW_OWNER,
      checkpoints,
      traceValues,
      protectedSteps,
      allocationId: BM05_ALLOCATION.allocationId,
      normalVersion,
      draws: work * WALK_KERNELS[p.kernel].drawsPerStep,
      retainedBytes:
        traceValues.byteLength +
        [...checkpoints.values()].reduce((sum, a) => sum + a.byteLength, 0),
    }),
  };
}
export type WalkObservation = Readonly<{
  positions: Float64Array;
  replayedDraws: number;
  cached: boolean;
}>;
/** A new n may require deterministic replay. Expose that work separately from the
 * fixed realization's logical draws; never claim a replay made zero PRNG calls.
 */
export async function observeWalks(
  recording: WalkRecording,
  n: number,
  options: WalkExecutionOptions = {},
): Promise<Computation<WalkObservation>> {
  const { setup: p } = recording;
  if (!Number.isInteger(n) || n < 0 || n > p.runSteps)
    return invalid("Choose an integer observation step within the recording.");
  if (options.cancelled?.()) return cancelled();
  const cached = recording.checkpoints.get(n);
  if (cached)
    return { kind: "accepted", data: { positions: cached, replayedDraws: 0, cached: true } };
  let config: ReturnType<typeof execution>;
  try {
    config = execution(options);
  } catch {
    return invalid("Use a bounded deterministic chunk size.");
  }
  let start = 0;
  for (const saved of recording.checkpoints.keys()) if (saved < n && saved > start) start = saved;
  const previous = recording.checkpoints.get(start);
  if (!previous) return failed("A base checkpoint is missing from the recording.");
  const positions = new Float64Array(p.walkers);
  let work = 0;
  for (let walker = 0; walker < p.walkers; walker++) {
    const startX = previous[walker];
    if (startX === undefined)
      return failed("A base checkpoint has fewer walker positions than expected.");
    let x = startX;
    // The replay draws through the recording's own engine, so it continues the same walk.
    const drawn = sampler(p, walker, start, n - start, recording.normals);
    if (drawn.kind !== "accepted") return drawn;
    if (drawn.data.ownerId !== recording.drawOwner)
      return failed("A replay's draws name a different producer than the recording's.");
    const next = drawn.data.next;
    for (let step = start; step < n; step++) {
      if (work % config.chunk === 0) {
        if (options.cancelled?.()) return cancelled();
        await config.yieldControl();
        if (options.cancelled?.()) return cancelled();
      }
      x += next();
      work++;
      if (!Number.isFinite(x)) return failed("A replayed coordinate is not representable.");
    }
    positions[walker] = x;
  }
  if (options.cancelled?.()) return cancelled();
  // Publish a checkpoint only after successful completion. Keep fixed milestones
  // and a bounded FIFO of other observations; cancellation never poisons the cache.
  recording.checkpoints.set(n, positions);
  while (recording.checkpoints.size > 8) {
    const discard = [...recording.checkpoints.keys()].find(
      (k) => !recording.protectedSteps.has(k) && k !== n,
    );
    if (discard === undefined) break;
    recording.checkpoints.delete(discard);
  }
  return {
    kind: "accepted",
    data: { positions, replayedDraws: work * WALK_KERNELS[p.kernel].drawsPerStep, cached: false },
  };
}
