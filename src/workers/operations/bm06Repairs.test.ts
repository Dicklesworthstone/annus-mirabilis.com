/**
 * Every repair BM-06 offers is a repair: applied as written, it is accepted (am-xry2, dispatch 261).
 *
 * A refusal's rankedRepairs are buttons on the page. BrownianLab applies one by setting the named
 * parameter to the offered value and recalculating, and nothing else. So each repair here is
 * applied the same way, to the refused settings, and the result must be accepted. A repair that
 * ends in another refusal, or in an execution outcome, sends the reader from one error to the
 * next. That is stricter than "never invariant-violation", because a repair offered but refused
 * does not repair anything.
 *
 * Measured on the code before the fix, over the population below: 61 refused settings, 110
 * repairs, 40 accepted and 70 not.
 * - 19 invariant-violation, where a far cell's analytic probability underflowed. One is the
 *   page's own preset: "Try a step that is too large", then "Use a coarser spatial grid.",
 *   dx = 0.927 um.
 * - 14 budget-exhausted, where a steps repair asked for more than the 4,000,000 cell-steps.
 * - 37 outside-model-domain, where a coarser grid was wider than the 10 um the lab allows.
 *
 * Both engines step the grid: the host reference, and FrankenSim's diffusion1d_frames from the
 * pinned module. They offer the same repairs (frankensimFtcsGrid.test.ts), and each repair is
 * applied on each.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  BM06_DEFAULTS,
  BM06_PRESETS,
  type Bm06Parameters,
} from "../../experiments/bm06/definition.ts";
import { frankensimGridStepper } from "../wasm/frankensimFtcsGrid.ts";
import { PINNED_ARTIFACT } from "../wasm/pinnedArtifact.ts";
import { loadPinnedBundle } from "../wasm/pinnedBundle.ts";
import { type Bm06GridStepper, evaluateBm06, HOST_GRID_STEPPER } from "./bm06.ts";

const quiet = { yieldControl: async () => {}, chunkSteps: 1024 };
let engines: readonly (readonly [string, Bm06GridStepper])[] = [];

beforeAll(async () => {
  const loaded = await loadPinnedBundle({
    wasmUrl: resolve(
      "public/wasm",
      PINNED_ARTIFACT.bundleId,
      PINNED_ARTIFACT.hashPrefix,
      PINNED_ARTIFACT.wasmFile,
    ),
    readBytes: (p) => readFile(p),
  });
  if (loaded.kind !== "loaded") throw new Error(loaded.message);
  engines = [
    ["host", HOST_GRID_STEPPER],
    ["frankensim", frankensimGridStepper(loaded.exports)],
  ];
});

/**
 * The page's own preset first, then grids across BM-06's declared domain: 3, 101 and 4097 cells;
 * widths from 1 nm to 10 um; 1 s to an hour; one or ten steps. Then the fastest and slowest
 * spreading the physical settings allow.
 */
function population(): { name: string; p: Bm06Parameters }[] {
  const out: { name: string; p: Bm06Parameters }[] = [
    {
      name: `preset "${BM06_PRESETS["unstable-grid"].label}"`,
      p: BM06_PRESETS["unstable-grid"].parameters,
    },
  ];
  for (const n of [3, 101, 4097])
    for (const dx of [1e-9, 1e-7, 1e-6, 1e-5])
      for (const t of [1, 600, 3600])
        for (const steps of [1, 10])
          out.push({
            name: `n=${n} dx=${dx} t=${t} steps=${steps}`,
            p: { ...BM06_DEFAULTS, gridEnabled: true, n, dx, t, steps },
          });
  for (const a of [1e-8, 1e-5])
    out.push({ name: `a=${a} steps=1`, p: { ...BM06_DEFAULTS, gridEnabled: true, a, steps: 1 } });
  out.push({
    name: "fastest spreading, an hour, 10 um cells, one step",
    p: {
      ...BM06_DEFAULTS,
      gridEnabled: true,
      T: 373.15,
      eta: 0.0002,
      a: 1e-8,
      t: 3600,
      dx: 1e-5,
      steps: 1,
    },
  });
  return out;
}

function verdict(r: Awaited<ReturnType<typeof evaluateBm06>>): string {
  if (r.kind === "accepted") return "accepted";
  if (r.kind === "refused") return `refused:${r.refusal.code}`;
  const reason = (r.outcome.details as { reason?: unknown } | undefined)?.reason;
  return `outcome:${r.outcome.outcome}${typeof reason === "string" ? ` (${reason})` : ""}`;
}

describe("BM-06: a repair the page offers leads to an accepted grid", () => {
  test("every offered repair, applied as written on either engine, is accepted", async () => {
    const failures: string[] = [];
    let refused = 0;
    let applied = 0;
    for (const [engine, stepper] of engines)
      for (const { name, p } of population()) {
        const r = await evaluateBm06(p, quiet, stepper);
        if (r.kind !== "refused") continue;
        refused++;
        for (const repair of r.refusal.rankedRepairs) {
          if (!repair.action) continue;
          applied++;
          const repaired = { ...p, [repair.action.parameterId]: repair.action.value };
          const after = verdict(await evaluateBm06(repaired, quiet, stepper));
          if (after !== "accepted")
            failures.push(
              `${engine}, ${name}: "${repair.label}" (${repair.action.parameterId} = ${repair.action.value}) gives ${after}`,
            );
        }
      }
    console.log(
      `[bm06Repairs] ${engines.length} engines, ${refused} refused settings, ${applied} repairs applied, ${failures.length} not accepted`,
    );
    // Non-vacuity: the population reaches refusals with repairs on both engines.
    expect(engines.length).toBe(2);
    expect(applied).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  }, 300_000);

  test("the page's own preset and its coarser-grid repair: the 0.927 um case", async () => {
    const p = BM06_PRESETS["unstable-grid"].parameters;
    for (const [engine, stepper] of engines) {
      const r = await evaluateBm06(p, quiet, stepper);
      expect(verdict(r), engine).toBe("refused:ftcs-unstable");
      if (r.kind !== "refused") continue;
      const coarser = r.refusal.rankedRepairs.find((x) => x.action?.parameterId === "dx");
      // The width the page offers here: sqrt(2 D dt) at the default sphere, 1 s and one step.
      expect(Number(coarser?.action?.value), engine).toBeCloseTo(9.2676e-7, 10);
      const after = await evaluateBm06(
        { ...p, dx: Number(coarser?.action?.value) },
        quiet,
        stepper,
      );
      expect(`${engine}: dx = 0.927 um gives ${verdict(after)}`).toBe(
        `${engine}: dx = 0.927 um gives accepted`,
      );
    }
  });
});
