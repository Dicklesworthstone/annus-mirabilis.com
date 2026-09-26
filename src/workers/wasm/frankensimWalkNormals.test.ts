/**
 * BM-05's Gaussian walks drawn by FrankenSim's philox_normals (am-frankensim-repin-and-bind-jvhg,
 * dispatch 269), against the real pinned module: public/wasm/fs-annus-diffusion/80a1f8fda6f69003/.
 *
 * A walker's Gaussian steps are one contiguous run of standard normals from its own Philox stream:
 * kernel BM05_ALLOCATION.streamKernelId, tile bm05Tile(walker), two draws per normal, starting at
 * draw 2 x startStep. philox_normals(seed, kernel, tile, startIndex, count) is exactly that run, so
 * the module can draw what the host reference draws.
 *
 * The cross-check, stated. The Philox integers are bitwise equal between fs-rand and the TypeScript
 * port: src/physics/reference/philox.vectors.json holds fs-rand's own vectors, checked in
 * frankensimCalls.test.ts. The normal transform is not bitwise, because FrankenSim takes ln and cos
 * from fs-math's deterministic functions and the host from Math. Measured before this file asserted
 * it: 16,000 normals over four seeds, including 2^53 and 2^64 - 1, about two thirds bitwise equal,
 * and the worst difference 8.9e-16. So each normal is compared within 64 ulps of max(1, |z|).
 *
 * The label is earned by the draws, not by the module being loaded: each draw run carries the
 * owner that produced it, and a walk is FrankenSim's only if its draws are.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BM05_DEFAULTS, type Bm05Parameters } from "../../experiments/bm05/definition.ts";
import { decodeBm05Settings, encodeBm05Settings } from "../../experiments/bm05/permalink.ts";
import { BM05_ALLOCATION, bm05Tile } from "../../experiments/streams/allocation.ts";
import * as walks from "../../physics/reference/diffusion/walks.ts";
import { createPhiloxStream } from "../../physics/reference/philox.ts";
import { createBm05Recording, measureBm05 } from "../operations/bm05.ts";
import { callPhiloxNormals, type FrankenSimExports } from "./frankensimCalls.ts";
import { PINNED_ARTIFACT } from "./pinnedArtifact.ts";
import { loadPinnedBundle } from "./pinnedBundle.ts";

const FS_OWNER = "fs-wasm.philox_normals";
const quiet = { yieldControl: async () => {} };
const EPS = Number.EPSILON;
const GAUSS: Bm05Parameters = { ...BM05_DEFAULTS, kernel: "gaussian", walkers: 60, runSteps: 40 };

type Draws = Readonly<{ values: Float64Array; ownerId: string }>;
type NormalSource = Readonly<{
  normals(
    seed: string,
    walker: number,
    startStep: number,
    count: number,
  ): Readonly<{ kind: string; data?: Draws }>;
}>;
type Output = Readonly<{ quantityId: string; ownerId: string; status: string; value?: unknown }>;

/**
 * The adapter, the host source and the label helper are what dispatch 269 adds. They are loaded by
 * path here, so this file typechecks and runs before they exist, and says which is missing.
 */
async function optional<T>(relative: string): Promise<T | null> {
  try {
    return (await import(new URL(relative, import.meta.url).href)) as T;
  } catch {
    return null;
  }
}
let exportsReal: FrankenSimExports;
let moduleCalls = 0;
let counted: FrankenSimExports;
let adapter: { frankensimWalkNormals(exports: FrankenSimExports): NormalSource } | null;
let label: {
  walkExecutionKind(outputs: readonly Output[] | undefined, isStatic: boolean): string;
} | null;
const hostSource = (walks as Record<string, unknown>).HOST_WALK_NORMALS as NormalSource | undefined;

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
  exportsReal = loaded.exports;
  counted = {
    ...exportsReal,
    philox_normals: (...args: Parameters<FrankenSimExports["philox_normals"]>) => {
      moduleCalls++;
      return exportsReal.philox_normals(...args);
    },
  };
  adapter = await optional("./frankensimWalkNormals.ts");
  label = await optional("../../experiments/bm05/walkExecution.ts");
});

function output(outputs: readonly Output[], id: string): Output {
  const o = outputs.find((x) => x.quantityId === id);
  if (!o) throw new Error(`No ${id}`);
  return o;
}
async function walk(p: Bm05Parameters, normals?: NormalSource) {
  // The source's type is walks.ts's WalkNormalSource; this file declares a looser one of its own so
  // that it loaded before that type existed.
  const options = (normals ? { ...quiet, normals } : quiet) as never;
  const recorded = await createBm05Recording(p, options);
  if (recorded.kind !== "accepted") throw new Error(`recording ${recorded.kind}`);
  const measured = await measureBm05(recorded.data, p, false, options);
  if (measured.kind !== "accepted") throw new Error(`measure ${measured.kind}`);
  return measured.data.outputs as readonly Output[];
}
function requireBinding() {
  if (!adapter) throw new Error("src/workers/wasm/frankensimWalkNormals.ts is not there yet");
  if (!label) throw new Error("src/experiments/bm05/walkExecution.ts is not there yet");
  if (!hostSource) throw new Error("walks.ts exports no HOST_WALK_NORMALS yet");
  return { adapter, label, hostSource };
}

describe("the module draws BM-05's normals as the host does", () => {
  test("philox_normals equals the TypeScript Philox normals on BM-05's streams, within 64 ulps", () => {
    let total = 0;
    let bitwise = 0;
    for (const seed of ["0", "1905", "9007199254740992", "18446744073709551615"])
      for (const walker of [0, 1, 9999])
        for (const startStep of [0, 13]) {
          const count = 200;
          const call = callPhiloxNormals(exportsReal, {
            seed,
            streamKernel: BM05_ALLOCATION.streamKernelId,
            tile: bm05Tile(walker),
            startIndex: String(2 * startStep),
            count,
          });
          expect(call.kind, `${seed}/${walker}/${startStep}`).toBe("accepted");
          if (call.kind !== "accepted") continue;
          const rng = createPhiloxStream(
            { seed, kernel: BM05_ALLOCATION.streamKernelId, tile: bm05Tile(walker) },
            BigInt(2 * startStep),
          );
          for (let i = 0; i < count; i++) {
            const h = rng.nextNormal();
            const f = call.values[i] ?? Number.NaN;
            expect(Math.abs(h - f), `${seed}/${walker}/${startStep}/${i}`).toBeLessThanOrEqual(
              64 * EPS * Math.max(1, Math.abs(h)),
            );
            total++;
            if (h === f) bitwise++;
          }
        }
    // Not bitwise overall (the transforms differ), and not a different stream either.
    expect(bitwise).toBeGreaterThan(total / 2);
    expect(bitwise).toBeLessThan(total);
    console.log(`[frankensimWalkNormals] cross-check: ${total} normals, ${bitwise} bitwise equal`);
  });

  test("seeds 2^53 and 2^64 - 1 survive the URL, and 2^53 + 1 is a different stream", () => {
    for (const seed of ["9007199254740992", "18446744073709551615"]) {
      const decoded = decodeBm05Settings(encodeBm05Settings({ ...GAUSS, seed }));
      expect(decoded.kind).toBe("settings");
      if (decoded.kind === "settings") expect(decoded.parameters.seed).toBe(seed);
    }
    const first = (seed: string) => {
      const call = callPhiloxNormals(exportsReal, {
        seed,
        streamKernel: BM05_ALLOCATION.streamKernelId,
        tile: bm05Tile(0),
        startIndex: "0",
        count: 1,
      });
      return call.kind === "accepted" ? call.values[0] : Number.NaN;
    };
    // A seed rounded to a double would make these two the same stream.
    expect(first("9007199254740992")).not.toBe(first("9007199254740993"));
  });
});

describe("the label follows the draws", () => {
  test("a Gaussian walk drawn through the module is FrankenSim's, and agrees with the host's walk", async () => {
    const { adapter: a, label: l } = requireBinding();
    const before = moduleCalls;
    const frank = await walk(GAUSS, a.frankensimWalkNormals(counted));
    const host = await walk(GAUSS);
    expect(moduleCalls - before).toBeGreaterThan(0);
    for (const id of ["walkPositions", "traceDisplacements", "recordingDraws"])
      expect(output(frank, id).ownerId, id).toBe(FS_OWNER);
    expect(output(host, "walkPositions").ownerId).not.toBe(FS_OWNER);
    const a1 = output(host, "walkPositions").value as Float64Array;
    const b1 = output(frank, "walkPositions").value as Float64Array;
    expect(b1.length).toBe(a1.length);
    const bound = GAUSS.runSteps * 64 * EPS * GAUSS.stepRms * 8;
    for (let i = 0; i < a1.length; i++)
      expect(Math.abs((a1[i] ?? 0) - (b1[i] ?? 0)), `walker ${i}`).toBeLessThanOrEqual(bound);
    expect(l.walkExecutionKind(frank, false)).toBe("frankensim-accepted");
    expect(l.walkExecutionKind(host, false)).toBe("host-accepted");
    console.log(
      `[frankensimWalkNormals] ${a1.length} walkers compared within ${bound.toExponential(2)} m, ${moduleCalls - before} module calls`,
    );
  });

  test("a replay at an unrecorded step draws through the recording's own engine", async () => {
    const { adapter: a } = requireBinding();
    const source = a.frankensimWalkNormals(counted);
    const options = { ...quiet, normals: source } as never;
    const recorded = await createBm05Recording(GAUSS, options);
    if (recorded.kind !== "accepted") throw new Error("recording");
    const before = moduleCalls;
    // Step 23 is no checkpoint (0, 4, 16 and the run's end are), so it is replayed from one.
    const p = { ...GAUSS, n: 23 };
    const measured = await measureBm05(recorded.data, p, true, quiet);
    if (measured.kind !== "accepted") throw new Error("measure");
    expect(moduleCalls - before).toBeGreaterThan(0);
    const outputs = measured.data.outputs as readonly Output[];
    expect(output(outputs, "replayedDraws").ownerId).toBe(FS_OWNER);
    expect(output(outputs, "walkPositions").ownerId).toBe(FS_OWNER);
  });

  test("plant: a loaded module whose draws are the JS reference's does not earn the label", async () => {
    const { adapter: a, label: l, hostSource: h } = requireBinding();
    const planted: NormalSource = { ...a.frankensimWalkNormals(counted), normals: h.normals };
    const before = moduleCalls;
    const outputs = await walk(GAUSS, planted);
    expect(moduleCalls - before).toBe(0);
    expect(output(outputs, "walkPositions").ownerId).not.toBe(FS_OWNER);
    expect(l.walkExecutionKind(outputs, false)).toBe("host-accepted");
  });

  test("coin and uniform walks draw no normals, so the module is never called", async () => {
    const { adapter: a, label: l } = requireBinding();
    for (const kernel of ["coin", "uniform"] as const) {
      const before = moduleCalls;
      const outputs = await walk({ ...GAUSS, kernel }, a.frankensimWalkNormals(counted));
      expect(moduleCalls - before, kernel).toBe(0);
      expect(l.walkExecutionKind(outputs, false), kernel).toBe("host-accepted");
    }
  });
});
