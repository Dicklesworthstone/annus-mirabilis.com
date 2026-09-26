/**
 * BM-05's Gaussian steps drawn by FrankenSim's compiled philox_normals
 * (am-frankensim-repin-and-bind-jvhg, dispatch 269).
 *
 * A walker's steps are one contiguous run of standard normals from its own Philox stream: kernel
 * BM05_ALLOCATION.streamKernelId, tile bm05Tile(walker), two draws per normal, from draw
 * 2 x startStep. philox_normals(seed, kernel, tile, startIndex, count) returns exactly that run,
 * with the same stream-key derivation as fs-rand. The Philox integers are bitwise the host's. The
 * normal transform uses fs-math's ln and cos, so the values agree with the host's within a
 * stated tolerance (frankensimWalkNormals.test.ts measures it), not bitwise.
 *
 * The draws carry this module's owner, fs-wasm.philox_normals, and walks.ts names the walk by the
 * owner its draws carry. A recording keeps its source, so a replay draws through the same engine.
 * BM-05 admits at most 10,000 steps, so no request reaches the module's own refusals (a zero
 * count, more than 1,048,576 normals, a wrapping index). If one did, it would be returned typed,
 * never replaced by the host's draws.
 */
import { BM05_FRANKENSIM_DRAW_OWNER } from "../../experiments/bm05/definition.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import { BM05_ALLOCATION, bm05Tile } from "../../experiments/streams/allocation.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import type { WalkDraws, WalkNormalSource } from "../../physics/reference/diffusion/walks.ts";
import { callPhiloxNormals, type FrankenSimExports } from "./frankensimCalls.ts";
import { FRANKENSIM_NORMAL_VERSION } from "./frankensimTracerRecorder.ts";

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

export function frankensimWalkNormals(exports: FrankenSimExports): WalkNormalSource {
  return Object.freeze({
    normals(
      seed: string,
      walker: number,
      startStep: number,
      count: number,
    ): Computation<WalkDraws> {
      const call = callPhiloxNormals(exports, {
        seed,
        streamKernel: BM05_ALLOCATION.streamKernelId,
        tile: bm05Tile(walker),
        startIndex: (BigInt(startStep) * 2n).toString(),
        count,
      });
      if (call.kind === "outcome") return { kind: "outcome", outcome: call.outcome };
      if (call.kind === "refused")
        return {
          kind: "refused",
          refusal: Object.keys(call.refusal.affected).length
            ? call.refusal
            : { ...call.refusal, affected: { capabilityId: BM05_FRANKENSIM_DRAW_OWNER } },
        };
      const layout = call.ok.layout as { length?: unknown } | undefined;
      if (call.values.length !== count || layout?.length !== count)
        return malformed("philox_normals returned another number of normals than asked for.");
      if (!call.values.every(Number.isFinite))
        return malformed("philox_normals returned a normal that is not finite.");
      return {
        kind: "accepted",
        data: Object.freeze({
          values: call.values,
          ownerId: BM05_FRANKENSIM_DRAW_OWNER,
          normalVersion: FRANKENSIM_NORMAL_VERSION,
        }),
      };
    },
  });
}
