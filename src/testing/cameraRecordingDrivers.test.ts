/**
 * THE TWO DRIVERS OF ONE RECORDING LOOP AGREE, BITWISE (am-jzk1).
 *
 * `recordCameraPath` was `async` for one reason: a `setTimeout(0)` yield released the worker thread every
 * `chunkSteps` steps of a 4112-step loop, with a cancellation check after it. The arithmetic never awaited
 * anything. That asynchrony propagated - `measureBm08` became async, and BM-08's estimator outputs went out
 * of reach of the scenario registry, whose `OwnerFn` is synchronous - so four of bm-08's acceptance refs
 * could not be written at all.
 *
 * The loop is now a generator with two drivers: the async one awaits at each yield, exactly where the old
 * `await yieldControl()` sat, and the sync one drains it. There is ONE loop body, so agreement is by
 * construction. This file is the check that the construction is what it claims: a copied loop would need
 * this test and would eventually fail it, which is the risk the generator exists to remove.
 *
 * WHAT WOULD MAKE THIS TEST VACUOUS, and why it is not. Comparing two calls that both returned a refusal
 * would pass trivially, so the first test asserts the recording is ACCEPTED and names how many numbers it
 * compared. 4112 steps of two coordinates is 8226 positions and 8224 averages; a run that compared zero
 * would be a failed citation, not a clean result.
 */
import { describe, expect, test } from "bun:test";
import type { Computation } from "../physics/reference/diffusion/ftcs.ts";
import {
  CAMERA_GRID_STEPS,
  type CameraRecording,
  recordCameraPath,
  recordCameraPathSync,
} from "../physics/reference/inference/camera.ts";

const SETUP = { seed: "1905", D: 0.42944e-12, flowDrift: 0 } as const;
const accepted = (r: Computation<CameraRecording>): CameraRecording => {
  if (r.kind !== "accepted") throw new Error(`expected an accepted recording, got ${r.kind}`);
  return r.data;
};

describe("recordCameraPath and recordCameraPathSync drive one loop", () => {
  test("every number of a full recording is bitwise identical between the two drivers", async () => {
    const viaAsync = accepted(await recordCameraPath(SETUP));
    const viaSync = accepted(recordCameraPathSync(SETUP));
    // The denominator, stated: a comparison over an empty pair of arrays would pass and prove nothing.
    expect(viaAsync.positions.length).toBe((CAMERA_GRID_STEPS + 1) * 2);
    expect(viaAsync.averages.length).toBe(CAMERA_GRID_STEPS * 2);
    const compared = viaAsync.positions.length + viaAsync.averages.length;
    expect(compared).toBeGreaterThan(16_000);
    let differing = 0;
    for (let i = 0; i < viaAsync.positions.length; i++)
      if (viaAsync.positions[i] !== viaSync.positions[i]) differing += 1;
    for (let i = 0; i < viaAsync.averages.length; i++)
      if (viaAsync.averages[i] !== viaSync.averages[i]) differing += 1;
    console.log(`[camera drivers] ${compared} numbers compared; ${differing} differ`);
    expect(differing).toBe(0);
    // And the identities beside the numbers, since a driver could agree on the path and not on the ledger.
    expect(viaSync.draws).toBe(viaAsync.draws);
    expect(viaSync.bytes).toBe(viaAsync.bytes);
    expect(viaSync.steps).toBe(viaAsync.steps);
    expect(viaSync.replicate).toBe(viaAsync.replicate);
  });

  test("a chunk larger than the step count never yields, and still agrees", async () => {
    // The yield is at `(step + 1) % chunk === 0`, so a chunk past the end exercises the path where the
    // async driver awaits nothing at all. If the two drivers differed only in their yielding, this is the
    // case that would hide it, so it is asserted rather than assumed.
    const options = { chunkSteps: CAMERA_GRID_STEPS } as const;
    const viaAsync = accepted(await recordCameraPath(SETUP, options, 0, 64));
    const viaSync = accepted(recordCameraPathSync(SETUP, options, 0, 64));
    expect(viaSync.positions.length).toBe(130);
    expect([...viaSync.positions]).toEqual([...viaAsync.positions]);
    expect([...viaSync.averages]).toEqual([...viaAsync.averages]);
  });

  test("a different seed gives a different path, so the agreement above is not a constant", async () => {
    const other = accepted(recordCameraPathSync({ ...SETUP, seed: "1926" }, {}, 0, 64));
    const base = accepted(recordCameraPathSync(SETUP, {}, 0, 64));
    expect([...other.positions]).not.toEqual([...base.positions]);
  });

  test("both drivers refuse the same way, and for the same reasons", async () => {
    for (const [label, setup] of [
      ["a seed that is not an unsigned 64-bit integer", { ...SETUP, seed: "not a seed" }],
      ["a nonpositive diffusivity", { ...SETUP, D: 0 }],
      ["a nonfinite drift", { ...SETUP, flowDrift: Number.NaN }],
    ] as const) {
      const viaAsync = await recordCameraPath(setup);
      const viaSync = recordCameraPathSync(setup);
      expect(viaSync.kind, label).toBe(viaAsync.kind);
      expect(viaSync.kind, label).toBe("refused");
      expect(JSON.stringify(viaSync), label).toBe(JSON.stringify(viaAsync));
    }
    // And a bounded-recording refusal, which is checked before the loop rather than inside it.
    expect(recordCameraPathSync(SETUP, {}, 0, CAMERA_GRID_STEPS + 1).kind).toBe("refused");
    expect(recordCameraPathSync(SETUP, { chunkSteps: 0 }).kind).toBe("refused");
  });

  test("the sync driver honours a cancelled predicate at a chunk boundary", () => {
    // The generator checks `cancelled` after each yield, so a sync caller still gets a cancellation even
    // though it never releases the thread. Cancelling after the first chunk must not return a path.
    let chunks = 0;
    const result = recordCameraPathSync(SETUP, {
      chunkSteps: 8,
      cancelled: () => ++chunks > 1,
    });
    expect(result.kind).toBe("outcome");
    if (result.kind === "outcome") expect(result.outcome.outcome).toBe("cancelled");
    // Not cancelled: the same settings with a predicate that never fires must accept, so the test above
    // is about the predicate rather than about the chunk size.
    expect(recordCameraPathSync(SETUP, { chunkSteps: 8, cancelled: () => false }, 0, 64).kind).toBe(
      "accepted",
    );
  });
});
