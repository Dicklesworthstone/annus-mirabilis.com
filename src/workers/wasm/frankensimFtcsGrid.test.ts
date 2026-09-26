/**
 * BM-06's grid stepped by FrankenSim's diffusion1d_frames (am-frankensim-repin-and-bind-jvhg),
 * against the real pinned module: public/wasm/fs-annus-diffusion/80a1f8fda6f69003/.
 *
 * Three questions, each with a denominator printed beside its verdict:
 * - Positive control: does the grid's FrankenSim label follow an accepted module call, through the
 *   same session, scheduler, protocol and store a reader's page uses?
 * - Plant: when the JavaScript reference produces the field while the module is loaded, is the
 *   FrankenSim label withheld?
 * - Refusal: is a step too large for the scheme refused by the module itself, in the page's words?
 *
 * Comparison kind, and why it is bitwise. Both steppers apply r * (left - 2 * centre + right) to
 * every cell, with zero-flux walls, in the same order, from the same binary64 inputs. Measured
 * before this file asserted it: 101 of 101 cells equal at 250 steps and at 30,000 steps, and the
 * diffusion numbers equal. A tolerance here would hide the first ulp of divergence, which is
 * exactly the change of engine a reader must be told about.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gridRefusalSentences } from "../../components/lab/gridRefusalWords.ts";
import {
  BM06_DEFAULTS,
  BM06_FRANKENSIM_GRID_OWNER,
  BM06_HOST_GRID_OWNER,
  BM06_OUTPUTS,
  type Bm06Parameters,
} from "../../experiments/bm06/definition.ts";
import { gridExecutionKind } from "../../experiments/bm06/gridExecution.ts";
import { createBm06Session } from "../../experiments/bm06/session.ts";
import { ExecutionLabel } from "../../experiments/labels/ExecutionLabel.tsx";
import { encodeResult } from "../../experiments/results/codec.ts";
import { createBm06Host } from "../host/bm06Host.ts";
import {
  type Bm06Evaluation,
  type Bm06GridStepper,
  evaluateBm06,
  HOST_GRID_STEPPER,
} from "../operations/bm06.ts";
import { BM06_PROTOCOL, decodeLabResponse } from "../protocol/bm06.ts";
import type { FrankenSimExports } from "./frankensimCalls.ts";
import { frankensimGridStepper } from "./frankensimFtcsGrid.ts";
import { PINNED_ARTIFACT } from "./pinnedArtifact.ts";
import { loadPinnedBundle } from "./pinnedBundle.ts";

const wasmPath = resolve(
  "public/wasm",
  PINNED_ARTIFACT.bundleId,
  PINNED_ARTIFACT.hashPrefix,
  PINNED_ARTIFACT.wasmFile,
);
const quiet = { yieldControl: async () => {} };
const DIGEST = `source:sha256:${"c".repeat(64)}`;
const GRID: Bm06Parameters = { ...BM06_DEFAULTS, gridEnabled: true };

/** Every call the page's worker would make to the module goes through this counter. */
let moduleCalls = 0;
let frankensim: Bm06GridStepper;

beforeAll(async () => {
  const loaded = await loadPinnedBundle({ wasmUrl: wasmPath, readBytes: (p) => readFile(p) });
  if (loaded.kind !== "loaded") throw new Error(loaded.message);
  const real = loaded.exports;
  const counted: FrankenSimExports = {
    ...real,
    diffusion1d_frames: (...args: Parameters<FrankenSimExports["diffusion1d_frames"]>) => {
      moduleCalls++;
      return real.diffusion1d_frames(...args);
    },
  };
  frankensim = frankensimGridStepper(counted);
});

/** What these checks read from an output, from a worker's evaluation or from the store. */
type Output = Readonly<{ quantityId: string; ownerId: string; status: string; value?: unknown }>;
function output(outputs: readonly Output[], quantityId: string): Output {
  const found = outputs.find((o) => o.quantityId === quantityId);
  if (!found) throw new Error(`No ${quantityId} in the snapshot.`);
  return found;
}
function field(outputs: readonly Output[]): Float64Array {
  const grid = output(outputs, "gridDensity");
  if (grid.status !== "value" || !(grid.value instanceof Float64Array))
    throw new Error("The grid was not stepped.");
  return grid.value;
}
function labelMarkup(outputs: readonly Output[]): string {
  const kind = gridExecutionKind(outputs, false);
  return kind ? renderToStaticMarkup(createElement(ExecutionLabel, { state: kind })) : "";
}
async function accepted(p: Bm06Parameters, stepper?: Bm06GridStepper): Promise<Bm06Evaluation> {
  const r = await evaluateBm06(p, quiet, stepper);
  if (r.kind !== "accepted") throw new Error(`Expected an accepted run, got ${r.kind}.`);
  return r.data;
}

/** A BM-06 session wired as a reader's page is, with the worker's host run in-process. */
async function readerSession(stepper: Bm06GridStepper) {
  const evaluated = await accepted(BM06_DEFAULTS);
  const example = {
    sourceDigest: DIGEST,
    snapshotFunctionName: "gaussianPropagator",
    snapshotFunctionHash: "not-compared-here",
    parameters: BM06_DEFAULTS,
    results: evaluated.outputs.map(encodeResult),
    stepIndex: evaluated.stepIndex,
    simulationTime: evaluated.simulationTime,
  };
  const app = createBm06Session("fs-grid", example, () => {
    let send: ((message: unknown) => void) | null = null;
    const host = createBm06Host((m) => send?.(structuredClone(m)), DIGEST, stepper);
    return {
      send: (message) => void host.receive(structuredClone(message)),
      listen(onMessage) {
        send = onMessage;
        queueMicrotask(() => host.hello());
        return () => {
          send = null;
        };
      },
      dispose: () => host.dispose(),
    };
  });
  const settle = () =>
    new Promise<void>((done) => {
      if (!app.getSnapshot().pending) return done();
      const stop = app.subscribe(() => {
        if (!app.getSnapshot().pending) {
          stop();
          done();
        }
      });
    });
  return { app, settle };
}

describe("positive control: the grid's FrankenSim label follows an accepted module call", () => {
  test("the module steps the same field as the host reference, bitwise, and names itself", async () => {
    const settings: Bm06Parameters[] = [GRID, { ...GRID, t: 0 }, { ...GRID, t: 60, steps: 30000 }];
    let cells = 0;
    for (const p of settings) {
      const before = moduleCalls;
      const host = await accepted(p);
      const frank = await accepted(p, frankensim);
      expect(moduleCalls - before).toBe(1);
      const a = field(host.outputs);
      const b = field(frank.outputs);
      expect(b.length).toBe(p.n);
      expect([...b]).toEqual([...a]);
      cells += b.length;
      expect(output(frank.outputs, "stabilityRatio").value).toBe(
        output(host.outputs, "stabilityRatio").value,
      );
      expect(frank.stepIndex).toBe(host.stepIndex);
      for (const o of frank.outputs)
        expect(o.ownerId, o.quantityId).toBe(
          ["gridDensity", "stabilityRatio"].includes(o.quantityId)
            ? BM06_FRANKENSIM_GRID_OWNER
            : (BM06_OUTPUTS[o.quantityId]?.ownerId ?? "unregistered"),
        );
      expect(gridExecutionKind(frank.outputs, false)).toBe("frankensim-accepted");
      expect(gridExecutionKind(host.outputs, false)).toBe("host-accepted");
    }
    console.log(
      `[frankensimFtcsGrid] positive control: ${settings.length} settings, ${cells} cells compared bitwise, ${settings.length} module calls`,
    );
  });

  test("through the reader's session, the label appears only after the call, and the decoder admits it", async () => {
    const { app, settle } = await readerSession(frankensim);
    // The prepared example has no grid, so the page has nothing to label yet.
    expect(gridExecutionKind(app.getSnapshot().accepted?.outputs, true)).toBeNull();
    const before = moduleCalls;
    app.apply(GRID);
    await settle();
    const view = app.getSnapshot();
    expect(view.status).toBe("accepted");
    expect(moduleCalls - before).toBe(1);
    const outputs = view.accepted?.outputs ?? [];
    expect(labelMarkup(outputs)).toContain('data-execution-label="frankensim"');
    expect(labelMarkup(outputs)).toContain("Ideal model, computed with FrankenSim");
    // Moving the interval re-reads the stepped field: no second call, and the same honest label.
    app.apply({ ...GRID, lower: 0 });
    await settle();
    expect(moduleCalls - before).toBe(1);
    expect(gridExecutionKind(app.getSnapshot().accepted?.outputs, false)).toBe(
      "frankensim-accepted",
    );
    app.disconnect();
    console.log(
      `[frankensimFtcsGrid] session: ${outputs.length} outputs accepted, ${moduleCalls - before} module call, grid owner ${output(outputs, "gridDensity").ownerId}`,
    );
  });
});

describe("plant: the JavaScript reference's field never carries the FrankenSim label", () => {
  test("a loaded module whose step is replaced by the host reference is labelled a host calculation", async () => {
    // The worker has loaded and verified the module, but the step it runs is the JS reference's.
    // A label keyed on "module loaded" or on the stepper's type would say FrankenSim here.
    const planted: Bm06GridStepper = { ...frankensim, step: HOST_GRID_STEPPER.step };
    const before = moduleCalls;
    const direct = await accepted(GRID, planted);
    const { app, settle } = await readerSession(planted);
    app.apply(GRID);
    await settle();
    const outputs = app.getSnapshot().accepted?.outputs ?? [];
    app.disconnect();
    expect(moduleCalls - before).toBe(0);
    for (const outs of [direct.outputs, outputs]) {
      expect(output(outs, "gridDensity").ownerId).toBe(BM06_HOST_GRID_OWNER);
      expect(gridExecutionKind(outs, false)).toBe("host-accepted");
      expect(labelMarkup(outs)).not.toContain("FrankenSim");
      expect(labelMarkup(outs)).toContain('data-execution-label="host"');
    }
    console.log(
      `[frankensimFtcsGrid] plant: 2 snapshots examined (direct and session), 0 module calls, label host on both`,
    );
  });

  test("a run past the module's budget is stepped by the host and says so", async () => {
    // 3 cells x 600,000 steps: inside the site's 4,000,000 cell-steps, beyond the module's
    // 524,288 steps at two frames.
    const p = { ...GRID, n: 3, steps: 600_000 };
    const before = moduleCalls;
    const frank = await accepted(p, frankensim);
    expect(moduleCalls - before).toBe(0);
    expect(output(frank.outputs, "gridDensity").ownerId).toBe(BM06_HOST_GRID_OWNER);
    expect([...field(frank.outputs)]).toEqual([...field((await accepted(p)).outputs)]);
    expect(labelMarkup(frank.outputs)).not.toContain("FrankenSim");
  });

  test("the decoder refuses a snapshot whose grid outputs name two steppers, or an unadmitted one", async () => {
    const frank = await accepted(GRID, frankensim);
    const token = {
      experimentId: "bm-06",
      instanceId: "fs-grid",
      runId: "run-fs",
      parentRunId: null,
      actionIndex: 1,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: GRID,
    };
    const message = {
      messageKind: "result",
      protocolVersion: BM06_PROTOCOL,
      sourceDigest: DIGEST,
      token,
      result: { kind: "accepted", data: frank },
    };
    expect(() => decodeLabResponse(structuredClone(message), token, DIGEST)).not.toThrow();
    const reowned = (quantityId: string, ownerId: string) => {
      const copy = structuredClone(message);
      const target = copy.result.data.outputs.find((o) => o.quantityId === quantityId);
      if (!target) throw new Error(quantityId);
      (target as { ownerId: string }).ownerId = ownerId;
      return copy;
    };
    expect(() =>
      decodeLabResponse(reowned("stabilityRatio", BM06_HOST_GRID_OWNER), token, DIGEST),
    ).toThrow(/different steppers/);
    // A real FrankenSim export, but not one registered for this output.
    expect(() =>
      decodeLabResponse(reowned("gridDensity", "fs-wasm.brownian_frames"), token, DIGEST),
    ).toThrow(/registered owner/);
    // The comparison outputs are the host's reading of the field, whoever stepped it.
    expect(() =>
      decodeLabResponse(reowned("cellMasses", BM06_FRANKENSIM_GRID_OWNER), token, DIGEST),
    ).toThrow(/registered owner/);
  });
});

describe("refusal: a step too large for the scheme is refused by the module, in the page's words", () => {
  test("the module's own refusal reaches the reader with the host's repairs and its diffusion number", async () => {
    const p = { ...GRID, steps: 1 };
    const before = moduleCalls;
    const frank = await evaluateBm06(p, quiet, frankensim);
    const host = await evaluateBm06(p, quiet);
    expect(moduleCalls - before).toBe(1);
    if (frank.kind !== "refused" || host.kind !== "refused") throw new Error("Not refused.");
    expect(frank.refusal.code).toBe("ftcs-unstable");
    expect((frank.refusal.details as { upstreamCode?: string }).upstreamCode).toBe("ftcs-unstable");
    // The page offers the same repairs whichever engine refused: a number of time steps, and a
    // coarser grid.
    expect(frank.refusal.rankedRepairs).toEqual(host.refusal.rankedRepairs);
    const [steps, dx] = frank.refusal.rankedRepairs;
    expect(steps?.action?.parameterId).toBe("steps");
    expect(dx?.action?.parameterId).toBe("dx");
    // Applying the steps repair runs, on the module, inside the limit.
    const repaired = await evaluateBm06(
      { ...p, steps: Number(steps?.action?.value) },
      quiet,
      frankensim,
    );
    expect(repaired.kind).toBe("accepted");
    if (repaired.kind === "accepted") {
      expect(output(repaired.data.outputs, "stabilityRatio").value as number).toBeLessThanOrEqual(
        0.5,
      );
      expect(output(repaired.data.outputs, "gridDensity").ownerId).toBe(BM06_FRANKENSIM_GRID_OWNER);
    }
    // The dx repair is stable at the module's own boundary: the module steps it. (The whole run at
    // that dx then stops in the host's analytic comparison, whose far-tail cell probability
    // underflows at any dx near 1 um, on either engine. That is a separate defect, not this one.)
    const D = output((await accepted(BM06_DEFAULTS)).outputs, "activeDiffusionCoefficient")
      .value as number;
    const coarse = Number(dx?.action?.value);
    const stepped = await frankensim.step(
      { n: p.n, D, dx: coarse, dt: p.t / p.steps, steps: p.steps },
      { cancelled: () => false, yieldControl: async () => {}, chunkSteps: 64 },
    );
    expect(stepped.kind).toBe("accepted");
    if (stepped.kind === "accepted") {
      expect(stepped.data.stabilityRatio).toBeLessThanOrEqual(0.5);
      expect(stepped.data.ownerId).toBe(BM06_FRANKENSIM_GRID_OWNER);
    }
    const words = gridRefusalSentences(frank.refusal);
    expect(words.join(" ")).toContain("diffusion number D·Δt/Δx² of 42.944");
    expect(words.join(" ")).toContain("only up to 0.5");
    expect(words.join(" ")).toContain("FrankenSim's diffusion1d_frames refused the step");
    expect(gridRefusalSentences(host.refusal).join(" ")).toContain("reference stepper refused");
    console.log(`[frankensimFtcsGrid] refusal: ${words.length} sentences: ${words.join(" | ")}`);
  });

  test("the module admits exactly what the host admits, for 7 grids", async () => {
    const grids: Bm06Parameters[] = [
      GRID,
      { ...GRID, t: 0 },
      { ...GRID, steps: 1 },
      { ...GRID, dx: 1e-8, steps: 1000 },
      { ...GRID, n: 3, steps: 600_000 },
      { ...GRID, n: 4097, steps: 1000 },
      { ...GRID, n: 2 },
    ];
    const code = (r: Awaited<ReturnType<typeof evaluateBm06>>) =>
      r.kind === "accepted"
        ? "accepted"
        : r.kind === "refused"
          ? `refused:${r.refusal.code}`
          : `outcome:${r.outcome.outcome}`;
    const kinds = new Set<string>();
    for (const p of grids) {
      const host = code(await evaluateBm06(p, quiet));
      expect(code(await evaluateBm06(p, quiet, frankensim)), JSON.stringify(p)).toBe(host);
      kinds.add(host);
    }
    // The grid set reaches acceptance, the stability refusal, the input refusal and the budget.
    expect([...kinds].sort()).toEqual([
      "accepted",
      "outcome:budget-exhausted",
      "refused:ftcs-unstable",
      "refused:invalid-parameter",
    ]);
    console.log(
      `[frankensimFtcsGrid] admission: ${grids.length} grids, kinds ${[...kinds].sort().join(", ")}`,
    );
  });
});
