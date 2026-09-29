/**
 * The bounded wait that replaced a blind sleep (dispatch 504).
 *
 * WHAT THIS PINS AND WHY. Three candidates refused `accepted-wasm-result-per-capability` on BM-01
 * while the laboratory worked in every other condition. Driven against one real deployment, one
 * build and the real `vercelCurlFetcher`, changing only the ORDER of WASM_CAPABILITY_TARGETS:
 *
 *   bm-01 first -> bm-01 FAILS with 0 wasm requests; bm-05 and bm-06 pass
 *   bm-01 last  -> bm-05 FAILS with 0 wasm requests; bm-06 and bm-01 pass
 *
 * The defect followed the POSITION, not the laboratory. Every byte reaches that browser through its
 * own `vercel curl` subprocess, about 300ms each, so the first lab driven pays for its worker chunk
 * AND the WASM artifact with a cold cache, and the probe's `waitForTimeout(8000)` expired before the
 * fetch was even made. BM-01 refused three candidates for being first in a list.
 *
 * A bounded wait is the most reversible kind of change there is. Someone will want this suite
 * faster, and the whole chain gets walked again unless something here goes red. These tests live in
 * the bun lane, which is NOT the lane this gate controls: a gate proved only inside itself
 * disappears at the moment it fails open.
 */
import { describe, expect, test } from "bun:test";
import { RESULT_DEADLINE_MS, waitForResult } from "./candidateBrowserProbe.ts";

/** Records every sleep the wait asks for, and grants it instantly, so no test here is slow. */
function recordingSleep(): { sleeps: number[]; sleep: (ms: number) => Promise<void> } {
  const sleeps: number[] = [];
  return {
    sleeps,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
  };
}

describe("the probe waits for a result, not for a clock (dispatch 504)", () => {
  test("a result that needs several polls is still caught, and the wait ends when it arrives", async () => {
    const { sleeps, sleep } = recordingSleep();
    let asked = 0;
    const waited = await waitForResult(
      sleep,
      async () => {
        asked += 1;
        return asked > 4;
      },
      5000,
    );
    // It KEPT ASKING. A single check would have returned on the first unsettled answer, which is
    // the shape that reported [static] then [static] with 0 wasm requests.
    expect(asked).toBe(5);
    expect(sleeps.length).toBe(4);
    expect(waited).toBeLessThan(5000);
  });

  test("a result that is ready at once costs no wait at all", async () => {
    const { sleeps, sleep } = recordingSleep();
    const waited = await waitForResult(sleep, async () => true, 5000);
    // The version this replaced slept 8000ms BEFORE looking. Waiting for the result is stricter and
    // faster at the same time, and a reinstated sleep-then-look turns this red.
    expect(sleeps).toEqual([]);
    expect(waited).toBeLessThan(1000);
  });

  test("it gives up, so a page that never settles cannot hang a release", async () => {
    const { sleeps, sleep } = recordingSleep();
    const waited = await waitForResult(sleep, async () => false, 40);
    expect(waited).toBeGreaterThanOrEqual(40);
    expect(sleeps.length).toBeGreaterThan(0);
  });

  test("the deadline stays above what the transport needs", () => {
    /*
     * A FLOOR ON A MEASURED NUMBER, not a census. 8000ms is the value that failed: it is what the
     * blind sleep waited, and the first lab driven had not even issued its WASM request by then.
     * Measured on 2026-09-29 against annus-mirabilis-seven.vercel.app through the real fetcher, the
     * first lab's page alone took 16 to 24 seconds to serve its ~60 assets. A deadline tightened
     * under 30s re-admits exactly the failure this repair exists for, so it fails here first.
     */
    expect(RESULT_DEADLINE_MS).toBeGreaterThanOrEqual(30_000);
    // And bounded above, because a gate that waits forever is not a gate.
    expect(RESULT_DEADLINE_MS).toBeLessThanOrEqual(120_000);
  });
});
