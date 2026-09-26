/**
 * BM-05 through a reader's session, with the worker's host drawing through the pinned module
 * (dispatch 269): what the page's label reads after "Apply", and what it reads when the module's
 * draws are replaced by the host's.
 *
 * The session is the page's own (createBm05Session), and the host is the worker's
 * (createBm05Host), run in-process with the source bm05Worker.ts gives it when the module loads.
 * So a Gaussian walk passes through the scheduler, the decoder (343be2da) and the store's
 * admission before walkExecutionKind reads it.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BM05_DEFAULTS, type Bm05Parameters } from "../../experiments/bm05/definition.ts";
import { createBm05Session } from "../../experiments/bm05/session.ts";
import { walkExecutionKind } from "../../experiments/bm05/walkExecution.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import {
  HOST_WALK_NORMALS,
  type WalkNormalSource,
} from "../../physics/reference/diffusion/walks.ts";
import { createBm05Host } from "../host/bm05Host.ts";
import { createBm05Recording, measureBm05 } from "../operations/bm05.ts";
import type { FrankenSimExports } from "./frankensimCalls.ts";
import { frankensimWalkNormals } from "./frankensimWalkNormals.ts";
import { PINNED_ARTIFACT } from "./pinnedArtifact.ts";
import { loadPinnedBundle } from "./pinnedBundle.ts";

const DIGEST = `source:sha256:${"d".repeat(64)}`;
const quiet = { yieldControl: async () => {} };
const GAUSS: Bm05Parameters = { ...BM05_DEFAULTS, kernel: "gaussian", walkers: 50, runSteps: 30 };
let moduleCalls = 0;
let module: WalkNormalSource;

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
  const real = loaded.exports;
  const counted: FrankenSimExports = {
    ...real,
    philox_normals: (...args: Parameters<FrankenSimExports["philox_normals"]>) => {
      moduleCalls++;
      return real.philox_normals(...args);
    },
  };
  module = frankensimWalkNormals(counted);
});

/** A session wired as the page wires it, with the worker's host drawing through `normals`. */
async function readerSession(normals: WalkNormalSource) {
  const recording = await createBm05Recording(BM05_DEFAULTS, quiet);
  if (recording.kind !== "accepted") throw new Error("example recording");
  const measured = await measureBm05(recording.data, BM05_DEFAULTS, false, quiet);
  if (measured.kind !== "accepted") throw new Error("example measure");
  const example = {
    sourceDigest: DIGEST,
    snapshotFunctionName: "recordWalks",
    snapshotFunctionHash: "not-compared-here",
    parameters: BM05_DEFAULTS,
    results: measured.data.outputs.map(encodeResult),
    stepIndex: measured.data.stepIndex,
    simulationTime: measured.data.simulationTime,
  };
  const app = createBm05Session("walk-fs", example, () => {
    let send: ((message: unknown) => void) | null = null;
    const host = createBm05Host((m) => send?.(structuredClone(m)), DIGEST, normals);
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

describe("BM-05 in a reader's session, with the module loaded", () => {
  test("the worked example is static; an applied Gaussian walk drawn by the module is FrankenSim's", async () => {
    const { app, settle } = await readerSession(module);
    expect(walkExecutionKind(app.getSnapshot().accepted?.outputs, true)).toBe("static-example");
    const before = moduleCalls;
    app.apply(GAUSS);
    await settle();
    const view = app.getSnapshot();
    expect(view.status).toBe("accepted");
    expect(moduleCalls - before).toBe(GAUSS.walkers);
    expect(walkExecutionKind(view.accepted?.outputs, false)).toBe("frankensim-accepted");
    app.disconnect();
  });

  test("the same worker on a coin walk makes no module call, and the walk is the host's", async () => {
    const { app, settle } = await readerSession(module);
    const before = moduleCalls;
    app.apply({ ...GAUSS, kernel: "coin" });
    await settle();
    expect(app.getSnapshot().status).toBe("accepted");
    expect(moduleCalls - before).toBe(0);
    expect(walkExecutionKind(app.getSnapshot().accepted?.outputs, false)).toBe("host-accepted");
    app.disconnect();
  });

  test("plant: the module loaded, the host's draws in its place, and the label says host", async () => {
    const { app, settle } = await readerSession({ ...module, normals: HOST_WALK_NORMALS.normals });
    const before = moduleCalls;
    app.apply(GAUSS);
    await settle();
    expect(app.getSnapshot().status).toBe("accepted");
    expect(moduleCalls - before).toBe(0);
    expect(walkExecutionKind(app.getSnapshot().accepted?.outputs, false)).toBe("host-accepted");
    app.disconnect();
  });
});
